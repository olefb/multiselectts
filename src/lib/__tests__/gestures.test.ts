/**
 * Gesture-level tests for SelectionState.
 *
 * The property tests in multiselect.properties.test.ts drive AlgebraicStorage
 * directly. These tests drive the PUBLIC gesture API (click, cmdClick,
 * shiftClick, predicateSelect, apply, undo/redo, setGeometry, ...) — the layer
 * the thesis' interaction claims actually rest on.
 *
 * Invariants checked after every random action:
 *   I1  the op stack always holds whole (op, op) pairs;
 *   I2  history is immutable: undo returns exactly to the state that was
 *       observed when that step was last on top;
 *   I3  redo returns exactly to the state observed before the matching undo;
 *   I4  no dead undo steps: an undo that pops a step changes the selection;
 *   I5  after undo/redo/commit nothing is shown as "active";
 *   I6  cursor and anchor identities agree with their coordinates;
 *   I7  a Shift-press on an element makes it active (never a silent no-op).
 * The sequences also run on a list that, like the real tree, spans nothing
 * from an anchor in blank space.
 * Plus local post-conditions for click, cmd-click, predicate, cancel and apply.
 */
import { describe, it, expect } from "vitest";
import { SelectionState, tt, ff, type ClickScope } from "../multiselect";
import { ListGeometry, row, type P } from "./support/listGeometry";
import { HierarchicalTreeGeometry } from "../HierarchicalTreeGeometry";
import { keyboardTarget } from "../SelectionEngine";
import type { VisibleNode } from "../TreeModels";

const make = (geom: ListGeometry, opts: { maxUndo?: number; clickScope?: ClickScope } = {}) =>
  new SelectionState<string, P>(geom, () => {}, { scheduleFlush: () => {}, ...opts });
const sel = (s: SelectionState<string, P>) => [...s.selected].sort().join(",");
const stackSize = (s: SelectionState<string, P>) =>
  (s as unknown as { _storage: { size: number } })._storage.size;

const ABCDEF = ["A", "B", "C", "D", "E", "F"];

// ---------------------------------------------------------------------------
// Regression tests for the bugs found in the review
// ---------------------------------------------------------------------------

describe("Regression: history is never rewritten", () => {
  it("shift-click after undo opens a new step instead of rewriting the undone-to step", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(0));
    s.cmdClick(row(1));
    s.cmdClick(row(2));
    s.undo();
    expect(sel(s)).toBe("A,B");
    s.shiftClick(row(4)); // anchored at the cursor (C), additive
    s.flush();
    expect(sel(s)).toBe("A,B,C,D,E");
    s.undo();
    expect(sel(s)).toBe("A,B"); // B is still there
    s.undo();
    expect(sel(s)).toBe("A");
  });

  it("shift-click after Select All does not shrink the Select All step", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.apply(tt, ABCDEF);
    s.shiftClick(row(3));
    s.flush();
    expect(sel(s)).toBe("A,B,C,D,E,F");
    s.undo();
    expect(sel(s)).toBe(""); // one step: back to before Select All
  });

  it("shift-click on a fresh engine keeps the stack in whole pairs", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.shiftClick(row(2));
    s.flush();
    expect(sel(s)).toBe("C");
    expect(stackSize(s) % 2).toBe(0);
    s.undo();
    expect(sel(s)).toBe("");
  });

  it("a lasso after click-in-empty-space does not resurrect deselected items", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.apply(tt, ABCDEF);
    s.apply(ff, ABCDEF);
    s.click(row(-1)); // empty space, nothing selected
    s.shiftClick(row(1));
    s.shiftClick(row(3));
    s.flush();
    expect(sel(s)).toBe("A,B,C,D"); // anchor clamps to row 0
  });
});

