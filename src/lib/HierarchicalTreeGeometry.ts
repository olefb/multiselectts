// File: lib/HierarchicalTreeGeometry.ts
import type { SelectionGeometry } from "./multiselect";
import type { VisibleNode, TreeNode } from "./TreeModels";

export interface TreeConfig {
  itemHeight: number;
  indentWidth: number; // e.g., 20px per depth level
  chevronWidth: number; // e.g., 24px for the expand/collapse arrow
  /** Rows moved by PageUp/PageDown (default 10). */
  pageRows?: number;
}

export type Point = { x: number; y: number };

export class HierarchicalTreeGeometry implements SelectionGeometry<string, Point> {
  public readonly kind = "tree";
  private config: TreeConfig;
  private visibleNodes: VisibleNode[];
  private allNodesFlat: TreeNode[]; // Used for searching hidden items
  private rowById: Map<string, number>;

  constructor(
    config: TreeConfig,
    visibleNodes: VisibleNode[],
    allNodesFlat: TreeNode[]
  ) {
    this.config = config;
    this.visibleNodes = visibleNodes;
    this.allNodesFlat = allNodesFlat;
    this.rowById = new Map(visibleNodes.map((n, i) => [n.id, i]));
  }

  /** Canonical content-zone point of a visible row, or null if the element is hidden. */
  public locate(id: string): Point | null {
    const row = this.rowById.get(id);
    return row === undefined ? null : this.getCenterOfRow(row);
  }

  public visibleIndices(): Iterable<string> {
    return this.rowById.keys();
  }

  public rowOf(id: string): number | null {
    return this.rowById.get(id) ?? null;
  }

  /**
   * Translates a Y-coordinate into a row index, and an X-coordinate into a hit-zone.
   * Exposed publicly so the UI layer can intercept Chevron clicks.
   */
  public getPointMetadata(p: Point) {
    const rowIndex = Math.floor(p.y / this.config.itemHeight);

    if (rowIndex < 0 || rowIndex >= this.visibleNodes.length || p.x < 0) {
      return { rowIndex: -1, node: null, isChevron: false };
    }

    const visibleNode = this.visibleNodes[rowIndex];
    
    // Calculate where the actual content starts based on depth
    const contentStartX = visibleNode.depth * this.config.indentWidth;
    const chevronEndX = contentStartX + this.config.chevronWidth;

    // If the click is strictly within the chevron/indent zone
    const isChevron = p.x >= contentStartX && p.x <= chevronEndX;

    return { rowIndex, node: visibleNode, isChevron };
  }

  /**
   * Maps a Point to an Algebraic Identity (String ID).
   * If they click the chevron, we return null so the Selection Engine ignores it.
   */
  public m2v(p: Point): string | null {
    const meta = this.getPointMetadata(p);
    if (!meta.node || meta.isChevron) return null;
    return meta.node.id;
  }

  /**
   * For trees, we use a Row-wise extension strategy. 
   * (We drop the Snake logic here for simplicity, as trees are strictly 1D vertical).
   */
  public extendPath(path: Point[], newPoint: Point): Point[] | null {
    if (this.m2v(newPoint) === null) return null; // Ignore invalid points
    if (path.length === 0) return [newPoint];
    // Keep only Anchor [0] and Active End [1]
    return [this.dragAnchor(path[0]), newPoint];
  }

  /**
   * A path anchored in the blank space below the last row (a press there,
   * then a drag onto the rows) starts at the last row, as a rubber band from
   * empty space does in Explorer and Finder (revision 22). Before, such a
   * drag selected nothing in every model: a study participant pressed below
   * a short filtered list and dragged up over the files. Only extendPath
   * moves the anchor: selectionDomain still finds that a blank anchor spans
   * nothing, which the algebraic engine's Shift-click after a click in blank
   * space relies on (it then extends from the last item clicked; revision 16).
   */
  private dragAnchor(p: Point): Point {
    const n = this.visibleNodes.length;
    if (n === 0 || p.x < 0 || p.y < n * this.config.itemHeight) return p;
    return this.getCenterOfRow(n - 1);
  }

