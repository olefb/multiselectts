import { keyboardTarget, type EngineCapabilities, type SelectionEngine } from "./SelectionEngine";

/**
 * Mathematical Primitives for Selection Algebra
 */
export type SelectionFn = (b: boolean) => boolean;

export const tt: SelectionFn = () => true;
export const ff: SelectionFn = () => false;
export const id: SelectionFn = (b) => b;
export const not: SelectionFn = (b) => !b;

export interface PrimitiveOperation<TIndex> {
  f: SelectionFn;
  /**
   * Maps item index to the absolute generation ID of the previous operation for this item.
   */
  domain: Map<TIndex, number>;
}

/** Named selection-domain strategies understood by the geometries. */
export type StrategyName = "rectangular" | "rowwise" | "mixed" | "snake";

/**
 * Scratch state a geometry may keep for the lifetime of one selection path
 * (incremental caches, snake backtracking flags, ...). Reset whenever a new
 * path starts or the path is re-anchored.
 */
export interface PathCache {
  /** Snake strategy: user is currently backtracking (erasing) the path. */
  removing?: boolean;
  /** Snake strategy: number of path points already folded into the domain. */
  k?: number;
  /** Rectangular strategy: last active-end coordinates. */
  lastX?: number;
  lastY?: number;
  /** Row-wise strategy: last anchor/end indices. */
  lastAnchor?: number;
  lastEnd?: number;
  /** Mixed mode: which concrete strategy is in effect for this path. */
  activeStrategyName?: StrategyName;
}

/**
 * Strategy Interface for Geometry Calculation
 */
export interface SelectionGeometry<TIndex, TPoint> {
  /**
   * Identifies the coordinate space ("tree", "grid", ...). Coordinates are only
   * carried across a geometry swap when both geometries share the same kind.
   */
  readonly kind: string;
  m2v(point: TPoint): TIndex | null;
  extendPath(path: TPoint[], newPoint: TPoint, cache?: PathCache): TPoint[] | null;
  selectionDomain(
    path: TPoint[],
    J?: Set<TIndex>,
    cache?: PathCache,
    strategyOverride?: StrategyName,
  ): Set<TIndex>;
  step(direction: string, currentPoint: TPoint): TPoint;
  defaultCursor(direction: string): TPoint | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter(predicate: (item: any) => boolean, candidates?: Set<TIndex>): Set<TIndex>;
  /** Canonical point of a (currently visible) element, or null if it is not visible. */
  locate(index: TIndex): TPoint | null;
  /** All elements currently projected into this geometry (the visible set V). */
  visibleIndices(): Iterable<TIndex>;
  /** Virtual row (for scroll-into-view) of a visible element, or null. */
  rowOf(index: TIndex): number | null;
}

/**
 * Which elements a plain click deselects before selecting its target.
 * - "global":  every selected element (classic desktop / paper semantics).
 * - "visible": only selected elements in the current projection; selections
 *              hidden by a filter or living in another folder survive.
 */
export type ClickScope = "global" | "visible";

export interface SelectionOptions {
  /** Number of undoable steps kept before the oldest is baked. Default 100. */
  maxUndo?: number;
  /** Offer undo/redo to the user (default true). Off: undo() and redo() do nothing. */
  undo?: boolean;
  clickScope?: ClickScope;
  /**
   * Schedules a deferred flush of a path gesture. Defaults to
   * requestAnimationFrame when available; tests can inject a no-op and
   * call flush() explicitly.
   */
  scheduleFlush?: (cb: () => void) => void;
}

const SelectionMode = {
  NONE: 0,
  PATH: 1,
  PREDICATE: 2,
} as const;

type SelectionMode = (typeof SelectionMode)[keyof typeof SelectionMode];

type OpPair<TIndex> = [PrimitiveOperation<TIndex>, PrimitiveOperation<TIndex>];

/**
 * AlgebraicStorage handles the history stack and functional composition.
 */
