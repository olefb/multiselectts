// File: lib/engines.ts
// Registry of the selection models the explorer can run (study conditions).

import { SelectionState } from "./multiselect";
import type { SelectionEngineFactory } from "./SelectionEngine";
import { TRADITIONAL_PRESETS, TraditionalSelection } from "./TraditionalSelection";

export const SELECTION_MODELS = ["algebraic", "windows", "mac"] as const;
export type SelectionModelName = (typeof SELECTION_MODELS)[number];

export const MODEL_LABELS: Record<SelectionModelName, string> = {
  algebraic: "Algebraic",
  windows: "Traditional (Windows-like)",
  mac: "Traditional (Finder-like)",
};

export function isSelectionModel(name: string | null): name is SelectionModelName {
  return (SELECTION_MODELS as readonly string[]).includes(name ?? "");
}

export interface EngineOptions {
  /** Offer undo/redo in models that have it (default true). */
  undo?: boolean;
}

export function engineFactory<TIndex, TPoint>(
  model: SelectionModelName,
  options: EngineOptions = {},
): SelectionEngineFactory<TIndex, TPoint> {
  switch (model) {
    case "algebraic":
      return (geometry, onRefresh) =>
        new SelectionState<TIndex, TPoint>(geometry, onRefresh, { undo: options.undo });
    case "windows":
    case "mac":
      return (geometry, onRefresh) =>
        new TraditionalSelection<TIndex, TPoint>(geometry, onRefresh, TRADITIONAL_PRESETS[model]);
  }
}
