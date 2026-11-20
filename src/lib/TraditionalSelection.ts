// File: lib/TraditionalSelection.ts
//
// Baseline for the user study: conventional file-manager multi-selection,
// modelled as a plain set with no history. It reuses the same geometries as
// the algebraic engine, so hit-testing, lasso strategies and keyboard
// stepping are identical; only the selection semantics differ.
//
// Where desktop file managers disagree, the behaviour is an option, and two
// presets approximate Windows Explorer and macOS Finder (see
// TRADITIONAL_PRESETS; both checked against the real systems, 2026-10).

import type { PathCache, SelectionFn, SelectionGeometry, StrategyName } from "./multiselect";
import { keyboardTarget, type ContextChange, type EngineCapabilities, type SelectionEngine } from "./SelectionEngine";

export interface TraditionalOptions {
  /**
   * Shift-click / shift+arrow:
   * - "replace": the selection becomes exactly the range anchor..target (Windows).
   * - "extend":  the range is added to the selection that existed before the
   *              run of shift presses began (Finder list view).
   *              Known difference (Finder test 13, 2026-11-19): when a later
   *              Shift-press shrinks the range, real Finder also deselects files
   *              that were selected before the run; this preset restores them.
   */
  shiftClick: "replace" | "extend";
  /**
   * Shift-click on an item in the grid (default "range"; Shift+arrow keys always use
   * shiftClick):
   * - "range":  as in the list (the shiftClick option).
   * - "toggle": toggles the item, like a Ctrl/Cmd-click, which also moves the anchor
   *             (Finder icon view, checked 2026-10-16).
   */
  shiftClickInGrid?: "range" | "toggle";
  /**
   * Ctrl/Cmd + drag:
   * - "toggle": items in the lasso flip relative to the selection at press (Windows).
   * - "add":    items in the lasso are added.
   * Finder also toggles (checked 2026-10-16), so neither preset uses "add".
   */
  modifierDrag: "toggle" | "add";
  /**
   * Ctrl/Cmd+Shift-click (default "shift"):
   * - "mode":  the range anchor..target is added to the selection as it was before
   *            the run of Ctrl+Shift-clicks, or removed from it if the last
   *            Ctrl-click deselected (Windows Explorer, checked 2026-10-11; Järvi &
   *            Parent 2016, §2.2). Each Ctrl+Shift-click moves the range's end.
   *            Known difference (2026-11-19): real Explorer only adds, so pulling
   *            the range back leaves the overshoot selected; this preset removes it.
   * - "shift": the same as a Shift-click.
   * - "toggle": the same as a Ctrl/Cmd-click (Finder list view, checked 2026-10-16).
   */
  ctrlShiftClick?: "mode" | "shift" | "toggle";
  /**
   * Shift + press in empty space, then drag (default "range"):
   * - "add":   a rectangle whose items are added to the selection at the press;
   *            pulling it back restores that selection (Windows Explorer, checked
   *            2026-10-11; Finder, checked 2026-10-16).
   * - "range": a Shift-click range from the anchor to the pointer.
   */
  shiftDragInSpace?: "add" | "range";
  /** Context changes that clear the selection (and the anchor/focus). */
  clearOn: readonly ContextChange[];
  /** Deferred flush for drag work; defaults to requestAnimationFrame. */
  scheduleFlush?: (cb: () => void) => void;
}

export const TRADITIONAL_PRESETS = {
  // Checked against Explorer on Windows 11 (2026-10-11; docs/study-methodology.md, revision 13).
  windows: {
    shiftClick: "replace",
    modifierDrag: "toggle",
    ctrlShiftClick: "mode",
    shiftDragInSpace: "add",
    clearOn: ["filter", "navigate"],
  },
  // Checked against Finder (2026-10-16; docs/study-methodology.md, revision 14). Not yet
  // checked: whether a Shift-click toggle in icon view moves the anchor (assumed: yes,
  // as a Cmd-click does), and Cmd+Shift-click in icon view (assumed: as in list view).
  mac: {
    shiftClick: "extend",
    shiftClickInGrid: "toggle",
    modifierDrag: "toggle",
    ctrlShiftClick: "toggle",
    shiftDragInSpace: "add",
    clearOn: ["filter", "navigate"],
  },
} as const satisfies Record<string, TraditionalOptions>;

export type TraditionalPreset = keyof typeof TRADITIONAL_PRESETS;

type Combine<T> = (base: ReadonlySet<T>, domain: ReadonlySet<T>) => Set<T>;

