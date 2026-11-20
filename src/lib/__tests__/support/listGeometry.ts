// Test helper: a minimal 1D list geometry where row r is the point {x: 0, y: r}.
import type { SelectionGeometry } from "../../multiselect";

export type P = { x: number; y: number };

export /**
 * Minimal 1D list geometry: row r is the point {x: 0, y: r}.
 * `clamp` (default): a path anchored in blank space starts at the nearest row.
 * `clamp: false`: like HierarchicalTreeGeometry, a path from or to blank space
 * spans nothing.
 */
class ListGeometry implements SelectionGeometry<string, P> {
  items: string[];
  all: string[];
  readonly kind: string;
  readonly clamp: boolean;
  constructor(items: string[], all: string[] = items, kind: string = "list", clamp = true) {
    this.items = items;
    this.all = all;
    this.kind = kind;
    this.clamp = clamp;
  }
  m2v(p: P) {
    return Number.isInteger(p.y) && p.y >= 0 && p.y < this.items.length ? this.items[p.y] : null;
  }
  extendPath(path: P[], p: P) {
    if (path.length === 0 || !this.clamp) return this.m2v(p) !== null ? (path.length === 0 ? [p] : [path[0], p]) : null;
    return [path[0], p];
  }
  selectionDomain(path: P[]) {
    const out = new Set<string>();
    if (path.length === 0 || this.items.length === 0) return out;
    if (!this.clamp && (this.m2v(path[0]) === null || this.m2v(path[path.length - 1]) === null)) return out;
    const clamp = (y: number) => Math.max(0, Math.min(this.items.length - 1, y));
    const a = clamp(path[0].y);
    const b = clamp(path[path.length - 1].y);
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(this.items[i]);
    return out;
  }
  step(dir: string, p: P) {
    const last = this.items.length - 1;
    if (dir === "HOME") return { x: 0, y: 0 };
    if (dir === "END") return { x: 0, y: last };
    const d = dir === "UP" ? -1 : dir === "DOWN" ? 1 : 0;
    return { x: 0, y: Math.max(0, Math.min(last, p.y + d)) };
  }
  defaultCursor(dir: string) {
    if (this.items.length === 0) return undefined;
    return { x: 0, y: dir === "UP" || dir === "END" ? this.items.length - 1 : 0 };
  }
  filter(pred: (n: { name: string }) => boolean, cand?: Set<string>) {
    return new Set(this.all.filter((i) => (!cand || cand.has(i)) && pred({ name: i })));
  }
  locate(id: string) {
    const i = this.items.indexOf(id);
    return i < 0 ? null : { x: 0, y: i };
  }
  visibleIndices() {
    return this.items;
  }
  rowOf(id: string) {
    const i = this.items.indexOf(id);
    return i < 0 ? null : i;
  }
}

export const row = (y: number): P => ({ x: 0, y });
