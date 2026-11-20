import { useEffect, useMemo } from "react";
import { HierarchicalTreeGeometry } from "../../../lib/HierarchicalTreeGeometry";
import { LogicalGridGeometry, type GridConfig } from "../../../lib/LogicalGridGeometry";
import type { SelectionGeometry, StrategyName } from "../../../lib/multiselect";
import type { VisibleNode } from "../../../lib/TreeModels";
import type { Point } from "../../../hooks/useSelection";
import type { Dataset } from "../../../data/dataset";
import { GRID_ITEM_HEIGHT, GRID_ITEM_WIDTH, GRID_PAGE_ROWS, TREE_CONFIG, type ViewMode } from "../layout";

interface Options {
  dataset: Dataset;
  viewMode: ViewMode;
  treeNodes: VisibleNode[];
  gridNodes: VisibleNode[];
  containerWidth: number;
  strategyMode: StrategyName;
  setGeometry: (geometry: SelectionGeometry<string, Point>) => void;
}

/**
 * Builds the spatial geometries for both views and feeds the active one into
 * the selection engine after each render (geometries are recreated only when
 * the projection, width or strategy actually changes).
 */
export function useGeometries({ dataset, viewMode, treeNodes, gridNodes, containerWidth, strategyMode, setGeometry }: Options) {
  const treeGeometry = useMemo(
    () => new HierarchicalTreeGeometry(TREE_CONFIG, treeNodes, dataset.flat),
    [dataset, treeNodes],
  );

  const gridGeometry = useMemo(() => {
    const config: GridConfig = {
      itemWidth: GRID_ITEM_WIDTH,
      itemHeight: GRID_ITEM_HEIGHT,
      containerWidth,
      totalItems: gridNodes.length,
      pageRows: GRID_PAGE_ROWS,
    };
    return new LogicalGridGeometry(config, gridNodes, dataset.flat, strategyMode);
  }, [dataset, gridNodes, containerWidth, strategyMode]);

  const activeGeometry = viewMode === "grid" ? gridGeometry : treeGeometry;

  useEffect(() => {
    setGeometry(activeGeometry);
  }, [activeGeometry, setGeometry]);

  return { treeGeometry, gridGeometry, activeGeometry };
}