const replace = <T,>(_base: ReadonlySet<T>, domain: ReadonlySet<T>) => new Set(domain);
const union = <T,>(base: ReadonlySet<T>, domain: ReadonlySet<T>) => new Set([...base, ...domain]);
const difference = <T,>(base: ReadonlySet<T>, domain: ReadonlySet<T>) => {
  const out = new Set(base);
  domain.forEach((d) => out.delete(d));
  return out;
};
const xor = <T,>(base: ReadonlySet<T>, domain: ReadonlySet<T>) => {
  const out = new Set(base);
  domain.forEach((d) => (out.has(d) ? out.delete(d) : out.add(d)));
  return out;
};

interface Gesture<TIndex, TPoint> {
  /** Selection the gesture combines with (fixed at press). */
  base: ReadonlySet<TIndex>;
  /** How the current domain combines with the base. */
  combine: Combine<TIndex>;
  /** Combination used once the pointer moves (a drag). */
  dragCombine: Combine<TIndex>;
  path: TPoint[];
  /** Element under path[0] (null for an empty-space press); re-projected on geometry changes. */
  anchorId: TIndex | null;
  cache: PathCache;
  strategyOverride?: StrategyName;
}

const defaultSchedule = (cb: () => void) => {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(cb);
  else queueMicrotask(cb);
};

export class TraditionalSelection<TIndex, TPoint> implements SelectionEngine<TIndex, TPoint> {
  public readonly capabilities: EngineCapabilities = { undo: false, predicate: false, clickScope: false };

  private _geometry: SelectionGeometry<TIndex, TPoint>;
  private _onRefresh: (changed: Map<TIndex, boolean>) => void;
  private _opts: TraditionalOptions;
  private _schedule: (cb: () => void) => void;

  /** Replaced (never mutated) on every change, so old references stay valid snapshots. */
  private _selected: ReadonlySet<TIndex> = new Set();
  private _gesture: Gesture<TIndex, TPoint> | null = null;
  /** Domain of the current gesture (shown as the active outline). */
  private _domain: ReadonlySet<TIndex> = new Set();
  private _dirty = false;
  /** Range anchor: the last item clicked or cmd-clicked (not moved by shift). */
  private _anchor: { point: TPoint; id: TIndex } | null = null;
  /** Anchor from load(…, focus), located by ID on the next setGeometry. */
  private _pendingAnchorId: TIndex | null = null;
  private _cursor: TPoint | undefined;
  private _cursorId: TIndex | null = null;
  /** Selection before the current run of shift presses ("extend" mode). */
  private _shiftBase: ReadonlySet<TIndex> | null = null;
  /** Selection before the current run of Ctrl+Shift presses (ctrlShiftClick "mode"). */
  private _ctrlShiftBase: ReadonlySet<TIndex> | null = null;
  /** Whether the anchor was set by selecting or by deselecting (the last Ctrl-click's mode). */
  private _anchorMode: "select" | "deselect" = "select";
  /** Selections before each click of the current run of plain clicks (double-click retraction). */
  private _clickRun: Map<number, ReadonlySet<TIndex>> | null = null;
  private _token = 0;

