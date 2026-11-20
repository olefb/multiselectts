import type { RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { GRID_ITEM_HEIGHT, GRID_ITEM_WIDTH, TREE_CONFIG, type ViewMode } from "../layout";

/** Rows/columns for the current view and the TanStack virtualizer over them. */
export function useVirtualLayout(
  parentRef: RefObject<HTMLDivElement | null>,
  viewMode: ViewMode,
  containerWidth: number,
  itemCount: number,
) {
  const columns = viewMode === "grid" ? Math.max(1, Math.floor(containerWidth / GRID_ITEM_WIDTH)) : 1;
  const rowCount = viewMode === "grid" ? Math.ceil(itemCount / columns) : itemCount;
  const itemHeight = viewMode === "grid" ? GRID_ITEM_HEIGHT : TREE_CONFIG.itemHeight;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 5,
  });

  return { columns, virtualizer };
}

export type ExplorerVirtualizer = ReturnType<typeof useVirtualLayout>["virtualizer"];
