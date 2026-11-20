// File: components/explorer/layout.ts
// Shared layout constants and UI state types for the explorer.

import type { TreeConfig } from "../../lib/HierarchicalTreeGeometry";

export const VIEWPORT_HEIGHT = 600;
export const GRID_ITEM_WIDTH = 120;
export const GRID_ITEM_HEIGHT = 100;

/** Rows per PageUp/PageDown: one screenful, keeping one row of context. */
const pageRows = (rowHeight: number) => Math.max(1, Math.floor(VIEWPORT_HEIGHT / rowHeight) - 1);

export const TREE_CONFIG: TreeConfig = {
  itemHeight: 32,
  indentWidth: 24,
  chevronWidth: 28,
  pageRows: pageRows(32),
};
export const GRID_PAGE_ROWS = pageRows(GRID_ITEM_HEIGHT);

export type ViewMode = "tree" | "grid";
export type SearchMode = "filter" | "exclude" | "select" | "deselect";

/** Search modes that change the selection (live predicate preview) rather than the view. */
export const isPredicateMode = (mode: SearchMode) => mode === "select" || mode === "deselect";
export type InteractionSource = "mouse" | "keyboard";
