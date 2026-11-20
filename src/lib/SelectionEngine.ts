// File: lib/SelectionEngine.ts
//
// The seam between the UI and a selection model. The algebraic engine
// (SelectionState) implements it; the traditional baseline used in the user
// study implements it too, so both conditions run on identical UI, geometry
// and hit-testing, and differ only in selection semantics.

import type {
  ClickScope,
  SelectionFn,
  SelectionGeometry,
  StrategyName,
} from "./multiselect";

/** UI-level events that some models react to (e.g. a traditional file manager clears the selection). */
export type ContextChange = "filter" | "navigate" | "view";

/** Optional features; the UI hides controls a model does not support. */
export interface EngineCapabilities {
  undo: boolean;
  predicate: boolean;
  clickScope: boolean;
}

export interface SelectionEngine<TIndex, TPoint> {
  readonly capabilities: EngineCapabilities;

  // --- Pointer and keyboard gestures ---
  /** Plain click. Returns a token for cancelSince (double-click retraction). */
  click(p: TPoint): number;
  cmdClick(p: TPoint): void;
  /** Shift-press (or shift+arrow with strategyOverride "rowwise"). */
  shiftClick(p: TPoint, strategyOverride?: StrategyName): void;
  /**
   * Optional: Ctrl/Cmd+Shift press. Models without it treat it as shiftClick (in
   * the algebraic model a Shift-click already continues the last Ctrl-click's mode).
   */
  cmdShiftClick?(p: TPoint): void;
  /** Pointer moved while pressed: extends the current press gesture. */
  dragTo(p: TPoint): void;
  arrow(direction: string): void;
  shiftArrow(direction: string): void;
  cmdArrow(direction: string): void;
  /** Retracts the steps of the current run of clicks recorded after `token`. */
  cancelSince(token: number): void;
  /** Applies pending (batched) path work now. */
  flush(): void;
  /** Ends the current gesture or preview. */
  commit(): void;

  // --- Commands ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  predicateSelect(predicate: (item: any) => boolean, options?: { select?: boolean; refinesPrevious?: boolean }): void;
  cancelPredicate(): void;
  apply(f: SelectionFn, domain: Iterable<TIndex>): void;
  undo(): void;
  redo(): void;

  // --- Configuration ---
  /**
   * Replaces the whole state with this selection, outside the history (it
   * cannot be undone), e.g. a task's pre-selected items. Clears gestures,
   * anchor, cursor and history. Does not notify; the caller initialises its
   * own view of the selection. Optionally starts the range anchor (fixed end)
   * and the keyboard focus (active end, default: the anchor) on items, as if
   * the user had made the selection: a Shift-click then extends from them
   * (located now if the geometry has them, else by ID on the next setGeometry).
   */
  load(selected: Iterable<TIndex>, anchor?: TIndex | null, focus?: TIndex | null): void;
  setGeometry(geometry: SelectionGeometry<TIndex, TPoint>): void;
  /** Optional: only models with a configurable click scope implement this. */
  setClickScope?(scope: ClickScope): void;
  /** Optional: filter changed, folder navigated, or view switched. */
  contextChanged?(change: ContextChange): void;

  // --- State read by the UI after each refresh ---
  readonly selected: ReadonlySet<TIndex>;
  readonly activeIndices: ReadonlySet<TIndex>;
  readonly cursor: TPoint | undefined;
  readonly cursorId: TIndex | null;
  readonly selectionPath: TPoint[];
  readonly isBacktracking: boolean;
  readonly activeStrategyName: StrategyName | undefined;
  readonly undoDepth: number;
  readonly redoDepth: number;
}

/**
 * Creates an engine. `onRefresh` must be called after every state change with
 * the elements whose membership changed (it may be empty, e.g. cursor moves).
 */
export type SelectionEngineFactory<TIndex, TPoint> = (
  geometry: SelectionGeometry<TIndex, TPoint>,
  onRefresh: (changed: Map<TIndex, boolean>) => void,
) => SelectionEngine<TIndex, TPoint>;

/**
 * Where a navigation key (arrow, Home/End, PageUp/PageDown) takes the keyboard
 * cursor; shared by every model so the keyboard behaves identically in all
 * study conditions.
 *
 * - With a cursor: one step from it (`geometry.step`).
 * - Without one, the cursor is taken to be on the first item, as when Explorer
 *   opens a folder (checked on Windows 11, 2026-10-11): Down selects the item
 *   below the first one, Right the item after it. A relative key that cannot
 *   move from there (Up, Left) does nothing; Home and End still jump. This
 *   follows Explorer rather than Järvi & Parent (2016, §4.4.2), who use the
 *   default cursor without a step.
 * - Undefined if the result is not an element (e.g. an empty view after a
 *   filter with no matches): keyboard commands then do nothing, instead of
 *   clicking "nothing", which would clear the selection.
 */
export function keyboardTarget<TIndex, TPoint>(
  geometry: SelectionGeometry<TIndex, TPoint>,
  cursor: TPoint | undefined,
  direction: string,
): TPoint | undefined {
  const from = cursor ?? geometry.defaultCursor("HOME");
  if (from === undefined) return undefined;
  const p = geometry.step(direction, from);
  const id = geometry.m2v(p);
  if (id === null) return undefined;
  const jump = ["HOME", "END"].includes(direction.toUpperCase());
  if (cursor === undefined && !jump && id === geometry.m2v(from)) return undefined;
  return p;
}