class AlgebraicStorage<TIndex> {
  private _ops: Map<number, PrimitiveOperation<TIndex>> = new Map();
  private _baked: Set<TIndex>;
  private _domainMeta: Map<TIndex, number> = new Map();
  private _currentGen: number = 0;
  private _oldestGen: number = 0;
  /** Memoized result of selectedIndices; invalidated by every mutation. */
  private _selectedCache: ReadonlySet<TIndex> | null = null;

  /** `initial` becomes the baked base state: selected, but not part of any undoable step. */
  constructor(initial: Iterable<TIndex> = []) {
    this._baked = new Set(initial);
  }

  public at(index: TIndex): boolean {
    const latestGen = this._domainMeta.get(index);
    return this.evaluate(latestGen ?? -1, index);
  }

  private evaluate(gen: number, index: TIndex): boolean {
    if (gen <= this._oldestGen) return this._baked.has(index);
    const op = this._ops.get(gen);
    if (!op) return this._baked.has(index);
    if (op.f === tt) return true;
    if (op.f === ff) return false;
    const prevGen = op.domain.get(index) ?? -1;
    return op.f(this.evaluate(prevGen, index));
  }

  public push(op: PrimitiveOperation<TIndex>): void {
    const newGen = ++this._currentGen;
    op.domain.forEach((_, index) => {
      const prevGen = this._domainMeta.get(index) ?? -1;
      op.domain.set(index, prevGen);
      this._domainMeta.set(index, newGen);
    });
    this._ops.set(newGen, op);
    this._selectedCache = null;
  }

  public pop(): PrimitiveOperation<TIndex> | undefined {
    if (this._ops.size === 0) return undefined;
    const gen = this._currentGen;
    const op = this._ops.get(gen);
    if (!op) return undefined;
    op.domain.forEach((prevGen, index) => {
      if (prevGen <= this._oldestGen) this._domainMeta.delete(index);
      else this._domainMeta.set(index, prevGen);
    });
    this._ops.delete(gen);
    this._currentGen--;
    this._selectedCache = null;
    return op;
  }

  public bake(): void {
    const gen = this._oldestGen + 1;
    const op = this._ops.get(gen);
    if (!op) return;
    op.domain.forEach((_, index) => {
      const newState = op.f(this._baked.has(index));
      if (newState) this._baked.add(index);
      else this._baked.delete(index);
      if (this._domainMeta.get(index) === gen) this._domainMeta.delete(index);
    });
    this._ops.delete(gen);
    this._oldestGen = gen;
    this._selectedCache = null;
  }

  /** Read-only view; a fresh Set is built after each mutation, never mutated in place. */
  public get selectedIndices(): ReadonlySet<TIndex> {
    if (this._selectedCache) return this._selectedCache;
    const result = new Set<TIndex>();
    const candidates = new Set([...this._baked, ...this._domainMeta.keys()]);
    candidates.forEach((i) => {
      if (this.at(i)) result.add(i);
    });
    this._selectedCache = result;
    return result;
  }

  public get size(): number {
    return this._ops.size;
  }
  /** Absolute generation of the top operation (monotone under push, decremented by pop). */
  public get generation(): number {
    return this._currentGen;
  }
  public get top() {
    return this._ops.get(this._currentGen);
  }
  public get top2() {
    return this._ops.get(this._currentGen - 1);
  }
}

const defaultSchedule = (cb: () => void) => {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(cb);
  else queueMicrotask(cb);
};

/**
 * SelectionState: gesture layer over AlgebraicStorage.
 *
 * History invariants (checked by the gesture property tests):
 *  1. Every user step is exactly one (op, op) pair; the stack size is always even.
 *  2. Only an *open* gesture may modify the top pair. undo/redo/commit/apply
 *     and the start of any other gesture seal it; sealed steps never change.
 *  3. A sealed pair that turned out to have no effect is dropped, so there are
 *     no "dead" undo steps, and a dropped pair does not discard the redo stack.
 *  4. Anchors and the keyboard cursor are tracked by element identity and are
 *     re-projected when the geometry (view, filter, expansion) changes.
 */
