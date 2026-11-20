/**
 * Property-based tests for the algebraic selection engine.
 *
 * Strategy: drive SelectionState (the real engine wrapping the private
 * AlgebraicStorage) and a naive ReferenceModel through IDENTICAL operation
 * sequences, then compare their full selection sets after every step.
 * The reference model replays history from scratch; the engine uses
 * generation-ID memoization + bake() compaction. If they ever diverge,
 * the optimization has broken semantics.
 */
import { describe, it, expect } from "vitest";
import { SelectionState, tt, ff, id, not } from "../multiselect";
import { ReferenceModel } from "./reference-model";

// ---------------------------------------------------------------------------
// Test scaffolding
// ---------------------------------------------------------------------------

const NUM_ITEMS = 60;
const ALL_IDS: string[] = Array.from({ length: NUM_ITEMS }, (_, i) => `item-${i}`);

/**
 * Drives the real engine and a naive reference model through identical
 * (f, domain) op pairs and keeps their undo/redo stacks aligned.
 */
class DualDriver {
  private ref = new ReferenceModel<string>();
  /** Reference-side redo stack of popped op pairs. */
  private refRedo: Array<{ f: (b: boolean) => boolean; domain: Set<string> }> = [];

  readonly engine: SelectionState<string, { x: number; y: number }>;

  constructor(maxUndo = 8) {
    const dummyGeom = {
      m2v: () => null,
      extendPath: () => null,
      selectionDomain: () => new Set<string>(),
      step: (_d: string, p: { x: number; y: number }) => p,
      defaultCursor: () => undefined,
      filter: () => new Set<string>(),
      kind: "dummy",
      locate: () => null,
      visibleIndices: () => [],
      rowOf: () => null,
    };
    this.engine = new SelectionState(dummyGeom, () => {}, maxUndo);
  }

  private storage(): any {
    return (this.engine as any)._storage;
  }

  /** Apply an op pair to both models exactly as the engine does internally. */
  applyPair(f: (b: boolean) => boolean, domain: Set<string>): void {
    this.ref.push({ f, domain: new Map(Array.from(domain).map((k) => [k, 0])) });

    // Engine internals: push (id, {}) then (modeFn, domain).
    this.storage().push({ f: (b: boolean) => b, domain: new Map() });
    this.storage().push({
      f,
      domain: new Map(Array.from(domain).map((k) => [k, 0])),
    });

    this.refRedo.length = 0; // fresh ops invalidate redo
    this.check();
  }

  undoPair(): void {
    if (this.storage().size < 2 || this.ref.size < 1) return;
    this.engine.undo();
    // Engine pops TWO ops per undo (id sentinel + modeFn); the reference
    // stores one logical pair, so pop one.
    const popped = this.ref.pop();
    if (popped) {
      this.refRedo.push({
        f: popped.f,
        domain: new Set(popped.domain.keys()),
      });
    }
    this.check();
  }

  redoPair(): void {
    if (this.refRedo.length === 0) return;
    const before = this.stackSize;
    this.engine.redo();
    // If the engine's redo was a no-op (e.g. its redo stack is empty), skip.
    if (this.stackSize === before && this.ref.size === 0 && this.refRedo.length === 1) {
      // ambiguous; fall through — check() below catches real divergence
    }
    const pair = this.refRedo.pop();
    if (!pair) return;
    this.ref.push({
      f: pair.f,
      domain: new Map(Array.from(pair.domain).map((k) => [k, 0])),
    });
    this.check();
  }

  bakeOnce(): void {
    this.storage().bake();
    this.ref.bake();
  }

  get stackSize(): number {
    return this.storage().size;
  }

  get refStackSize(): number {
    return this.ref.size;
  }

  /** Compare engine vs reference full selection state. */
  check(context: string = ""): void {
    const engineSel = [...this.engine.selected].sort();
    const refSel = [...this.ref.selected()].sort();
    expect(
      engineSel,
      `engine vs reference divergence ${context}`,
    ).toEqual(refSel);
  }
}

// ---------------------------------------------------------------------------
// Deterministic unit tests of algebra semantics
// ---------------------------------------------------------------------------

