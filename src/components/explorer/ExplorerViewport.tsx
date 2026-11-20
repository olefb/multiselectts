import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import type { TreeNode, VisibleNode } from "../../lib/TreeModels";
import type { MarkerKind } from "../../data/tasks";
import type { StrategyName } from "../../lib/multiselect";
import type { Point } from "../../hooks/useSelection";
import { GridCell } from "./GridCell";
import { LassoOverlay } from "./LassoOverlay";
import { TreeRow } from "./TreeRow";
import { GRID_ITEM_HEIGHT, VIEWPORT_HEIGHT, type ViewMode } from "./layout";
import type { DragSession } from "./hooks/useDragSession";
import type { ExplorerVirtualizer } from "./hooks/useVirtualLayout";

interface Props {
  parentRef: RefObject<HTMLDivElement | null>;
  virtualizer: ExplorerVirtualizer;
  viewMode: ViewMode;
  nodes: VisibleNode[];
  columns: number;
  isSelected: (id: string) => boolean;
  isActive: (id: string) => boolean;
  cursorId: string | null;
  expandedIds: ReadonlySet<string>;
  selectedAncestors: ReadonlySet<string>;
  /** Task marker flags by item ID. */
  markers: ReadonlyMap<string, MarkerKind>;
  onMouseDown: (e: ReactMouseEvent) => void;
  onDoubleClickItem: (node: TreeNode) => void;
  drag: DragSession;
  lassoMode: Exclude<StrategyName, "mixed">;
  activePath: Point[];
  isBacktracking: boolean;
  /** Height of the scroll viewport (px, default VIEWPORT_HEIGHT). */
  height?: number;
}

/**
 * True if a press landed on the element's own scrollbar (outside its client
 * area): the browser scrolls, and the press must not reach the selection. The
 * permanent scrollbar (revision 19) takes 14 px beside the rows; before this
 * check (revision 21), a press on it acted as a click in blank space or on the
 * row level with it.
 */
function isOnScrollbar(e: ReactMouseEvent, el: HTMLElement): boolean {
  if (e.target !== el) return false; // rows and cells are children; the scrollbar belongs to the element itself
  const rect = el.getBoundingClientRect();
  const x = e.clientX - rect.left - el.clientLeft;
  const y = e.clientY - rect.top - el.clientTop;
  return x >= el.clientWidth || y >= el.clientHeight;
}

/** The scrollable, virtualized list/grid plus the drag overlay. */
export function ExplorerViewport({
  parentRef,
  virtualizer,
  viewMode,
  nodes,
  columns,
  isSelected,
  isActive,
  cursorId,
  expandedIds,
  selectedAncestors,
  markers,
  onMouseDown,
  onDoubleClickItem,
  drag,
  lassoMode,
  activePath,
  isBacktracking,
  height = VIEWPORT_HEIGHT,
}: Props) {
  return (
    <div
      ref={parentRef}
      className="explorer-viewport" // permanent scrollbar (index.css)
      data-testid="explorer-viewport"
      onMouseDown={(e) => {
        if (isOnScrollbar(e, e.currentTarget)) return;
        onMouseDown(e);
      }}
      tabIndex={0}
      style={{
        outline: "none",
        height: `${height}px`,
        overflow: "auto",
        border: "1px solid #ccc",
        position: "relative",
        userSelect: "none",
        backgroundColor: "#fff",
        overscrollBehavior: "contain",
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          if (viewMode === "grid") {
            const rowNodes = nodes.slice(virtualRow.index * columns, (virtualRow.index + 1) * columns);
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: GRID_ITEM_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: "flex",
                  flexDirection: "row", // guarantee horizontal row flow
                }}
              >
                {rowNodes.map((vNode) => (
                  <GridCell
                    key={vNode.id}
                    vNode={vNode}
                    selected={isSelected(vNode.id)}
                    active={isActive(vNode.id)}
                    cursor={cursorId === vNode.id}
                    containsSelected={selectedAncestors.has(vNode.id)}
                    marker={markers.get(vNode.id)}
                    onDoubleClick={onDoubleClickItem}
                  />
                ))}
              </div>
            );
          }

          const vNode = nodes[virtualRow.index];
          return (
            <TreeRow
              key={vNode.id}
              vNode={vNode}
              top={virtualRow.start}
              selected={isSelected(vNode.id)}
              active={isActive(vNode.id)}
              cursor={cursorId === vNode.id}
              expanded={expandedIds.has(vNode.id)}
              containsSelected={selectedAncestors.has(vNode.id)}
              marker={markers.get(vNode.id)}
            />
          );
        })}
      </div>

      {drag.isDragging && (
        <LassoOverlay
          mode={lassoMode}
          start={drag.start}
          end={drag.end}
          path={activePath}
          isBacktracking={isBacktracking}
          scrollOffset={virtualizer.scrollOffset ?? 0}
          height={height}
        />
      )}
    </div>
  );
}
