import { useMemo, useState } from "react";
import type { TreeNode, VisibleNode } from "../../../lib/TreeModels";
import type { Dataset } from "../../../data/dataset";

/**
 * Derived selection feedback: how many selected elements are not in the
 * current projection, and which folders contain selected descendants.
 */
export function useSelectionIndicators(dataset: Dataset, selected: ReadonlySet<string>, activeNodes: VisibleNode[]) {
  // Selected but not currently projected (filtered out, collapsed, other folder).
  const hiddenSelectedCount = useMemo(() => {
    const visible = new Set(activeNodes.map((n) => n.id));
    let hidden = 0;
    selected.forEach((id) => {
      if (!visible.has(id)) hidden++;
    });
    return hidden;
  }, [activeNodes, selected]);

  // Folder IDs that contain selected descendants (ancestor badges).
  const selectedAncestors = useMemo(() => {
    const ancestors = new Set<string>();
    if (selected.size === 0) return ancestors;
    const trace = (nodes: TreeNode[], parentChain: string[]): void => {
      for (const node of nodes) {
        if (selected.has(node.id)) parentChain.forEach((id) => ancestors.add(id));
        if (node.children) trace(node.children, [...parentChain, node.id]);
      }
    };
    trace(dataset.tree, []);
    return ancestors;
  }, [dataset, selected]);

  return { hiddenSelectedCount, selectedAncestors };
}

/**
 * The selection as seen by projections that depend on it ("Show Selected
 * Only"). Frozen while a drag is in progress so rows do not move under the
 * pointer.
 */
export function useFrozenWhileDragging(selected: ReadonlySet<string>, isDragging: boolean) {
  const [viewSelected, setViewSelected] = useState<ReadonlySet<string>>(selected);
  // Adjust state while rendering (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes):
  // React re-renders immediately, with no intermediate frame.
  if (!isDragging && viewSelected !== selected) setViewSelected(selected);
  return viewSelected;
}