export class SelectionState<TIndex, TPoint> implements SelectionEngine<TIndex, TPoint> {
  public readonly capabilities: EngineCapabilities;
  private _storage = new AlgebraicStorage<TIndex>();
  private _geometry: SelectionGeometry<TIndex, TPoint>;
  private _spath: TPoint[] = [];
  private _anchorId: TIndex | null = null;
  /**
   * The element that anchored the latest gesture anchored on an element.
   * Unlike _anchorId it survives the end of the gesture and a press in blank
   * space (see shiftClick). Tracked by identity, located when used.
   */
  private _itemAnchorId: TIndex | null = null;
  private _cursor: TPoint | undefined;
  private _cursorId: TIndex | null = null;
  private _redoStack: OpPair<TIndex>[] = [];
  /** Redo stack set aside by the open step; restored if that step is dropped as a no-op. */
  private _stashedRedo: OpPair<TIndex>[] | null = null;
  private _maxUndo: number;
  private _onRefresh: (changed: Map<TIndex, boolean>) => void;
  private _mode: SelectionMode = SelectionMode.NONE;
  /** True while the top pair belongs to the current path gesture and may be rewritten by flush(). */
  private _ownsTop = false;
  private _spathCache: PathCache = {};
  private _lastPredicateResults: Set<TIndex> | null = null;
  private _isDirty = false;
  private _strategyOverride?: StrategyName;
  private _clickScope: ClickScope;
  /**
   * Start generation of the current uninterrupted run of plain clicks (the
   * clicks of a double-click), and the redo stack at that moment. cancelSince
   * only retracts steps inside this run.
   */
  private _clickRun: { start: number; redo: OpPair<TIndex>[] } | null = null;
  private _schedule: (cb: () => void) => void;

  constructor(
    geometry: SelectionGeometry<TIndex, TPoint>,
    onRefresh: (changed: Map<TIndex, boolean>) => void,
    options: number | SelectionOptions = {},
  ) {
    const opts: SelectionOptions =
      typeof options === "number" ? { maxUndo: options } : options;
    this._geometry = geometry;
    this._onRefresh = onRefresh;
    this._maxUndo = (opts.maxUndo ?? 100) * 2;
    this._clickScope = opts.clickScope ?? "global";
    this._schedule = opts.scheduleFlush ?? defaultSchedule;
    this.capabilities = { undo: opts.undo !== false, predicate: true, clickScope: true };
  }