  constructor(
    geometry: SelectionGeometry<TIndex, TPoint>,
    onRefresh: (changed: Map<TIndex, boolean>) => void,
    options: TraditionalOptions,
  ) {
    this._geometry = geometry;
    this._onRefresh = onRefresh;
    this._opts = options;
    this._schedule = options.scheduleFlush ?? defaultSchedule;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private setSelection(next: ReadonlySet<TIndex>) {
    const before = this._selected;
    this._selected = next;
    const changes = new Map<TIndex, boolean>();
    before.forEach((i) => {
      if (!next.has(i)) changes.set(i, false);
    });
    next.forEach((i) => {
      if (!before.has(i)) changes.set(i, true);
    });
    this._onRefresh(changes);
  }

  private setCursor(p: TPoint | undefined) {
    this._cursor = p;
    this._cursorId = p === undefined ? null : this._geometry.m2v(p);
  }

  private endGesture() {
    this.flush();
    this._gesture = null;
    this._domain = new Set();
  }

  private pressDomain(p: TPoint): ReadonlySet<TIndex> {
    const id = this._geometry.m2v(p);
    return new Set(id === null ? [] : [id]);
  }

  private markDirty() {
    if (this._dirty) return;
    this._dirty = true;
    this._schedule(() => this.flush());
  }

  // ---------------------------------------------------------------------------
  // Gestures
  // ---------------------------------------------------------------------------

  public flush(): void {
    if (!this._dirty) return;
    this._dirty = false;
    const g = this._gesture;
    if (!g) return;
    this._domain = this._geometry.selectionDomain(g.path, new Set(this._domain), g.cache, g.strategyOverride);
    this.setSelection(g.combine(g.base, this._domain));
  }

  /** Plain click: select only the item under p (nothing, in empty space). */
  public click(p: TPoint): number {
    this.endGesture();
    const token = ++this._token;
    if (!this._clickRun) this._clickRun = new Map();
    this._clickRun.set(token, this._selected);
    this._shiftBase = null;
    this._ctrlShiftBase = null;

    const domain = this.pressDomain(p);
    const id = this._geometry.m2v(p);
    // Clicking empty space clears the selection but keeps the range anchor.
    if (id !== null) {
      this._anchor = { point: p, id };
      this._anchorMode = "select";
    }
    this._pendingAnchorId = null;
    this.setCursor(p);
    this._gesture = { base: new Set(), combine: replace, dragCombine: replace, path: [p], anchorId: id, cache: {} };
    this._domain = domain;
    this.setSelection(new Set(domain));
    return token;
  }

  /** Ctrl/Cmd-click: toggle the item under p; a following drag uses modifierDrag. */
  public cmdClick(p: TPoint): void {
    this.endGesture();
    this._clickRun = null;
    this._shiftBase = null;
    this._ctrlShiftBase = null;

    const base = this._selected;
    const domain = this.pressDomain(p);
    const id = this._geometry.m2v(p);
    if (id !== null) {
      this._anchor = { point: p, id };
      this._anchorMode = base.has(id) ? "deselect" : "select";
    }
    this._pendingAnchorId = null;
    this.setCursor(p);
    this._gesture = {
      base,
      combine: xor,
      dragCombine: this._opts.modifierDrag === "toggle" ? xor : union,
      path: [p],
      anchorId: id,
      cache: {},
    };
    this._domain = domain;
    this.setSelection(xor(base, domain));
  }

  /**
   * Shift-press: range from the anchor to p, replacing or extending (shiftClick
   * option); see also shiftDragInSpace and shiftClickInGrid.
   */
  public shiftClick(p: TPoint, strategyOverride?: StrategyName): void {
    const onItem = this._geometry.m2v(p) !== null;
    if (this._opts.shiftDragInSpace === "add" && !onItem) {
      // Empty space: a rectangle that adds to the selection; the anchor stays.
      this.endGesture();
      this._clickRun = null;
      this._ctrlShiftBase = null;
      this._shiftBase = null;
      this.setCursor(p);
      this._gesture = { base: this._selected, combine: union, dragCombine: union, path: [p], anchorId: null, cache: {} };
      this._domain = new Set();
      return;
    }
    if (this._opts.shiftClickInGrid === "toggle" && onItem && this._geometry.kind === "grid") {
      this.cmdClick(p);
      return;
    }
    this.shiftRange(p, strategyOverride);
  }

  /** Range from the anchor to p (Shift-click on an item, Shift+arrow keys). */
  private shiftRange(p: TPoint, strategyOverride?: StrategyName): void {
    this.endGesture();
    this._clickRun = null;
    this._ctrlShiftBase = null;
    if (!this._shiftBase) this._shiftBase = this._selected;
    const base = this._opts.shiftClick === "replace" ? new Set<TIndex>() : this._shiftBase;
    this.startRange(p, base, union, strategyOverride);
  }

  /** Ctrl/Cmd+Shift-press: see the ctrlShiftClick option. */
  public cmdShiftClick(p: TPoint): void {
    if (this._opts.ctrlShiftClick === "toggle") {
      this.cmdClick(p);
      return;
    }
    if (this._opts.ctrlShiftClick !== "mode") {
      this.shiftClick(p);
      return;
    }
    this.endGesture();
    this._clickRun = null;
    this._shiftBase = null;
    if (!this._ctrlShiftBase) this._ctrlShiftBase = this._selected;
    this.startRange(p, this._ctrlShiftBase, this._anchorMode === "deselect" ? difference : union);
  }

  /** A range gesture from the anchor (or p, without one) to p, combined with base. */
  private startRange(p: TPoint, base: ReadonlySet<TIndex>, combine: Combine<TIndex>, strategyOverride?: StrategyName) {
    const cache: PathCache = {};
    const anchor = this._anchor?.point ?? p;
    if (!this._anchor) {
      const id = this._geometry.m2v(p);
      if (id !== null) this._anchor = { point: p, id };
      this._pendingAnchorId = null;
    }
    const path = this._geometry.extendPath([anchor], p, cache) ?? [anchor, p];
    this.setCursor(p);
    this._gesture = {
      base,
      combine,
      dragCombine: combine,
      path,
      anchorId: this._geometry.m2v(path[0]),
      cache,
      strategyOverride,
    };
    this.markDirty();
  }

  public dragTo(p: TPoint): void {
    const g = this._gesture;
    if (!g) return;
    const path = this._geometry.extendPath(g.path, p, g.cache);
    if (!path) return;
    g.path = path;
    g.combine = g.dragCombine;
    g.strategyOverride = undefined;
    this.setCursor(p);
    this.markDirty();
  }

  // Navigation keys: same targets as the algebraic engine (keyboardTarget).

  public arrow(direction: string): void {
    this._clickRun = null;
    const p = keyboardTarget(this._geometry, this._cursor, direction);
    if (!p) return;
    this.click(p);
    this._clickRun = null;
  }

  public shiftArrow(direction: string): void {
    this.flush();
    const p = keyboardTarget(this._geometry, this._cursor, direction);
    // Always a range, also where a Shift-click toggles (shiftClickInGrid).
    if (p) this.shiftRange(p, "rowwise");
  }

  public cmdArrow(direction: string): void {
    this.flush();
    const p = keyboardTarget(this._geometry, this._cursor, direction);
    if (!p) return;
    this.setCursor(p);
    this._onRefresh(new Map());
  }

  public cancelSince(token: number): void {
    const run = this._clickRun;
    this._clickRun = null;
    if (!run) return;
    // A token from before the current run of clicks retracts the whole run, nothing older.
    const first = run.keys().next().value;
    const snapshot = run.get(token) ?? (first !== undefined && token < first ? run.get(first) : undefined);
    if (!snapshot) return;
    this.endGesture();
    this.setSelection(snapshot);
  }

  public commit(): void {
    this.endGesture();
    this._onRefresh(new Map());
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  /** Not supported by the baseline (no "select matching" in file managers). */
  public predicateSelect(): void {}
  public cancelPredicate(): void {}

  /** Select All / Deselect All. */
  public apply(f: SelectionFn, domain: Iterable<TIndex>): void {
    this.endGesture();
    this._clickRun = null;
    this._shiftBase = null;
    this._ctrlShiftBase = null;
    const next = new Set(this._selected);
    for (const d of domain) {
      if (f(next.has(d))) next.add(d);
      else next.delete(d);
    }
    this.setSelection(next);
  }

  /** No selection history in the baseline. */
  public undo(): void {}
  public redo(): void {}

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  public load(selected: Iterable<TIndex>, anchor: TIndex | null = null, focus: TIndex | null = anchor): void {
    this._selected = new Set(selected);
    this._gesture = null;
    this._domain = new Set();
    this._dirty = false;
    // Anchor and cursor are located now if the geometry has them, else by ID
    // in setGeometry.
    const point = anchor !== null ? this._geometry.locate(anchor) : null;
    this._anchor = point && anchor !== null ? { point, id: anchor } : null;
    this._pendingAnchorId = point ? null : anchor;
    this._cursor = focus !== null ? (this._geometry.locate(focus) ?? undefined) : undefined;
    this._cursorId = focus;
    this._shiftBase = null;
    this._ctrlShiftBase = null;
    this._anchorMode = "select";
    this._clickRun = null;
  }

  /** Same identity-based re-projection as the algebraic engine (fair comparison). */
  public setGeometry(geometry: SelectionGeometry<TIndex, TPoint>): void {
    if (geometry === this._geometry) return;
    this.flush();
    const kindChanged = geometry.kind !== this._geometry.kind;
    this._geometry = geometry;

    const anchorId = this._anchor?.id ?? this._pendingAnchorId;
    if (anchorId !== null) {
      const point = geometry.locate(anchorId);
      this._anchor = point ? { point, id: anchorId } : null;
      if (point) this._pendingAnchorId = null;
    }
    const g = this._gesture;
    if (g) {
      const start = g.anchorId !== null ? geometry.locate(g.anchorId) : null;
      if (start) {
        g.path = [start];
        g.cache = {};
      } else if (g.anchorId !== null || kindChanged) {
        this.endGesture();
      }
    }
    if (this._cursorId !== null) {
      const c = geometry.locate(this._cursorId);
      this._cursor = c ?? undefined;
      if (!c) this._cursorId = null;
    } else if (kindChanged) {
      this._cursor = undefined;
    }
    this._onRefresh(new Map());
  }

  public contextChanged(change: ContextChange): void {
    if (!this._opts.clearOn.includes(change)) return;
    this.endGesture();
    this._clickRun = null;
    this._shiftBase = null;
    this._ctrlShiftBase = null;
    this._anchorMode = "select";
    this._anchor = null;
    this._pendingAnchorId = null;
    this.setCursor(undefined);
    this.setSelection(new Set());
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  public get selected(): ReadonlySet<TIndex> {
    this.flush();
    return this._selected;
  }
  public get activeIndices(): ReadonlySet<TIndex> {
    return this._gesture ? this._domain : new Set();
  }
  public get cursor() {
    return this._cursor;
  }
  public get cursorId() {
    return this._cursorId;
  }
  public get selectionPath(): TPoint[] {
    return this._gesture?.path ?? [];
  }
  public get isBacktracking(): boolean {
    return !!this._gesture?.cache.removing;
  }
  public get activeStrategyName(): StrategyName | undefined {
    return this._gesture?.cache.activeStrategyName;
  }
  public get undoDepth(): number {
    return 0;
  }
  public get redoDepth(): number {
    return 0;
  }
}
