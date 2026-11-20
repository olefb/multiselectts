// File: components/VirtualizedExplorer.tsx
//
// Composition root of the explorer. State lives in three layers:
//   - selection state S   : the selection engine (useSelection)
//   - visibility state V  : navigation + projections (useExplorerData)
//   - interaction state   : drag session, pointer and keyboard wiring
// The engine is injectable (createEngine) so the user study can run the
// algebraic model and the traditional baseline on identical UI.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelection, type Point } from "../hooks/useSelection";
import { tt, ff, not, type ClickScope, type StrategyName } from "../lib/multiselect";
import type { SelectionEngineFactory } from "../lib/SelectionEngine";
import type { Dataset } from "../data/dataset";
import { taskMarkers, type ExplorerViewState, type TaskSpec } from "../data/tasks";
import { MOCK_DATASET } from "../data/datasets";
import { GRID_ITEM_HEIGHT, isPredicateMode, TREE_CONFIG, type InteractionSource, type SearchMode, type ViewMode } from "./explorer/layout";
import { useContainerWidth } from "./explorer/hooks/useContainerWidth";
import { useDragSession } from "./explorer/hooks/useDragSession";
import { useExplorerData } from "./explorer/hooks/useExplorerData";
import { useFrozenWhileDragging, useSelectionIndicators } from "./explorer/hooks/useSelectionIndicators";
import { useGeometries } from "./explorer/hooks/useGeometries";
import { useKeyboardSelection, type KeyboardCommands } from "./explorer/hooks/useKeyboardSelection";
import { usePointerSelection } from "./explorer/hooks/usePointerSelection";
import { usePredicateSearch } from "./explorer/hooks/usePredicateSearch";
import { useVirtualLayout } from "./explorer/hooks/useVirtualLayout";
import { Breadcrumbs } from "./explorer/Breadcrumbs";
import { ExplorerViewport } from "./explorer/ExplorerViewport";
import { SearchBar } from "./explorer/SearchBar";
import { SelectionStoragePanel } from "./explorer/SelectionStoragePanel";
import { SelectionSummary } from "./explorer/SelectionSummary";
import { ShortcutHelp } from "./explorer/ShortcutHelp";
import { useTelemetry } from "../telemetry/context";
import { usePointerTrace } from "../telemetry/usePointerTrace";
import { Toolbar } from "./explorer/Toolbar";
import { EXPLORER_TEXT, type ExplorerText } from "./explorer/text";

interface Props {
  /** Selection model to run; defaults to the algebraic engine. Read on mount. */
  createEngine?: SelectionEngineFactory<string, Point>;
  /** Shown in the header footnote (e.g. "algebraic"). */
  modelLabel?: string;
  /** File tree to show; defaults to the seeded mock tree. Read on mount. */
  dataset?: Dataset;
  /** Study task: starting view, pre-selection and markers. Read on mount. */
  task?: TaskSpec;
  /**
   * Selection aids: "Show Selected Only", the "(N not visible)" count and the
   * folder badges for selected contents (default on).
   */
  selectionAids?: boolean;
  /**
   * "study": participant view. Hides the developer chrome (drag-strategy and
   * click-scope pickers, "Exclude" search, selection storage panel, shortcut
   * list, dataset/model footnote). Default "dev".
   */
  variant?: "dev" | "study";
  /** UI labels (default: the developer labels). */
  text?: ExplorerText;
  /**
   * Called with the selection whenever it changes. `settled` is false during a
   * drag and while a predicate-search preview is uncommitted.
   */
  onSelectionChange?: (selected: ReadonlySet<string>, settled: boolean) => void;
  /** Called with the view and "Show selected only" state on mount and whenever they change (tutorial checks). */
  onViewStateChange?: (state: ExplorerViewState) => void;
  /**
   * Height of the list/grid viewport in px (default 600). In study mode the grid
   * is shorter by the breadcrumb bar above it, so both views fill the same height.
   */
  viewportHeight?: number;
}

const SEARCH_MODE_ORDER: readonly SearchMode[] = ["filter", "exclude", "select", "deselect"];