  public load(selected: Iterable<TIndex>, anchor: TIndex | null = null, focus: TIndex | null = anchor): void {
    this._storage = new AlgebraicStorage<TIndex>(selected);
    this._isDirty = false;
    this._redoStack = [];
    this._stashedRedo = null;
    this._clickRun = null;
    this._mode = SelectionMode.NONE;
    this._ownsTop = false;
    this._spath = [];
    this._anchorId = null;
    this._itemAnchorId = anchor;
    this._spathCache = {};
    this._lastPredicateResults = null;
    this._strategyOverride = undefined;
    // A Shift-click with no open gesture adds a range from the keyboard cursor
    // (shiftClick), so the focus only needs to become the cursor (located now
    // if the geometry has it, else by ID in setGeometry). The anchor makes no
    // difference here: the range is added to the selection either way.
    this._cursorId = focus;
    this._cursor = focus !== null ? (this._geometry.locate(focus) ?? undefined) : undefined;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private emit(before: ReadonlySet<TIndex>) {
    const after = this._storage.selectedIndices;
    const changes = new Map<TIndex, boolean>();
    if (after !== before) {
      before.forEach((i) => {
        if (!after.has(i)) changes.set(i, false);
      });
      after.forEach((i) => {
        if (!before.has(i)) changes.set(i, true);
      });
    }
    // Always notify, so the UI can update the lasso path, active outlines and cursor.
    this._onRefresh(changes);
  }

  private setToMap(set: Iterable<TIndex>): Map<TIndex, number> {
    const m = new Map<TIndex, number>();
    for (const i of set) m.set(i, 0);
    return m;
  }

  private setAnchor(p: TPoint) {
    this._spath = [p];
    this._anchorId = this._geometry.m2v(p);
    this._spathCache = {};
  }

  private setCursor(p: TPoint | undefined) {
    this._cursor = p;
    this._cursorId = p === undefined ? null : this._geometry.m2v(p);
  }

  /** Starts a new undoable step. The redo stack is stashed, not discarded, until the step is sealed. */
  private beginPair(first: PrimitiveOperation<TIndex>, second: PrimitiveOperation<TIndex>) {
    this._stashedRedo = this._redoStack;
    this._redoStack = [];
    this._storage.push(first);
    this._storage.push(second);
    this.checkBake();
  }

  /** True if the top pair changes the selection of at least one element. */
  private topPairHasEffect(): boolean {
    const top = this._storage.top;
    const top2 = this._storage.top2;
    if (!top || !top2) return true;
    const keys = new Set<TIndex>([...top.domain.keys(), ...top2.domain.keys()]);
    if (keys.size === 0) return false;
    const after = new Map<TIndex, boolean>();
    keys.forEach((k) => after.set(k, this._storage.at(k)));
    const b = this._storage.pop()!;
    const a = this._storage.pop()!;
    let changed = false;
    for (const k of keys) {
      if (this._storage.at(k) !== after.get(k)) {
        changed = true;
        break;
      }
    }
    this._storage.push(a);
    this._storage.push(b);
    return changed;
  }

  /** Seals the step on top of the stack; drops it if it had no effect. */
  private sealTop() {
    const owned = this._ownsTop || this._mode === SelectionMode.PREDICATE;
    if (owned && this._storage.size >= 2 && !this.topPairHasEffect()) {
      this._storage.pop();
      this._storage.pop();
      if (this._stashedRedo) this._redoStack = this._stashedRedo;
    }
    this._stashedRedo = null;
    this._ownsTop = false;
  }

  /** Finishes whatever gesture is in progress, without notifying the UI. */
  private endGesture() {
    this.flush();
    this.sealTop();
    this._mode = SelectionMode.NONE;
    this._spath = [];
    this._anchorId = null;
    this._spathCache = {};
    this._lastPredicateResults = null;
    this._strategyOverride = undefined;
  }

  private markDirty() {
    if (this._isDirty) return;
    this._isDirty = true;
    this._schedule(() => this.flush());
  }

  private clickClearDomain(): Iterable<TIndex> {
    const selected = this._storage.selectedIndices;
    if (this._clickScope === "global") return selected;
    const visible = new Set(this._geometry.visibleIndices());
    return [...selected].filter((i) => visible.has(i));
  }

  private checkBake() {
    while (this._storage.size > this._maxUndo) this._storage.bake();
  }

  // ---------------------------------------------------------------------------
  // Gestures
  // ---------------------------------------------------------------------------

  /**
   * Recomputes the domain of the open path gesture from the current path.
   * Path extensions are batched (one flush per animation frame).
   */
  public flush(): void {
    if (!this._isDirty) return;
    this._isDirty = false;
    if (!this._ownsTop) return; // never rewrite a sealed step
    const before = this._storage.selectedIndices;
    const lastOp = this._storage.pop()!;
    const newDomain = this._geometry.selectionDomain(
      this._spath,
      new Set(lastOp.domain.keys()),
      this._spathCache,
      this._strategyOverride,
    );
    this._storage.push({ f: lastOp.f, domain: this.setToMap(newDomain) });
    this.emit(before);
  }

  /**
   * Plain click: clear (per clickScope) and select the element under p.
   * Returns a token (history generation before the click) that can be
   * passed to cancelSince() to retract the click, e.g. on double-click.
   */
  public click(p: TPoint): number {
    const before = this._storage.selectedIndices;
    this.endGesture();
    const token = this._storage.generation;
    if (!this._clickRun) this._clickRun = { start: token, redo: this._redoStack };
    this._mode = SelectionMode.PATH;
    const index = this._geometry.m2v(p);
    this.setAnchor(p);
    if (index !== null) this._itemAnchorId = index;
    this.setCursor(p);
    this.beginPair(
      { f: ff, domain: this.setToMap(this.clickClearDomain()) },
      { f: tt, domain: this.setToMap(index !== null ? [index] : []) },
    );
    this._ownsTop = true;
    this.emit(before);
    return token;
  }

  public cmdClick(p: TPoint): void {
    this._clickRun = null;
    const before = this._storage.selectedIndices;
    this.endGesture();
    this._mode = SelectionMode.PATH;
    this.setAnchor(p);
    this.setCursor(p);
    const index = this._geometry.m2v(p);
    if (index !== null) {
      this._itemAnchorId = index;
      const modeFn = this._storage.at(index) ? ff : tt;
      this.beginPair({ f: id, domain: new Map() }, { f: modeFn, domain: this.setToMap([index]) });
      this._ownsTop = true;
    }
    // Empty space: only the anchor is recorded; a subsequent drag opens the step.
    this.emit(before);
  }

  /**
   * Shift-press: extends the path to p (see extendTo).
   *
   * A press in blank space anchors the path at a point that is no element.
   * The grid spans a rectangle from such a point, but the tree cannot form a
   * range from it, so every Shift-press after a click in blank space selected
   * nothing until the next click on an item. Such a dead anchor is replaced
   * by the last element anchor, as Explorer (and the Windows-like baseline)
   * keep the range anchor when blank space is clicked; if that element is not
   * visible, by p itself. Drags are unchanged: dragTo extends the path as it is.
   */
  public shiftClick(p: TPoint, strategyOverride?: StrategyName): void {
    this.reanchorDeadAnchor(p, strategyOverride);
    this.extendTo(p, strategyOverride);
  }

  /** Moves a dead blank-space anchor (one that spans nothing up to p) to the last element anchor. */
  private reanchorDeadAnchor(p: TPoint, strategyOverride?: StrategyName): void {
    const anchor = this._spath[0];
    if (anchor === undefined || this._mode === SelectionMode.PREDICATE) return;
    if (this._geometry.m2v(anchor) !== null || this._geometry.m2v(p) === null) return;
    if (this._geometry.selectionDomain([anchor, p], undefined, {}, strategyOverride).size > 0) return;
    const kept = this._itemAnchorId !== null ? this._geometry.locate(this._itemAnchorId) : null;
    const start = kept ?? p;
    this._spath = [start];
    this._anchorId = this._geometry.m2v(start);
    this._spathCache = {};
  }

  /** Extends the open path to p, or opens a new additive step anchored as described below. */
  private extendTo(p: TPoint, strategyOverride?: StrategyName): void {
    if (this._mode === SelectionMode.PREDICATE) this.endGesture();

    if (!this._ownsTop) {
      // No open gesture (after undo, redo, commit, a predicate, or a cmd-click
      // in empty space): open a NEW additive step instead of rewriting history.
      // Anchor priority: a spatial anchor recorded by a cmd-click in empty
      // space (a dead one was moved by shiftClick), then the keyboard cursor,
      // then the pointer itself.
      const cache: PathCache = {};
      let base: TPoint[] | null = this._spath.length > 0 ? [this._spath[0]] : null;
      for (const q of [this._cursor, p]) {
        if (base || q === undefined) continue;
        base = this._geometry.extendPath([], q, cache);
      }
      if (!base) return;
      this._clickRun = null;
      const path = this._geometry.extendPath(base, p, cache) ?? base;
      const before = this._storage.selectedIndices;
      this.endGesture();
      this._mode = SelectionMode.PATH;
      this._spath = path;
      this._anchorId = this._geometry.m2v(path[0]);
      if (this._anchorId !== null) this._itemAnchorId = this._anchorId;
      this._spathCache = cache;
      this._strategyOverride = strategyOverride;
      this.setCursor(p);
      this.beginPair({ f: id, domain: new Map() }, { f: tt, domain: new Map() });
      this._ownsTop = true;
      this.emit(before);
      this.markDirty();
      return;
    }

    this._strategyOverride = strategyOverride;
    const newPath = this._geometry.extendPath(this._spath, p, this._spathCache);
    if (!newPath) return;
    this._spath = newPath;
    this.setCursor(p);
    this.markDirty();
  }

  /** Pointer moved while pressed. In the algebra this is the same as extending with shift. */
  public dragTo(p: TPoint): void {
    this.extendTo(p);
  }

  // Navigation keys go through keyboardTarget (shared with the baselines): no
  // effect when the target is not an element; with no cursor, a step from the first item.

  public arrow(direction: string): void {
    this._clickRun = null;
    const p = keyboardTarget(this._geometry, this._cursor, direction);
    if (p) this.click(p);
    this._clickRun = null; // a key press is not part of a double-click (as in the baselines)
  }

  public shiftArrow(direction: string): void {
    this._clickRun = null;
    this.flush();
    const p = keyboardTarget(this._geometry, this._cursor, direction);
    // Force rowwise strategy for keyboard range selection
    if (p) this.shiftClick(p, "rowwise");
  }

  public cmdArrow(direction: string): void {
    this._clickRun = null;
    this.flush();
    const p = keyboardTarget(this._geometry, this._cursor, direction);
    if (!p) return;
    this.setCursor(p);
    this._onRefresh(new Map());
  }

  /**
   * Live predicate preview. Repeated calls replace the preview; commit() seals
   * it and cancelPredicate() discards it.
   *
   * refinesPrevious: the caller guarantees that every element matching this
   * predicate also matched the previous predicate of the same preview (e.g.
   * the new substring query contains the old one). Only then are the previous
   * results used as the candidate set. The engine makes no assumption about
   * the predicate itself, so boolean/OR queries stay correct.
   */
  public predicateSelect(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    predicate: (item: any) => boolean,
    options: { select?: boolean; refinesPrevious?: boolean } = {},
  ): void {
    const { select = true, refinesPrevious = false } = options;
    this._clickRun = null;
    const before = this._storage.selectedIndices;
    const inPreview = this._mode === SelectionMode.PREDICATE;
    const source =
      inPreview && refinesPrevious && this._lastPredicateResults
        ? this._lastPredicateResults
        : undefined;
    const results = this._geometry.filter(predicate, source);
    const op: PrimitiveOperation<TIndex> = {
      f: select ? tt : ff,
      domain: this.setToMap(results),
    };

    if (inPreview) {
      this._storage.pop();
      this._storage.pop();
      this._storage.push({ f: id, domain: new Map() });
      this._storage.push(op);
    } else {
      this.endGesture();
      this.beginPair({ f: id, domain: new Map() }, op);
    }
    this._mode = SelectionMode.PREDICATE;
    this._lastPredicateResults = results;
    this.emit(before);
  }

  /** Discards an uncommitted predicate preview (no-op otherwise). */
  public cancelPredicate(): void {
    this._clickRun = null;
    if (this._mode !== SelectionMode.PREDICATE) return;
    const before = this._storage.selectedIndices;
    this._storage.pop();
    this._storage.pop();
    if (this._stashedRedo) this._redoStack = this._stashedRedo;
    this._stashedRedo = null;
    this._mode = SelectionMode.NONE;
    this._lastPredicateResults = null;
    this.emit(before);
  }

  /**
   * Applies f to an explicit domain as one sealed, undoable step
   * (Select All, Deselect All, ...). No step is recorded if nothing changes.
   */
  public apply(f: SelectionFn, domain: Iterable<TIndex>): void {
    this._clickRun = null;
    const before = this._storage.selectedIndices;
    this.endGesture();
    this.beginPair({ f: id, domain: new Map() }, { f, domain: this.setToMap(domain) });
    this._ownsTop = true;
    this.sealTop();
    this.emit(before);
  }

  public undo(): void {
    if (!this.capabilities.undo) return;
    this._clickRun = null;
    const before = this._storage.selectedIndices;
    this.endGesture();
    if (this._storage.size >= 2) {
      const op2 = this._storage.pop()!;
      const op1 = this._storage.pop()!;
      this._redoStack.push([op1, op2]);
      while (this._redoStack.length > this._maxUndo / 2) this._redoStack.shift();
    }
    this.emit(before);
  }

  public redo(): void {
    if (!this.capabilities.undo) return;
    this._clickRun = null;
    const before = this._storage.selectedIndices;
    this.endGesture();
    const pair = this._redoStack.pop();
    if (pair) {
      this._storage.push(pair[0]);
      this._storage.push(pair[1]);
      this.checkBake();
    }
    this.emit(before);
  }

  /**
   * Retracts every step recorded after `token` (from click()) and restores the
   * redo stack. Used when clicks turn out to belong to a double-click: the
   * click of the double-click itself, or a click on the same folder just
   * before it (a slow double-click). Only steps of the current, uninterrupted
   * run of plain clicks are retracted: a token from before the run (another
   * gesture came in between) retracts the whole run and nothing older.
   */
  public cancelSince(token: number): void {
    const run = this._clickRun;
    this._clickRun = null;
    if (!run) return;
    const from = Math.max(token, run.start);
    this.flush();
    if (this._storage.generation <= from) return;
    const before = this._storage.selectedIndices;
    while (this._storage.generation > from && this._storage.size > 0) this._storage.pop();
    // Earlier clicks of the run that were not retracted keep the redo stack discarded.
    this._redoStack = from === run.start ? run.redo : [];
    this._stashedRedo = null;
    this._ownsTop = false;
    this.endGesture();
    this.emit(before);
  }

  public commit(): void {
    this._clickRun = null;
    const before = this._storage.selectedIndices;
    this.endGesture();
    this.emit(before);
  }

  /**
   * Swaps the coordinate space (view switch, filter, expand/collapse, resize).
   * Pending path work is flushed in the OLD space first. The anchor and cursor
   * are then re-projected by identity; an anchor that is no longer visible
   * ends the path gesture. A live predicate preview is left untouched.
   */
  public setGeometry(geometry: SelectionGeometry<TIndex, TPoint>): void {
    if (geometry === this._geometry) return;
    this.flush();
    const kindChanged = geometry.kind !== this._geometry.kind;
    this._geometry = geometry;

    if (this._spath.length > 0) {
      const anchor = this._anchorId !== null ? geometry.locate(this._anchorId) : null;
      if (anchor) {
        this._spath = [anchor];
        this._spathCache = {};
      } else if (this._anchorId !== null || kindChanged) {
        if (this._mode === SelectionMode.PATH) this.endGesture();
        else this._spath = [];
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

  public setClickScope(scope: ClickScope): void {
    this._clickScope = scope;
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  public get cursor() {
    return this._cursor;
  }
  public get cursorId(): TIndex | null {
    return this._cursorId;
  }
  public get selected(): ReadonlySet<TIndex> {
    this.flush();
    return this._storage.selectedIndices;
  }
  public isSelected(i: TIndex) {
    this.flush();
    return this._storage.at(i);
  }
  public get activeIndices(): Set<TIndex> {
    const open = this._ownsTop || this._mode === SelectionMode.PREDICATE;
    if (!open) return new Set();
    const top = this._storage.top;
    return top ? new Set(top.domain.keys()) : new Set();
  }
  public get selectionPath(): TPoint[] {
    return this._spath;
  }
  public get isBacktracking(): boolean {
    return !!this._spathCache.removing;
  }
  public get activeStrategyName(): StrategyName | undefined {
    return this._spathCache.activeStrategyName;
  }
  /** Number of undoable steps currently on the stack. */
  public get undoDepth(): number {
    return Math.floor(this._storage.size / 2);
  }
  public get redoDepth(): number {
    return this._redoStack.length;
  }
  /** Absolute history generation; changes whenever a step is pushed or popped. */
  public get generation(): number {
    return this._storage.generation;
  }
}
