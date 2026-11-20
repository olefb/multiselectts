/**
 * Naive reference implementation of selection semantics.
 *
 * This mirrors the paper's model directly: a set S plus a stack of
 * (mode function, domain) pairs, evaluated by replaying from scratch.
 * It is intentionally dumb and slow so it can serve as an oracle
 * against the optimized AlgebraicStorage in property-based tests.
 */
import type { PrimitiveOperation } from "../multiselect";

export class ReferenceModel<TIndex> {
  private ops: PrimitiveOperation<TIndex>[] = [];
  private baked: Set<TIndex> = new Set();

  push(op: PrimitiveOperation<TIndex>): void {
    // Reference semantics: domain entries store previous generation *position*
    // (stack depth at push time); we replay positionally.
    const depthAtPush = this.ops.length;
    const opCopy: PrimitiveOperation<TIndex> = { f: op.f, domain: new Map() };
    op.domain.forEach((_, index) => {
      opCopy.domain.set(index, depthAtPush - 1);
    });
    this.ops.push(opCopy);
  }

  pop(): PrimitiveOperation<TIndex> | undefined {
    const op = this.ops.pop();
    if (!op) return undefined;
    return {
      f: op.f,
      domain: new Map(Array.from(op.domain.keys()).map((k) => [k, 0])),
    };
  }

  selected(): Set<TIndex> {
    const candidates = new Set([...this.baked, ...this.ops.flatMap((o) => Array.from(o.domain.keys()))]);
    const result = new Set<TIndex>();
    candidates.forEach((i) => {
      if (this.at(i)) result.add(i);
    });
    return result;
  }

  at(index: TIndex): boolean {
    let state = this.baked.has(index);
    for (const op of this.ops) {
      if (!op.domain.has(index)) continue;
      if (op.f === ttRef) state = true;
      else if (op.f === ffRef) state = false;
      else state = op.f(state);
    }
    return state;
  }

  bake(): void {
    if (this.ops.length === 0) return;
    const op = this.ops[0];
    op.domain.forEach((_, index) => {
      const newState = op.f(this.baked.has(index));
      if (newState) this.baked.add(index);
      else this.baked.delete(index);
    });
    this.ops.shift();
  }

  get size(): number {
    return this.ops.length;
  }
}

// Reference-mode identity functions (structurally identical to the engine's
// tt/ff; we compare by behavior, not identity).
const ttRef = (_b: boolean) => true;
const ffRef = (_b: boolean) => false;

export { ttRef, ffRef };