const NO_IDS: ReadonlySet<string> = new Set();
/** Off-screen files named in the match note; the rest are counted. */
const HIDDEN_MATCHES_LISTED = 1;
/** Approximate height of the breadcrumb bar shown above the grid. */
const BREADCRUMB_BAR_HEIGHT = 44;
/** A predicate search (for the hidden-matches note): mode, lower-cased query, and the selection before it. */
type MatchSearch = { mode: "select" | "deselect"; query: string; before: ReadonlySet<string> };

export function VirtualizedExplorer({
  createEngine,
  modelLabel,
  dataset = MOCK_DATASET,
  task,
  selectionAids = true,
  variant = "dev",
  text = EXPLORER_TEXT.dev,
  onSelectionChange,
  onViewStateChange,
  viewportHeight,
}: Props) {
  const study = variant === "study";
  const parentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastInteractionRef = useRef<InteractionSource>("mouse");

  // --- UI state ---
  const telemetry = useTelemetry();
  const [viewMode, setViewMode] = useState<ViewMode>(task?.view ?? "tree");
  const [strategyMode, setStrategyMode] = useState<StrategyName>("mixed");
  const [clickScope, setClickScope] = useState<ClickScope>("global");
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("filter");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const containerWidth = useContainerWidth(parentRef);

  // --- Selection state S (geometry is fed in by useGeometries) ---
  const selection = useSelection<string>({
    clickScope,
    createEngine,
    initialSelection: task?.preselected,
    initialAnchor: task?.anchor ?? null,
    initialFocus: task?.focus ?? task?.anchor ?? null,
  });
  const { selected, handlers, capabilities } = selection;
  const drag = useDragSession();
  const viewSelected = useFrozenWhileDragging(selected, drag.isDragging);

  // --- Visibility state V ---
  const data = useExplorerData({
    dataset,
    viewMode,
    searchMode,
    query,
    focusSelection: selectionAids && showSelectedOnly ? viewSelected : undefined,
    initialExpanded: task?.expanded,
    initialFolderId: task?.folder ?? null,
  });
  const { columns, virtualizer } = useVirtualLayout(parentRef, viewMode, containerWidth, data.activeNodes.length);
  // Task start scroll position: the task's `scrollTo` item is the first row (once, on mount).
  // Set directly and re-applied each frame until it has held for a few frames: the
  // virtualizer's first measurements can reset the scroll position right after mount.
  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (initialScrollDone.current || !task?.scrollTo) return;
    const index = data.activeNodes.findIndex((n) => n.id === task.scrollTo);
    if (index < 0 || columns < 1) return;
    const row = viewMode === "grid" ? Math.floor(index / columns) : index;
    const top = row * (viewMode === "grid" ? GRID_ITEM_HEIGHT : TREE_CONFIG.itemHeight);
    let frame = 0;
    let tries = 0;
    let held = 0;
    const apply = () => {
      const el = parentRef.current;
      if (!el) return;
      if (Math.abs(el.scrollTop - top) > 1) {
        el.scrollTop = top;
        held = 0;
      } else held++;
      if (held < 5 && ++tries < 60) frame = requestAnimationFrame(apply);
      else initialScrollDone.current = true;
    };
    apply();
    return () => cancelAnimationFrame(frame);
  }, [task, data.activeNodes, columns, viewMode]);
  const { treeGeometry, activeGeometry } = useGeometries({
    dataset,
    viewMode,
    treeNodes: data.treeNodes,
    gridNodes: data.gridNodes,
    containerWidth,
    strategyMode,
    setGeometry: selection.setGeometry,
  });
  const { hiddenSelectedCount, selectedAncestors } = useSelectionIndicators(dataset, selected, data.activeNodes);
  const markers = useMemo(() => taskMarkers(task), [task]);
  const nameOf = useCallback((id: string) => dataset.byId.get(id)?.name ?? id, [dataset]);

  // --- Context changes (some models clear the selection on these) ---
  const { setCurrentFolderId } = data;
  const isFiltering = (mode: SearchMode, q: string) => !isPredicateMode(mode) && q.trim() !== "";
  const filterKey = (mode: SearchMode, q: string) => (isFiltering(mode, q) ? `${mode}:${q.trim()}` : "");

  type NavigateVia = "doubleClick" | "enter" | "breadcrumb" | "up" | "key";

  const changeView = (mode: ViewMode) => {
    if (mode === viewMode) return;
    telemetry.record({ type: "view", mode });
    setViewMode(mode);
    handlers.onContextChanged("view");
  };
  const changeQuery = (q: string) => {
    if (q.trim() !== "") setPinned(null);
    if (q !== query) telemetry.record({ type: "searchInput", mode: searchMode, query: q });
    setQuery(q);
    if (filterKey(searchMode, q) !== filterKey(searchMode, query)) handlers.onContextChanged("filter");
  };
  const changeSearchMode = (mode: SearchMode) => {
    setPinned(null);
    telemetry.record({ type: "searchMode", mode });
    setSearchMode(mode);
    if (filterKey(mode, query) !== filterKey(searchMode, query)) handlers.onContextChanged("filter");
  };
  const enterFolder = useCallback(
    (folderId: string | null, via: NavigateVia) => {
      telemetry.record({ type: "navigate", folder: folderId, via });
      setCurrentFolderId(folderId);
      handlers.onContextChanged("navigate");
    },
    [setCurrentFolderId, handlers, telemetry],
  );
  const navigateTo = useCallback(
    (folderId: string | null, via: NavigateVia) => {
      enterFolder(folderId, via);
      virtualizer.scrollToOffset(0);
    },
    [enterFolder, virtualizer],
  );
  const { expandedIds, toggleExpand } = data;
  const toggleExpandVia = useCallback(
    (id: string, via: "chevron" | "key") => {
      telemetry.record({ type: "expand", folder: id, expanded: !expandedIds.has(id), via });
      toggleExpand(id);
    },
    [telemetry, expandedIds, toggleExpand],
  );
  const setting = <T extends string | boolean>(name: string, set: (v: T) => void) => (value: T) => {
    telemetry.record({ type: "setting", name, value });
    set(value);
  };

  // --- Commands (buttons and keyboard share these) ---
  // Bulk actions: one sealed, undoable step each; nothing recorded if nothing changes.
  const { activeNodes, breadcrumbs, currentFolderId } = data;
  // Select All: the visible items V (the open folder in the grid, the shown rows in the
  // list), as in Explorer and Finder; hidden selections are kept. Same domain as Invert.
  const selectAll = useCallback(() => handlers.onApply(tt, activeNodes.map((n) => n.id)), [handlers, activeNodes]);
  const deselectAll = useCallback(() => handlers.onApply(ff, [...selected]), [handlers, selected]);
  // Invert within the visible set V only: hidden selections are untouched.
  const invertVisible = useCallback(
    () => handlers.onApply(not, activeNodes.map((n) => n.id)),
    [handlers, activeNodes],
  );
  const goUp = useCallback(() => {
    if (currentFolderId === null) return;
    navigateTo(breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].id : null, "key");
  }, [currentFolderId, breadcrumbs, navigateTo]);
  const previewActive = isPredicateMode(searchMode) && query.trim() !== "";
  const settled = !drag.isDragging && !previewActive;

  // --- Match note of "Select / Deselect matching" (a selection aid) ---
  // How many files the predicate search changed, naming the first that is not
  // on screen (folded away, filtered out, or scrolled out of view), next to the
  // search box: live during the preview, and after Enter / Apply (pinned) until
  // the participant types, changes the search mode, or presses in the list.
  // The pin keeps the search, not a list of files, so it is right even when
  // Enter applied the preview in the same keystroke.
  const matchNotice = selectionAids && capabilities.predicate;
  const [beforePreview, setBeforePreview] = useState<ReadonlySet<string>>(selected);
  if (!previewActive && beforePreview !== selected) setBeforePreview(selected);
  const [pinned, setPinned] = useState<MatchSearch | null>(null);
  /** Counts commits, so the note flashes again on Enter (not on every keystroke). */
  const [pinSerial, setPinSerial] = useState(0);
  const liveSearch = useMemo<MatchSearch | null>(
    () =>
      previewActive
        ? { mode: searchMode as "select" | "deselect", query: query.trim().toLowerCase(), before: beforePreview }
        : null,
    [previewActive, searchMode, query, beforePreview],
  );
  const noticeSearch = liveSearch ?? pinned;
  // Rows on screen (without overscan); files outside them count as not visible.
  const firstRow = virtualizer.range?.startIndex ?? 0;
  const lastRow = virtualizer.range?.endIndex ?? -1;
  const matchChanges = useMemo(() => {
    if (!matchNotice || !noticeSearch) return null;
    const { mode, query: q, before } = noticeSearch;
    const rowOf = new Map(activeNodes.map((n, i) => [n.id, viewMode === "grid" ? Math.floor(i / columns) : i]));
    const changed = (id: string) =>
      mode === "select" ? selected.has(id) && !before.has(id) : before.has(id) && !selected.has(id);
    const all = dataset.flat.filter((n) => n.name.toLowerCase().includes(q) && changed(n.id)).map((n) => n.id);
    const hidden = all.filter((id) => {
      const row = rowOf.get(id);
      return row === undefined || row < firstRow || row > lastRow;
    });
    return { mode, all, hidden };
  }, [matchNotice, noticeSearch, activeNodes, viewMode, columns, firstRow, lastRow, selected, dataset]);
  // --- Hidden-by-search note (a selection aid, predicate system only) ---
  // While a search (filter) hides selected files, say that they are still
  // selected (pilot 1: a participant assumed searching cleared his selection).
  const filterNote = matchNotice && isFiltering(searchMode, query) && hiddenSelectedCount > 0 ? text.hiddenBySearch(hiddenSelectedCount) : null;
  const notice = (() => {
    if (!matchChanges || matchChanges.all.length === 0) return filterNote;
    const label = (id: string) => {
      const parent = id.split("/").slice(-2, -1)[0];
      return parent ? `${nameOf(id)} (${parent})` : nameOf(id);
    };
    const listed = matchChanges.hidden.slice(0, HIDDEN_MATCHES_LISTED).map(label);
    return text.matchNote(matchChanges.mode, matchChanges.all.length, listed, matchChanges.hidden.length, liveSearch ? "live" : "kept");
  })();
  const noticeKey = pinned ? `pinned-${pinSerial}` : filterNote && notice === filterNote ? "filter" : "live";
  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  });
  useEffect(() => {
    onSelectionChangeRef.current?.(selected, settled);
  }, [selected, settled]);
  const onViewStateChangeRef = useRef(onViewStateChange);
  useEffect(() => {
    onViewStateChangeRef.current = onViewStateChange;
  });
  const selectedOnlyShown = selectionAids && showSelectedOnly;
  useEffect(() => {
    onViewStateChangeRef.current?.({ view: viewMode, showSelectedOnly: selectedOnlyShown });
  }, [viewMode, selectedOnlyShown]);
  const searchModes = SEARCH_MODE_ORDER.filter(
    (m) => (capabilities.predicate || !isPredicateMode(m)) && !(study && m === "exclude"),
  );
  const commands = useMemo<KeyboardCommands>(
    () => ({
      selectAll,
      invertVisible,
      escape: () => {
        if (previewActive) {
          setQuery("");
          handlers.onCancelPredicate();
        } else deselectAll();
      },
      focusSearch: () => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      },
      openFolder: (id) => {
        handlers.onCommit();
        navigateTo(id, "enter");
      },
      goUp,
    }),
    [selectAll, invertVisible, previewActive, handlers, deselectAll, navigateTo, goUp],
  );

  // --- Interaction ---
  const pointer = usePointerSelection({
    parentRef,
    lastInteractionRef,
    drag,
    handlers,
    viewMode,
    treeGeometry,
    hitTest: (p) => activeGeometry.m2v(p),
    toggleExpand: (id) => toggleExpandVia(id, "chevron"),
    virtualizer,
    onEnterFolder: (id) => enterFolder(id, "doubleClick"),
  });
  usePointerTrace(parentRef, drag.isDragging);
  const predicateSearch = usePredicateSearch(query, searchMode, handlers);
  useKeyboardSelection({
    parentRef,
    lastInteractionRef,
    handlers,
    commands,
    nodeById: dataset.byId,
    cursorId: selection.cursorId,
    viewMode,
    expandedIds,
    toggleExpand: (id) => toggleExpandVia(id, "key"),
    activeGeometry,
    virtualizer,
    isDragging: drag.isDragging,
  });

  // Which concrete drag strategy to draw ("mixed" resolves per gesture).
  const resolvedStrategy = selection.activeStrategyName;
  const lassoMode: Exclude<StrategyName, "mixed"> =
    viewMode === "tree"
      ? "rectangular"
      : strategyMode !== "mixed"
        ? strategyMode
        : resolvedStrategy && resolvedStrategy !== "mixed"
          ? resolvedStrategy
          : "rowwise";

  return (
    <div
      style={{
        padding: study ? "8px 20px" : "20px",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "1000px",
        margin: "0 auto",
        textAlign: study ? "left" : undefined,
      }}
    >
      <header
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: study ? "10px" : "20px" }}
      >
        <div>
          {!study && <h1 style={{ margin: 0, fontSize: "22px" }}>{text.title}</h1>}
          <Toolbar
            viewMode={viewMode}
            onViewMode={changeView}
            searchMode={searchMode}
            onSearchMode={changeSearchMode}
            searchModes={searchModes}
            strategyMode={strategyMode}
            onStrategyMode={study ? undefined : setting<StrategyName>("strategy", setStrategyMode)}
            showSelectedOnly={selectionAids ? showSelectedOnly : undefined}
            onShowSelectedOnly={selectionAids ? setting<boolean>("showSelectedOnly", setShowSelectedOnly) : undefined}
            clickScope={capabilities.clickScope && !study ? clickScope : undefined}
            onClickScope={capabilities.clickScope && !study ? setting<ClickScope>("clickScope", setClickScope) : undefined}
            highlight={task?.highlight}
            text={text}
          />
          <SearchBar
            inputRef={searchInputRef}
            query={query}
            onQuery={changeQuery}
            searchMode={searchMode}
            onCommit={() => {
              // Enter right after the last letter: apply the debounced preview before sealing it.
              predicateSearch.flush();
              setPinned(liveSearch);
              setPinSerial((n) => n + 1);
              handlers.onCommit();
            }}
            onCancelPreview={() => {
              setPinned(null);
              handlers.onCancelPredicate();
            }}
            focusViewport={() => parentRef.current?.focus()}
            notice={notice}
            noticeKey={noticeKey}
            highlight={task?.highlight}
            text={text}
          />
        </div>
        <SelectionSummary
          selectedCount={selected.size}
          hiddenCount={selectionAids ? hiddenSelectedCount : 0}
          onSelectAll={() => {
            telemetry.record({ type: "button", name: "selectAll" });
            selectAll();
          }}
          onDeselectAll={() => {
            telemetry.record({ type: "button", name: "deselectAll" });
            deselectAll();
          }}
          history={capabilities.undo && !study ? selection.history : undefined}
          datasetLabel={study ? undefined : dataset.label}
          modelLabel={modelLabel}
          text={text}
          plain={study}
        />
      </header>

      {viewMode === "grid" && (
        <Breadcrumbs currentFolderId={currentFolderId} trail={breadcrumbs} onNavigate={navigateTo} text={text} />
      )}

      <ExplorerViewport
        parentRef={parentRef}
        virtualizer={virtualizer}
        viewMode={viewMode}
        nodes={activeNodes}
        columns={columns}
        isSelected={selection.isSelected}
        isActive={selection.isActive}
        cursorId={selection.cursorId}
        expandedIds={data.expandedIds}
        selectedAncestors={selectionAids ? selectedAncestors : NO_IDS}
        markers={markers}
        onMouseDown={(e) => {
          setPinned(null);
          pointer.onMouseDown(e);
        }}
        onDoubleClickItem={pointer.onDoubleClickItem}
        drag={drag}
        lassoMode={lassoMode}
        activePath={selection.activePath}
        isBacktracking={selection.isBacktracking}
        height={
          study && viewportHeight !== undefined && viewMode === "grid" ? viewportHeight - BREADCRUMB_BAR_HEIGHT : viewportHeight
        }
      />

      {!study && (
        <>
          <ShortcutHelp undo={capabilities.undo} />
          <SelectionStoragePanel selected={selected} nameOf={nameOf} />
        </>
      )}
    </div>
  );
}