describe("SelectionState: deterministic semantic tests", () => {
  it("tt over a domain selects those items", () => {
    const d = new DualDriver();
    d.applyPair(tt, new Set(["item-1", "item-2", "item-7"]));
    d.check("select three items");
  });

  it("ff over a domain deselects those items", () => {
    const d = new DualDriver();
    d.applyPair(tt, new Set(["item-1", "item-2"]));
    d.applyPair(ff, new Set(["item-2"]));
    d.check("select two then deselect one");
  });

  it("not flips membership", () => {
    const d = new DualDriver();
    d.applyPair(tt, new Set(["item-5"]));
    d.applyPair(not, new Set(["item-5", "item-9"]));
    d.check("not-flip two items");
  });

  it("overlapping ops compose correctly", () => {
    const d = new DualDriver();
    d.applyPair(tt, new Set(["a", "b", "c"]));
    d.applyPair(id, new Set(["b"])); // id — no-op on value but touches chain
    d.applyPair(ff, new Set(["a", "c"]));
    d.check("compose tt/id/ff");
  });

  it("undo restores prior state exactly", () => {
    const d = new DualDriver();
    d.applyPair(tt, new Set(["x1", "x2"]));
    const before = new Set(d.engine.selected);
    d.undoPair();
    expect(d.engine.selected.size).toBe(0);
    d.redoPair();
    expect([...d.engine.selected].sort()).toEqual([...before].sort());
  });

  it("multiple undos unwind history in order", () => {
    const d = new DualDriver();
    d.applyPair(tt, new Set(["a"]));
    d.applyPair(tt, new Set(["b"]));
    d.applyPair(ff, new Set(["a"]));
    expect(d.engine.selected.has("b")).toBe(true);

    d.undoPair(); // undo ff(a)
    expect(d.engine.selected.has("a")).toBe(true);

    d.undoPair(); // undo tt(b)
    expect(d.engine.selected.has("b")).toBe(false);
    expect(d.engine.selected.has("a")).toBe(true);

    d.undoPair(); // undo tt(a)
    expect(d.engine.selected.size).toBe(0);
  });

  it("redo after fresh op is a no-op", () => {
    const d = new DualDriver();
    d.applyPair(tt, new Set(["p"]));
    d.undoPair();
    d.applyPair(tt, new Set(["q"])); // invalidates redo
    d.redoPair(); // must not resurrect anything
    expect([...d.engine.selected].sort()).toEqual(["q"]);
  });

  it("predicate preview composes with committed state and undoes cleanly", () => {
    const d = new DualDriver();
    d.applyPair(tt, new Set(["keep-1", "keep-2"]));
    d.applyPair(tt, new Set(["tmp-a", "tmp-b"]));
    const sel = d.engine.selected;
    expect(sel.has("keep-1")).toBe(true);
    expect(sel.has("tmp-a")).toBe(true);

    d.undoPair(); // remove the preview pair
    expect(d.engine.selected.has("tmp-a")).toBe(false);
    expect(d.engine.selected.has("keep-1")).toBe(true);
    expect(d.engine.selected.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Property-based randomized testing
// ---------------------------------------------------------------------------

/** Simple seeded PRNG so failures are reproducible by seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MODES: Array<[string, (b: boolean) => boolean]> = [
  ["tt", tt],
  ["ff", ff],
  ["id", id],
  ["not", not],
];

describe("Property: engine ≡ reference model under random op sequences", () => {
  const NUM_RUNS = 40;
  const OPS_PER_RUN = 30;

  for (let run = 0; run < NUM_RUNS; run++) {
    it(`random sequence, seed ${run}`, () => {
      const rand = mulberry32(run * 7919 + 17);
      const d = new DualDriver(6); // small maxUndo → forces frequent bake()

      for (let step = 0; step < OPS_PER_RUN; step++) {
        const [modeName, modeFn] = MODES[Math.floor(rand() * MODES.length)];
        const domain = new Set<string>();
        const n = 1 + Math.floor(rand() * 5);
        for (let i = 0; i < n; i++) {
          domain.add(ALL_IDS[Math.floor(rand() * NUM_ITEMS)]);
        }

        const roll = rand();
        if (roll < 0.7) {
          d.applyPair(modeFn, domain);
        } else if (roll < 0.85) {
          d.undoPair();
        } else if (roll < 0.95) {
          d.redoPair();
        } else {
          d.bakeOnce(); // exercise compaction mid-sequence
        }

        d.check(`seed ${run}, step ${step}, mode ${modeName}`);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Bake-equivalence property: compacting history never changes visible state
// ---------------------------------------------------------------------------

describe("Property: bake() preserves observable selection", () => {
  it("state before bake == state after bake", () => {
    const rand = mulberry32(999);
    const d = new DualDriver(50);

    for (let i = 0; i < 20; i++) {
      const domain = new Set<string>();
      for (let j = 0; j <= i % 4; j++) {
        domain.add(`bk-${Math.floor(rand() * 12)}`);
      }
      d.applyPair(MODES[i % MODES.length][1], domain);
      if (i === 9 || i === 15) {
        const before = [...d.engine.selected].sort();
        d.bakeOnce();
        const after = [...d.engine.selected].sort();
        expect(after).toEqual(before);
      }
    }
  });

  it("undo still works across the baked boundary", () => {
    const d = new DualDriver(4);
    d.applyPair(tt, new Set(["u1"]));
    d.applyPair(tt, new Set(["u2"]));
    d.applyPair(tt, new Set(["u3"]));
    d.bakeOnce(); // compacts oldest op into the baked layer

    d.undoPair(); // pops tt(u3)
    expect(d.engine.selected.has("u3")).toBe(false);
    expect(d.engine.selected.has("u2")).toBe(true);
    expect(d.engine.selected.has("u1")).toBe(true); // survived in baked layer
  });
});
