// File: lib/TreeModels.ts

export interface TreeNode {
  id: string; // The Stable Algebraic Identity
  name: string;
  size?: string;
  /** Last-modified date (ISO yyyy-mm-dd), for realistic metadata. */
  modified?: string;
  /** Image thumbnail, relative to the app's base URL (e.g. "datasets/pets-demo/IMG_4801.svg"). */
  thumbnail?: string;
  /** Hidden labels for task definitions (e.g. ["cat"]); never shown to participants. */
  tags?: string[];
  children?: TreeNode[]; // If undefined, it's a file. If [], it's an empty folder.
}

export interface VisibleNode {
  id: string;
  node: TreeNode;
  depth: number;           // Indentation level (0 = root)
  index: number;           // The flattened visible 1D array index (for the virtualizer)
  parentId: string | null; // For hierarchical keyboard navigation (Left Arrow)
}

function nodeMatchesQuery(node: TreeNode, query: string): boolean {
  return node.name.toLowerCase().includes(query.toLowerCase());
}

function hasMatchingDescendant(node: TreeNode, query: string): boolean {
  if (!node.children) return false;
  return node.children.some(
    (child) => nodeMatchesQuery(child, query) || hasMatchingDescendant(child, query)
  );
}

/**
 * Helper: Recursively checks if any child/grandchild folder contains a currently selected item.
 * This is crucial so we don't hide parent directories containing selected files.
 */
function hasSelectedDescendant(node: TreeNode, selectedIds: ReadonlySet<string>): boolean {
  if (!node.children) return false;
  return node.children.some(
    (child) => selectedIds.has(child.id) || hasSelectedDescendant(child, selectedIds)
  );
}

/**
 * Projects our tree into a visible 1D array.
 * Supports standard rendering, search filters, search exclusions, and "Show Selected Only" focusing.
 */
export function flattenTree(
  tree: TreeNode[],
  expandedIds: Set<string>,
  searchQuery?: string,
  searchMode: "filter" | "exclude" | "select" = "filter",
  selectedIds?: ReadonlySet<string>,
  showSelectedOnly?: boolean
): VisibleNode[] {
  const result: VisibleNode[] = [];
  let currentIndex = 0;
  const cleanQuery = searchQuery?.trim();

  function traverse(nodes: TreeNode[], depth: number, parentId: string | null) {
    for (const node of nodes) {
      
      // 🚀 1. OPTION: SELECTION FOCUS FILTER
      if (showSelectedOnly && selectedIds) {
        const isSelected = selectedIds.has(node.id);
        const hasSelChild = hasSelectedDescendant(node, selectedIds);

        // Skip this node entirely if neither it nor its sub-items are selected
        if (!isSelected && !hasSelChild) {
          continue;
        }

        result.push({
          id: node.id,
          node,
          depth,
          index: currentIndex++,
          parentId,
        });

        // Automatically expand parent paths to selected items so they are visible
        if (node.children && (expandedIds.has(node.id) || hasSelChild)) {
          traverse(node.children, depth + 1, node.id);
        }
        continue; // Bypasses standard search logic
      }

      // 🚀 2. OPTION: INCLUSIVE SEARCH FILTER
      if (cleanQuery && searchMode === "filter") {
        const selfMatches = nodeMatchesQuery(node, cleanQuery);
        const childMatches = hasMatchingDescendant(node, cleanQuery);

        if (!selfMatches && !childMatches) {
          continue;
        }

        result.push({
          id: node.id,
          node,
          depth,
          index: currentIndex++,
          parentId,
        });

        if (node.children && (expandedIds.has(node.id) || childMatches)) {
          traverse(node.children, depth + 1, node.id);
        }
      } 
      
      // 🚀 3. OPTION: EXCLUSIVE SEARCH FILTER
      else if (cleanQuery && searchMode === "exclude") {
        const selfMatches = nodeMatchesQuery(node, cleanQuery);

        if (selfMatches) {
          continue;
        }

        result.push({
          id: node.id,
          node,
          depth,
          index: currentIndex++,
          parentId,
        });

        if (node.children && expandedIds.has(node.id)) {
          traverse(node.children, depth + 1, node.id);
        }
      } 
      
      // 🚀 4. OPTION: STANDARD RENDERING (No search/filters active)
      else {
        result.push({
          id: node.id,
          node,
          depth,
          index: currentIndex++,
          parentId,
        });

        if (node.children && expandedIds.has(node.id)) {
          traverse(node.children, depth + 1, node.id);
        }
      }
    }
  }

  traverse(tree, 0, null);
  return result;
}