// The real tree geometry selects nothing from an anchor in blank space (below
// the last row); ListGeometry clamps such anchors, which hid this bug.
describe("Regression: Shift-click after a click in blank space (tree)", () => {
  const ROW = 32;
  const tree = (names: string[]) =>
    new HierarchicalTreeGeometry(
      { itemHeight: ROW, indentWidth: 24, chevronWidth: 28 },
      names.map((name, index): VisibleNode => ({ id: name, node: { id: name, name }, depth: 0, index, parentId: null })),
      names.map((name) => ({ id: name, name })),
    );
  const at = (i: number) => ({ x: 100, y: i * ROW + ROW / 2 });
  const blank = { x: 100, y: 10 * ROW }; // below the rows
  const makeTree = (g: HierarchicalTreeGeometry) =>
    new SelectionState<string, { x: number; y: number }>(g, () => {}, { scheduleFlush: () => {} });

  it("extends from the last clicked item, replacing the selection as one step", () => {
    const t = makeTree(tree(ABCDEF));
    t.click(at(1)); // B
    t.cmdClick(at(5)); // F
    t.click(blank);
    expect([...t.selected]).toEqual([]);
    t.shiftClick(at(3));
    t.flush();
    expect([...t.selected].sort().join(",")).toBe("D,E,F"); // anchor: F, the last item clicked
    t.undo();
    expect([...t.selected].sort().join(",")).toBe("B,F"); // the blank click and the Shift-click are one step
  });

  it("a Shift-drag after it extends from that anchor too", () => {
    const t = makeTree(tree(ABCDEF));
    t.click(at(4)); // E
    t.click(blank);
    t.shiftClick(at(1));
    t.dragTo(at(2));
    t.flush();
    expect([...t.selected].sort().join(",")).toBe("C,D,E");
  });

  it("after a Ctrl-click in blank space, Shift-click adds a range from the last item", () => {
    const t = makeTree(tree(ABCDEF));
    t.click(at(1)); // B
    t.cmdClick(blank); // records nothing
    t.shiftClick(at(3));
    t.flush();
    expect([...t.selected].sort().join(",")).toBe("B,C,D");
    t.undo();
    expect([...t.selected].sort().join(",")).toBe("B");
  });

  it("with the last item hidden, Shift-click selects the clicked item", () => {
    const t = makeTree(tree(ABCDEF));
    t.click(at(1)); // B
    t.setGeometry(tree(["A", "C", "D"])); // a filter hides B
    t.click(blank);
    t.shiftClick(at(2)); // D
    t.flush();
    expect([...t.selected].sort().join(",")).toBe("D");
  });

  it("a Shift-click in blank space still does nothing", () => {
    const t = makeTree(tree(ABCDEF));
    t.click(at(1));
    t.click(blank);
    t.shiftClick({ x: 100, y: 12 * ROW });
    t.flush();
    expect([...t.selected]).toEqual([]);
  });

  // Revision 22: a drag from the blank space below the rows starts at the last row
  // (as in Explorer and Finder); before, it selected nothing.
  it("a plain drag from the blank space below the rows selects up from the last row", () => {
    const t = makeTree(tree(ABCDEF));
    t.click(at(1));
    t.click(blank);
    t.dragTo(at(3));
    t.flush();
    expect([...t.selected].sort().join(",")).toBe("D,E,F");
  });
});

