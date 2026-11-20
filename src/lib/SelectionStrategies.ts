// File: lib/SelectionStrategies.ts

import type { Point } from "./LogicalGridGeometry";
import type { PathCache } from "./multiselect";

export type SelectionStrategy = (
  path: Point[],
  getMetadata: (p: Point) => { col: number; row: number; index: number | null; id: string | null },
  getColumnCount: () => number,
  totalItems: number,
  itemWidth: number,
  itemHeight: number,
  padding: number,
  getId: (index: number) => string | null,
  J: Set<string> | undefined,
  cache: PathCache,
) => Set<string>;

/**
 * Rectangular Selection (Standard Grid)
 * Returns J immediately if the mouse hasn't left the current cell.
 */
export const RectangularStrategy: SelectionStrategy = (
  path,
  getMetadata,
  getColumnCount,
  totalItems,
  itemWidth,
  itemHeight,
  padding,
  getId,
  J,
  cache,
) => {
  if (path.length === 0) return new Set();

  const anchor = path[0];
  const activeEnd = path[path.length - 1];

  // 🚀 THE FIX: Cache on physical coordinates to ensure the lasso re-calculates 
  // as the box expands, even if the cursor remains in the gutter/padding.
  if (
    cache.lastX === activeEnd.x &&
    cache.lastY === activeEnd.y &&
    J
  ) {
    return J;
  }

  cache.lastX = activeEnd.x;
  cache.lastY = activeEnd.y;

  const lasso = {
    left: Math.min(anchor.x, activeEnd.x),
    right: Math.max(anchor.x, activeEnd.x),
    top: Math.min(anchor.y, activeEnd.y),
    bottom: Math.max(anchor.y, activeEnd.y),
  };

  const anchorMeta = getMetadata(anchor);
  const activeMeta = getMetadata(activeEnd); // 🚀 Ensure we calculate relative to activeEnd metadata
  const result = new Set<string>();
  const cols = getColumnCount();

  const startCol = Math.max(0, Math.min(cols - 1, Math.min(anchorMeta.col, activeMeta.col)));
  const endCol = Math.max(0, Math.min(cols - 1, Math.max(anchorMeta.col, activeMeta.col)));
  const startRow = Math.max(
    0,
    Math.min(Math.ceil(totalItems / cols) - 1, Math.min(anchorMeta.row, activeMeta.row))
  );
  const endRow = Math.max(
    0,
    Math.min(Math.ceil(totalItems / cols) - 1, Math.max(anchorMeta.row, activeMeta.row))
  );

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const index = r * cols + c;
      if (index >= 0 && index < totalItems) {
        const itemHitBox = {
          left: c * itemWidth + padding,
          right: (c + 1) * itemWidth - padding,
          top: r * itemHeight + padding,
          bottom: (r + 1) * itemHeight - padding,
        };

        const intersects =
          lasso.left < itemHitBox.right &&
          lasso.right > itemHitBox.left &&
          lasso.top < itemHitBox.bottom &&
          lasso.bottom > itemHitBox.top;

        if (intersects) {
          const id = getId(index);
          if (id !== null) result.add(id);
        }
      }
    }
  }
  return result;
};

/**
 * Row-wise Selection
 * Selects all items between the anchor index and active end index in linear order.
 */
export const RowWiseStrategy: SelectionStrategy = (
  path,
  getMetadata,
  getColumnCount,
  totalItems,
  _itemWidth,
  _itemHeight,
  _padding,
  getId,
  J,
  cache,
) => {
  if (path.length === 0) return new Set();

  const anchor = path[0];
  const activeEnd = path[path.length - 1];

  const anchorMetadata = getMetadata(anchor);
  const activeEndMetadata = getMetadata(activeEnd);
  const cols = getColumnCount();

  const getProjectedIndex = (meta: { col: number; row: number }) => {
    const clampedCol = Math.max(0, Math.min(cols - 1, meta.col));
    const projected = meta.row * cols + clampedCol;
    return Math.max(0, Math.min(totalItems - 1, projected));
  };

  const anchorIndex = getProjectedIndex(anchorMetadata);
  const activeEndIndex = getProjectedIndex(activeEndMetadata);

  if (cache.lastAnchor === anchorIndex && cache.lastEnd === activeEndIndex && J) {
    return J;
  }
  
  cache.lastAnchor = anchorIndex;
  cache.lastEnd = activeEndIndex;

  const result = new Set<string>();
  const start = Math.min(anchorIndex, activeEndIndex);
  const end = Math.max(anchorIndex, activeEndIndex);

  // Select everything in the 1D linear range by their String ID
  for (let i = start; i <= end; i++) {
    const id = getId(i);
    if (id !== null) result.add(id);
  }

  return result;
};

// --- Geometry helpers ---

function lineRectIntersect(
  p1: Point,
  p2: Point,
  rect: { left: number; right: number; top: number; bottom: number },
) {
  const isInside = (p: Point) =>
    p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom;
  if (isInside(p1) || isInside(p2)) return true;

  const lineIntersect = (a: Point, b: Point, c: Point, d: Point) => {
    const det = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
    if (det === 0) return false;
    const lambda = ((d.y - c.y) * (d.x - a.x) + (c.x - d.x) * (d.y - a.y)) / det;
    const gamma = ((a.y - b.y) * (d.x - a.x) + (b.x - a.x) * (d.y - a.y)) / det;
    return 0 < lambda && lambda < 1 && 0 < gamma && gamma < 1;
  };

  const topLeft = { x: rect.left, y: rect.top },
    topRight = { x: rect.right, y: rect.top };
  const bLeft = { x: rect.left, y: rect.bottom },
    bRight = { x: rect.right, y: rect.bottom };

  return (
    lineIntersect(p1, p2, topLeft, topRight) ||
    lineIntersect(p1, p2, topRight, bRight) ||
    lineIntersect(p1, p2, bRight, bLeft) ||
    lineIntersect(p1, p2, bLeft, topLeft)
  );
}

/**
 * Snake Selection Strategy:
 */
export const SnakeStrategy: SelectionStrategy = (
  path,
  _getMetadata,
  getColumnCount,
  totalItems,
  itemWidth,
  itemHeight,
  padding,
  getId,
  J,
  cache,
) => {
  if (path.length < 1) return new Set();

  const resume = J !== undefined && (cache.k ?? 0) > 0;
  const result = resume ? new Set(J) : new Set<string>();
  const startIndex = resume ? cache.k! : 1;

  const cols = getColumnCount();

  for (let i = startIndex; i < path.length; i++) {
    const p1 = path[i - 1];
    const p2 = path[i];

    const startCol = Math.max(0, Math.floor(Math.min(p1.x, p2.x) / itemWidth));
    const endCol = Math.min(cols - 1, Math.floor(Math.max(p1.x, p2.x) / itemWidth));
    const startRow = Math.max(0, Math.floor(Math.min(p1.y, p2.y) / itemHeight));
    const endRow = Math.floor(Math.max(p1.y, p2.y) / itemHeight);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const index = r * cols + c;
        if (index >= 0 && index < totalItems) {
          const hitBox = {
            left: c * itemWidth + padding,
            right: (c + 1) * itemWidth - padding,
            top: r * itemHeight + padding,
            bottom: (r + 1) * itemHeight - padding,
          };
          
          if (lineRectIntersect(p1, p2, hitBox)) {
            const id = getId(index);
            if (id !== null) result.add(id);
          }
        }
      }
    }
  }

  cache.k = path.length;
  return result;
};