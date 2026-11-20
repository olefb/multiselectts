// File: hooks/useSelection.ts

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  SelectionState,
  type ClickScope,
  type SelectionFn,
  type SelectionGeometry,
  type StrategyName,
} from "../lib/multiselect";
import type { ContextChange, SelectionEngine, SelectionEngineFactory } from "../lib/SelectionEngine";
import { useTelemetry } from "../telemetry/context";

export type Point = { x: number; y: number };

function emptyGeometry<TIndex>(): SelectionGeometry<TIndex, Point> {
  return {
    kind: "empty",
    m2v: () => null,
    extendPath: () => null,
    selectionDomain: () => new Set(),
    step: (_, p) => p,
    defaultCursor: () => undefined,
    filter: () => new Set(),
    locate: () => null,
    visibleIndices: () => [],
    rowOf: () => null,
  };
}

const sameSet = <T,>(a: ReadonlySet<T>, b: ReadonlySet<T>) =>
  a.size === b.size && [...a].every((x) => b.has(x));

const samePath = (a: Point[], b: Point[]) =>
  a.length === b.length && a.every((p, i) => p === b[i]);

export interface UseSelectionOptions<TIndex> {
  /** Click-scope policy, for engines that support it (setClickScope). */
  clickScope?: ClickScope;
  /**
   * Which selection model to run. Defaults to the algebraic engine
   * (SelectionState). Read once, when the component mounts.
   */
  createEngine?: SelectionEngineFactory<TIndex, Point>;
  /** Selected at start, outside the history (e.g. a task's pre-selection). Read once. */
  initialSelection?: Iterable<TIndex>;
  /** Range anchor (fixed end) at start, e.g. a task's `anchor`. Read once. */
  initialAnchor?: TIndex | null;
  /** Keyboard focus (active end) at start; defaults to the anchor. Read once. */
  initialFocus?: TIndex | null;
}

export type SelectionModel<TIndex> = ReturnType<typeof useSelection<TIndex>>;

/**
 * React bridge for a SelectionEngine (by default the algebraic SelectionState). The engine is created once with a
 * placeholder geometry; the component feeds the real geometry in through
 * setGeometry (inversion of control, avoids a dependency cycle with the
 * flattener, which itself depends on the selection).
 */