  /**
   * Maps the anchor and active-end to visible row indices,
   * then selects all String IDs in between.
   */
  public selectionDomain(path: Point[], _J?: Set<string>): Set<string> {
    if (path.length === 0) return new Set();

    const anchorMeta = this.getPointMetadata(path[0]);
    const activeMeta = this.getPointMetadata(path[path.length - 1]);

    if (!anchorMeta.node || !activeMeta.node) return new Set();

    const start = Math.min(anchorMeta.rowIndex, activeMeta.rowIndex);
    const end = Math.max(anchorMeta.rowIndex, activeMeta.rowIndex);

    const result = new Set<string>();
    for (let i = start; i <= end; i++) {
      result.add(this.visibleNodes[i].id);
    }

    return result;
  }

  /**
   * Calculates the center Point of a given row index.
   */
  private getCenterOfRow(rowIndex: number): Point {
    const node = this.visibleNodes[rowIndex];
    const contentStartX = node.depth * this.config.indentWidth + this.config.chevronWidth;
    
    return {
      x: contentStartX + 10, // Just safely inside the content hit-zone
      y: rowIndex * this.config.itemHeight + (this.config.itemHeight / 2),
    };
  }

  /**
   * Hierarchical Keyboard Navigation mapping.
   */
  public step(direction: string, currentPoint: Point): Point {
    const meta = this.getPointMetadata(currentPoint);
    let targetIndex = meta.rowIndex;

    if (targetIndex === -1) return currentPoint;

    const node = meta.node!;

    switch (direction.toUpperCase()) {
      case "UP":
        targetIndex = Math.max(0, targetIndex - 1);
        break;
      case "DOWN":
        targetIndex = Math.min(this.visibleNodes.length - 1, targetIndex + 1);
        break;
      case "LEFT":
        // Move to parent if it exists
        if (node.parentId) {
          const parentIndex = this.rowById.get(node.parentId);
          if (parentIndex !== undefined) targetIndex = parentIndex;
        }
        break;
      case "RIGHT":
        // Move to first child if it exists and is visible (which means it's exactly the next row)
        if (targetIndex + 1 < this.visibleNodes.length) {
          const nextNode = this.visibleNodes[targetIndex + 1];
          if (nextNode.parentId === node.id) {
            targetIndex = targetIndex + 1;
          }
        }
        break;
      case "HOME":
        targetIndex = 0;
        break;
      case "END":
        targetIndex = this.visibleNodes.length - 1;
        break;
      case "PAGEUP":
        targetIndex = Math.max(0, targetIndex - (this.config.pageRows ?? 10));
        break;
      case "PAGEDOWN":
        targetIndex = Math.min(this.visibleNodes.length - 1, targetIndex + (this.config.pageRows ?? 10));
        break;
    }

    return this.getCenterOfRow(targetIndex);
  }

  /** Keyboard cursor when there is none: the last row for Up and End, else the first; none in an empty list. */
  public defaultCursor(direction: string): Point | undefined {
    if (this.visibleNodes.length === 0) return undefined;
    const toLast = ["UP", "END"].includes(direction.toUpperCase());
    return this.getCenterOfRow(toLast ? this.visibleNodes.length - 1 : 0);
  }

  /**
   * Search / Filtering logic.
   * Notice we run this against ALL nodes, not just visible ones.
   * This ensures hidden items remain algebraically selected when filtering.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public filter(predicate: (item: any) => boolean, candidates?: Set<string>): Set<string> {
    const result = new Set<string>();
    
    const source = candidates 
      ? this.allNodesFlat.filter(n => candidates.has(n.id))
      : this.allNodesFlat;

    for (const node of source) {
      if (predicate(node)) {
        result.add(node.id);
        
        // RECURSIVE EXPANSION:
        // If we decided earlier that finding a folder should automatically 
        // select its children, we would traverse `node.children` here and add their IDs.
      }
    }
    return result;
  }
}