describe("Regression: predicate search", () => {
  it("Select All during a live preview is not narrowed by the search cache", () => {
    const g = new ListGeometry(["sa", "sb", "xa", "xb"]);
    const s = make(g);
    const q = (t: string) => (n: { name: string }) => n.name.includes(t);
    s.predicateSelect(q("s"));
    s.predicateSelect(q("sa"), { refinesPrevious: true });
    expect(sel(s)).toBe("sa");
    s.apply(tt, g.all);
    expect(sel(s)).toBe("sa,sb,xa,xb");
  });

  it("a non-monotone (OR) predicate is evaluated globally unless the caller vouches for refinement", () => {
    const g = new ListGeometry(["a.pdf", "b.txt", "c.png"]);
    const s = make(g);
    s.predicateSelect((n) => n.name.endsWith("pdf"));
    s.predicateSelect((n) => n.name.endsWith("pdf") || n.name.endsWith("txt"));
    expect(sel(s)).toBe("a.pdf,b.txt");
  });

  it("the cache is used from the first refinement onwards", () => {
    const g = new ListGeometry(["ab", "ac", "bc"]);
    let seen: Set<string> | undefined;
    const orig = g.filter.bind(g);
    g.filter = (p, c) => ((seen = c), orig(p, c));
    const s = make(g);
    s.predicateSelect((n) => n.name.includes("a"));
    s.predicateSelect((n) => n.name.includes("ab"), { refinesPrevious: true });
    expect(seen && [...seen].sort()).toEqual(["ab", "ac"]);
  });

  it("Enter (commit) followed by the empty-query effect leaves no dead undo step", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(0));
    s.predicateSelect((n) => n.name === "C");
    s.commit();
    s.cancelPredicate(); // what the debounced effect does after setQuery("")
    expect(sel(s)).toBe("A,C");
    s.undo();
    expect(sel(s)).toBe("A"); // first Ctrl+Z reverts the search
  });

  it("clearing a preview restores the pre-search selection and history", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(0));
    const depth = s.undoDepth;
    s.predicateSelect((n) => n.name !== "A");
    s.cancelPredicate();
    expect(sel(s)).toBe("A");
    expect(s.undoDepth).toBe(depth);
  });

  it("a committed preview that matched nothing new records no step", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(0));
    const depth = s.undoDepth;
    s.predicateSelect((n) => n.name === "A"); // already selected
    s.commit();
    expect(s.undoDepth).toBe(depth);
  });
});

describe("Regression: no dead undo steps", () => {
  it("cmd-click in empty space records nothing", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(0));
    s.cmdClick(row(-1));
    s.undo();
    expect(sel(s)).toBe("");
  });

  it("a click that changes nothing keeps the redo stack", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(0));
    s.cmdClick(row(1));
    s.undo();
    s.click(row(0)); // A is already the only selected item
    s.redo();
    expect(sel(s)).toBe("A,B");
  });

  it("a click that does change something discards the redo stack", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(0));
    s.cmdClick(row(1));
    s.undo();
    s.click(row(3));
    s.redo();
    expect(sel(s)).toBe("D");
  });

  it("Deselect All with nothing selected records nothing", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(2));
    s.undo();
    s.apply(ff, ABCDEF);
    expect(s.redoDepth).toBe(1);
    expect(s.undoDepth).toBe(0);
  });
});

describe("Regression: anchors and cursor follow identity across geometry changes", () => {
  it("range extends from the anchored element after rows are inserted above it", () => {
    const items = [...ABCDEF];
    const s = make(new ListGeometry(items));
    s.click(row(2)); // C
    s.setGeometry(new ListGeometry(["A", "X1", "X2", "B", "C", "D", "E", "F"]));
    s.shiftClick(row(5)); // D in the new layout
    s.flush();
    expect(sel(s)).toBe("C,D");
  });

  it("pending path work is flushed in the old geometry before the swap", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(0));
    s.shiftClick(row(2)); // pending, not flushed yet
    s.setGeometry(new ListGeometry(["Z", ...ABCDEF]));
    expect(sel(s)).toBe("A,B,C");
  });

  it("an anchor that becomes hidden ends the gesture; the next shift-click starts a new step", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(2)); // C
    s.setGeometry(new ListGeometry(["A", "B", "D", "E", "F"]));
    s.shiftClick(row(3)); // E
    s.flush();
    expect(sel(s)).toBe("C,E");
    s.undo();
    expect(sel(s)).toBe("C");
  });

  it("keyboard cursor is re-projected by identity", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(3)); // D
    s.setGeometry(new ListGeometry(["D", "E"]));
    expect(s.cursor).toEqual(row(0));
    s.arrow("DOWN");
    expect(sel(s)).toBe("E");
  });

  it("a spatial anchor in empty space is dropped when the view kind changes", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(-1));
    s.setGeometry(new ListGeometry(ABCDEF, ABCDEF, "grid"));
    s.shiftClick(row(3));
    s.flush();
    expect(sel(s)).toBe("D");
  });

  it("a live predicate preview survives a view switch", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.predicateSelect((n) => n.name === "B");
    s.setGeometry(new ListGeometry(ABCDEF, ABCDEF, "grid"));
    s.predicateSelect((n) => n.name === "B" || n.name === "C");
    expect(sel(s)).toBe("B,C");
    s.cancelPredicate();
    expect(sel(s)).toBe("");
  });
});