export function useSelection<TIndex>(options: UseSelectionOptions<TIndex> = {}) {
  const [selectedSet, setSelectedSet] = useState<Set<TIndex>>(() => new Set(options.initialSelection ?? []));
  const [activeSet, setActiveSet] = useState<Set<TIndex>>(() => new Set());
  const [cursor, setCursor] = useState<Point | undefined>();
  const [cursorId, setCursorId] = useState<TIndex | null>(null);
  const [spath, setSpath] = useState<Point[]>([]);
  const [isBacktracking, setIsBacktracking] = useState(false);
  const [strategyName, setStrategyName] = useState<StrategyName | undefined>();
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  // Read once, like the engine: the explorer remounts for a new session or task.
  const telemetry = useTelemetry();

  // Created once, on first render. Kept in state (not a ref) so it can be read during render.
  const [engine] = useState<SelectionEngine<TIndex, Point>>(() => {
    const createEngine: SelectionEngineFactory<TIndex, Point> =
      options.createEngine ??
      ((geometry, onRefresh) =>
        new SelectionState<TIndex, Point>(geometry, onRefresh, { clickScope: options.clickScope }));
    const created: SelectionEngine<TIndex, Point> = createEngine(
      emptyGeometry<TIndex>(),
      (changes: Map<TIndex, boolean>) => {
        // Only produce a new Set when membership actually changed, so that
        // memos depending on `selected` do not recompute on cursor moves.
        if (changes.size > 0) {
          const added: string[] = [];
          const removed: string[] = [];
          changes.forEach((value, id) => (value ? added : removed).push(String(id)));
          telemetry.record({
            type: "selection",
            added,
            removed,
            size: created.selected.size,
            undo: created.undoDepth,
            redo: created.redoDepth,
          });
          setSelectedSet((prev) => {
            const next = new Set(prev);
            changes.forEach((value, id) => {
              if (value) next.add(id);
              else next.delete(id);
            });
            return next;
          });
        }
        const active = new Set(created.activeIndices);
        setActiveSet((prev) => (sameSet(prev, active) ? prev : active));
        setCursor(created.cursor);
        setCursorId(created.cursorId);
        const path = created.selectionPath;
        setSpath((prev) => (samePath(prev, path) ? prev : [...path]));
        setIsBacktracking(created.isBacktracking);
        setStrategyName(created.activeStrategyName);
        setHistory((prev) =>
          prev.undo === created.undoDepth && prev.redo === created.redoDepth
            ? prev
            : { undo: created.undoDepth, redo: created.redoDepth },
        );
      },
    );
    if (options.initialSelection || options.initialAnchor != null || options.initialFocus != null) {
      const anchor = options.initialAnchor ?? null;
      created.load(options.initialSelection ?? [], anchor, options.initialFocus ?? anchor);
    }
    return created;
  });

  useEffect(() => {
    if (options.clickScope) engine.setClickScope?.(options.clickScope);
  }, [engine, options.clickScope]);

  const setGeometry = useCallback(
    (geometry: SelectionGeometry<TIndex, Point>) => engine.setGeometry(geometry),
    [engine],
  );

  const handlers = useMemo(() => {
    const s = () => engine;
    return {
      /** Returns a token for onCancelSince (e.g. to retract the first click of a double-click). */
      onClick: (p: Point) => s().click(p),
      onCmdClick: (p: Point) => s().cmdClick(p),
      onShiftClick: (p: Point) => s().shiftClick(p),
      /** Ctrl/Cmd+Shift press; a Shift-click in models without cmdShiftClick. */
      onCmdShiftClick: (p: Point) => {
        const e = s();
        if (e.cmdShiftClick) e.cmdShiftClick(p);
        else e.shiftClick(p);
      },
      /** Pointer moved while pressed. */
      onDragTo: (p: Point) => s().dragTo(p),
      onArrow: (dir: string) => s().arrow(dir),
      onShiftArrow: (dir: string) => s().shiftArrow(dir),
      onCmdArrow: (dir: string) => s().cmdArrow(dir),
      onSpace: (ctrl: boolean) => {
        const p = s().cursor;
        // Only on an element: a click on "nothing" (cursor in empty space) would clear the selection.
        if (!p || s().cursorId === null) return;
        if (ctrl) s().cmdClick(p);
        else s().click(p);
      },
      undo: () => s().undo(),
      redo: () => s().redo(),
      onCommit: () => s().commit(),
      onFlush: () => s().flush(),
      onCancelSince: (token: number) => s().cancelSince(token),
      onApply: (f: SelectionFn, domain: Iterable<TIndex>) => s().apply(f, domain),
      onPredicateSelect: (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pred: (item: any) => boolean,
        opts?: { select?: boolean; refinesPrevious?: boolean },
      ) => s().predicateSelect(pred, opts),
      onCancelPredicate: () => s().cancelPredicate(),
      /** Filter changed, folder navigated or view switched (some models clear the selection). */
      onContextChanged: (change: ContextChange) => s().contextChanged?.(change),
    };
  }, [engine]);

  const isSelected = useCallback((id: TIndex) => selectedSet.has(id), [selectedSet]);
  const isActive = useCallback((id: TIndex) => activeSet.has(id), [activeSet]);

  return useMemo(
    () => ({
      selected: selectedSet as ReadonlySet<TIndex>,
      active: activeSet as ReadonlySet<TIndex>,
      cursor,
      cursorId,
      activePath: spath,
      isBacktracking,
      activeStrategyName: strategyName,
      history,
      capabilities: engine.capabilities,
      handlers,
      setGeometry,
      isSelected,
      isActive,
    }),
    [selectedSet, activeSet, cursor, cursorId, spath, isBacktracking, strategyName, history, engine, handlers, setGeometry, isSelected, isActive],
  );
}
