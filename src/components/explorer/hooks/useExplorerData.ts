import { useCallback, useMemo, useState } from "react";
import { flattenTree, type TreeNode, type VisibleNode } from "../../../lib/TreeModels";
import { breadcrumbTrail, type Dataset } from "../../../data/dataset";
import type { SearchMode, ViewMode } from "../layout";

interface Options {
  dataset: Dataset;
  viewMode: ViewMode;
  searchMode: SearchMode;
  query: string;
  /** When set ("Show Selected Only"), project only these elements and their ancestors. */
  focusSelection: ReadonlySet<string> | undefined;
  /** Folders expanded at the start (default: the first two root folders). Read once. */
  initialExpanded?: readonly string[];
  /** Grid folder open at the start (default: root). Read once. */
  initialFolderId?: string | null;
}

const toFlatNodes = (nodes: TreeNode[], parentId: string | null): VisibleNode[] =>
  nodes.map((node, i) => ({ id: node.id, node, depth: 0, index: i, parentId }));

/**
 * The visibility state V: navigation (expanded folders, current grid folder)
 * and the projections of the tree into the list and grid views.
 */
export function useExplorerData({
  dataset,
  viewMode,
  searchMode,
  query,
  focusSelection,
  initialExpanded,
  initialFolderId = null,
}: Options) {
  // Pre-expand the first couple of root directories on load, unless told otherwise.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(initialExpanded ?? dataset.tree.filter((n) => n.children).slice(0, 2).map((n) => n.id)),
  );
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialFolderId);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // List view: hierarchical projection honouring search mask and selection focus.
  const treeNodes = useMemo(() => {
    // Only the view modes (filter / exclude) mask the tree; predicate modes change the selection.
    const activeQuery = searchMode === "filter" || searchMode === "exclude" ? query : "";
    const maskMode = searchMode === "exclude" ? "exclude" : "filter";
    return flattenTree(dataset.tree, expandedIds, activeQuery, maskMode, focusSelection, !!focusSelection);
  }, [dataset, expandedIds, searchMode, query, focusSelection]);

  // Grid view: flat pool when focusing or filtering, otherwise the current folder.
  const gridNodes = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (focusSelection) {
      return toFlatNodes(dataset.flat.filter((node) => focusSelection.has(node.id)), null);
    }
    if (searchMode === "filter" && cleanQuery !== "") {
      return toFlatNodes(
        dataset.flat.filter((node) => node.name.toLowerCase().includes(cleanQuery)),
        null,
      );
    }

    let rawItems: TreeNode[] = dataset.tree;
    if (currentFolderId !== null) {
      rawItems = dataset.byId.get(currentFolderId)?.children ?? [];
    }
    if (searchMode === "exclude" && cleanQuery !== "") {
      rawItems = rawItems.filter((node) => !node.name.toLowerCase().includes(cleanQuery));
    }
    return toFlatNodes(rawItems, currentFolderId);
  }, [dataset, currentFolderId, searchMode, query, focusSelection]);

  const breadcrumbs = useMemo(() => breadcrumbTrail(dataset, currentFolderId), [dataset, currentFolderId]);

  return {
    treeNodes,
    gridNodes,
    activeNodes: viewMode === "grid" ? gridNodes : treeNodes,
    expandedIds,
    toggleExpand,
    currentFolderId,
    setCurrentFolderId,
    breadcrumbs,
  };
}