describe("Regression: double-click retraction", () => {
  it("cancelSince retracts exactly the click", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(0));
    s.cmdClick(row(1));
    const token = s.click(row(5));
    expect(sel(s)).toBe("F");
    s.cancelSince(token);
    expect(sel(s)).toBe("A,B");
    s.undo();
    expect(sel(s)).toBe("A");
  });

  it("a slow double-click (click, pause, double-click) retracts the earlier click too", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(0));
    s.cmdClick(row(1));
    const token = s.click(row(5)); // the single click before the pause: F only
    s.click(row(5)); // the double-click's two clicks (no-ops)
    s.click(row(5));
    s.cancelSince(token);
    expect(sel(s)).toBe("A,B");
    s.undo();
    expect(sel(s)).toBe("A");
  });

  it("a token from before the current run of clicks retracts that run only", () => {
    const s = make(new ListGeometry(ABCDEF));
    const token = s.click(row(0));
    s.apply(tt, ["C"]); // ends the run
    s.click(row(3));
    s.cancelSince(token);
    expect(sel(s)).toBe("A,C");
  });

  it("a navigation key is not part of a run of clicks", () => {
    const s = make(new ListGeometry(ABCDEF));
    const token = s.click(row(0));
    s.arrow("DOWN"); // selects B
    s.click(row(3));
    s.cancelSince(token);
    expect(sel(s)).toBe("B"); // the click on D is retracted, the key press is not
  });

  it("cancelSince after a no-op click leaves earlier history alone", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(0));
    s.cmdClick(row(1));
    s.click(row(5));
    const token = s.click(row(5)); // second click of the double-click
    s.cancelSince(token);
    expect(sel(s)).toBe("F");
    s.undo();
    expect(sel(s)).toBe("A,B");
  });
});

describe("Click scope policy", () => {
  it("'visible' keeps selections hidden by a filter", () => {
    const s = make(new ListGeometry(ABCDEF), { clickScope: "visible" });
    s.click(row(0));
    s.cmdClick(row(5)); // A, F
    s.setGeometry(new ListGeometry(["B", "C", "D"]));
    s.click(row(1)); // C
    expect(sel(s)).toBe("A,C,F");
  });

  it("'global' clears everything (paper / desktop semantics)", () => {
    const s = make(new ListGeometry(ABCDEF));
    s.click(row(0));
    s.cmdClick(row(5));
    s.setGeometry(new ListGeometry(["B", "C", "D"]));
    s.click(row(1));
    expect(sel(s)).toBe("C");
  });
});

// ---------------------------------------------------------------------------
// Random gesture sequences
// ---------------------------------------------------------------------------

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

// All strings of length 2..3 over {a,b,c}: substring queries refine naturally.
const LETTERS = ["a", "b", "c"];
const ALL: string[] = [];
for (const x of LETTERS) for (const y of LETTERS) ALL.push(x + y);
for (const x of LETTERS) for (const y of LETTERS) for (const z of LETTERS) ALL.push(x + y + z);

const key = (s: Iterable<string>) => [...s].sort().join(",");

function runRandom(seed: number, steps: number, clickScope: ClickScope, clamp = true) {
  const rand = mulberry32(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  let geom = new ListGeometry(ALL, ALL, "list", clamp);
  const s = make(geom, { maxUndo: 5, clickScope });

  const observed = new Map<number, string>(); // generation -> state last seen at that level
  let redoExpect: string[] = [];
  let previewBase: Set<string> | null = null; // selection before the live preview
  let lastQuery = "";
  let lastToken: number | null = null;
  observed.set(s.generation, key(s.selected));
  const trace: string[] = [];
  const ctx = () => `\n  last actions: ${trace.slice(-8).join(" | ")}`;

  for (let step = 0; step < steps; step++) {
    const before = new Set(s.selected);
    const genBefore = s.generation;
    const r = rand();
    const y = Math.floor(rand() * (geom.items.length + 2)) - 1; // includes empty space
    let kind = "";
    let noOp = false; // an action that does nothing (it does not end a live preview)

    if (r < 0.14) {
      kind = "click";
      const target = geom.m2v(row(y));
      lastToken = s.click(row(y));
      const cleared =
        clickScope === "global"
          ? new Set<string>()
          : new Set([...before].filter((i) => !geom.items.includes(i)));
      if (target) cleared.add(target);
      expect(key(s.selected), "click post-condition" + ctx()).toBe(key(cleared));
    } else if (r < 0.26) {
      kind = "cmdClick";
      const target = geom.m2v(row(y));
      s.cmdClick(row(y));
      const exp = new Set(before);
      if (target) {
        if (exp.has(target)) exp.delete(target);
        else exp.add(target);
      }
      expect(key(s.selected), "cmd-click post-condition" + ctx()).toBe(key(exp));
    } else if (r < 0.42) {
      kind = "shift";
      const n = 1 + Math.floor(rand() * 3);
      let target: string | null = null;
      for (let i = 0; i < n; i++) {
        const r = row(Math.floor(rand() * geom.items.length));
        target = geom.m2v(r);
        s.shiftClick(r);
      }
      if (rand() < 0.8) {
        s.flush();
        // I7: a Shift-press on an element never does nothing (e.g. from a dead anchor in blank space).
        if (target !== null) expect(s.activeIndices.has(target), "I7 shift target active" + ctx()).toBe(true);
      }
    } else if (r < 0.46) {
      kind = "arrow";
      const dir = pick(["UP", "DOWN"]);
      noOp = keyboardTarget(geom, s.cursor, dir) === undefined; // e.g. Up with no cursor
      if (rand() < 0.5) s.arrow(dir);
      else s.shiftArrow(dir);
    } else if (r < 0.58) {
      kind = "predicate";
      const q = Array.from({ length: 1 + Math.floor(rand() * 2) }, () => pick(LETTERS)).join("");
      const inPreview = previewBase !== null;
      if (!inPreview) previewBase = new Set(s.selected);
      s.predicateSelect((n: { name: string }) => n.name.includes(q), {
        refinesPrevious: inPreview && q.includes(lastQuery),
      });
      lastQuery = q;
      const exp = new Set(previewBase);
      ALL.filter((i) => i.includes(q)).forEach((i) => exp.add(i));
      expect(key(s.selected), `predicate '${q}' post-condition` + ctx()).toBe(key(exp));
    } else if (r < 0.62) {
      kind = "cancelPredicate";
      s.cancelPredicate();
      if (previewBase) expect(key(s.selected), "cancel restores preview base" + ctx()).toBe(key(previewBase));
      else expect(key(s.selected), "cancel without preview is a no-op" + ctx()).toBe(key(before));
    } else if (r < 0.66) {
      kind = "commit";
      s.commit();
    } else if (r < 0.7) {
      kind = "apply";
      const f = rand() < 0.5 ? tt : ff;
      const dom = ALL.filter(() => rand() < 0.3);
      s.apply(f, dom);
      const exp = new Set(before);
      dom.forEach((i) => (f === tt ? exp.add(i) : exp.delete(i)));
      expect(key(s.selected), "apply post-condition" + ctx()).toBe(key(exp));
    } else if (r < 0.82) {
      kind = "undo";
      s.undo();
    } else if (r < 0.9) {
      kind = "redo";
      const hadExpect = redoExpect.length > 0;
      const expected = redoExpect[redoExpect.length - 1];
      s.redo();
      if (hadExpect) {
        expect(key(s.selected), "I3 redo restores" + ctx()).toBe(expected);
        redoExpect.pop();
      }
    } else if (r < 0.95) {
      kind = "setGeometry";
      const visible = ALL.filter(() => rand() < 0.7);
      geom = new ListGeometry(visible, ALL, rand() < 0.2 ? "grid" : "list", clamp);
      s.setGeometry(geom);
    } else {
      kind = "cancelSince";
      // Tokens are deliberately kept stale across other actions: the engine
      // must refuse to retract anything but the current run of clicks.
      if (lastToken !== null) s.cancelSince(lastToken);
    }

    trace.push(`${kind}${kind.includes("lick") || kind === "shift" ? `@${y}` : ""} -> gen ${s.generation}`);
    // --- bookkeeping ------------------------------------------------------
    const now = key(s.selected);
    const gen = s.generation;
    // setGeometry keeps a live preview; cancelSince is refused while one is live;
    // an action that does nothing leaves it alone.
    if (kind !== "predicate" && kind !== "setGeometry" && kind !== "cancelSince" && !noOp) {
      previewBase = null; // any other gesture ends the preview
      lastQuery = "";
    }
    if (kind === "setGeometry" && previewBase === null) lastQuery = "";

    // I1: whole pairs only
    expect(stackSize(s) % 2, `I1 at step ${step} (${kind})` + ctx()).toBe(0);

    if (kind === "undo") {
      if (gen < genBefore) {
        // I2: back to exactly what was seen at that level
        if (observed.has(gen)) expect(now, `I2 at step ${step}` + ctx()).toBe(observed.get(gen));
        // I4: a real step always changes the selection
        expect(now, `I4 dead undo at step ${step}` + ctx()).not.toBe(key(before));
        redoExpect.push(key(before));
      }
    } else if (kind !== "redo") {
      if (s.redoDepth < redoExpect.length) redoExpect = redoExpect.slice(0, s.redoDepth);
    }

    // I5: nothing active after sealing actions
    if (kind === "undo" || kind === "redo" || kind === "commit" || kind === "apply") {
      expect(s.activeIndices.size, `I5 at step ${step}` + ctx()).toBe(0);
    }

    // I6: cursor identity matches its coordinates
    if (s.cursorId !== null && s.cursor) {
      expect(geom.m2v(s.cursor), `I6 cursor at step ${step}` + ctx()).toBe(s.cursorId);
    }

    observed.set(gen, now);
  }
}

describe("Property: gesture sequences preserve history invariants", () => {
  for (let seed = 1; seed <= 60; seed++) {
    it(`seed ${seed} (global click scope)`, () => runRandom(seed * 104729, 150, "global"));
  }
  for (let seed = 1; seed <= 30; seed++) {
    it(`seed ${seed} (visible click scope)`, () => runRandom(seed * 7919 + 3, 150, "visible"));
  }
  // Blank-space anchors span nothing here, as in the real tree (ListGeometry clamps them by default).
  it("seeds 1-30 (global click scope, blank anchors span nothing)", () => {
    for (let seed = 1; seed <= 30; seed++) {
      try {
        runRandom(seed * 7907 + 11, 150, "global", false);
      } catch (e) {
        throw new Error(`seed ${seed}: ${(e as Error).message}`, { cause: e });
      }
    }
  });
});
