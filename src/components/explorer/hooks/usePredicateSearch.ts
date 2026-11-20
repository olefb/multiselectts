import { useCallback, useEffect, useRef } from "react";
import type { SelectionModel } from "../../../hooks/useSelection";
import type { TreeNode } from "../../../lib/TreeModels";
import { isPredicateMode, type SearchMode } from "../layout";

/** Delay between the last keystroke and re-evaluating the predicate. */
export const PREDICATE_DEBOUNCE_MS = 150;

/**
 * "Select / Deselect Items (Predicate)" modes: a live, debounced preview that
 * selects (or deselects) every matching element, visible or not. Switching
 * between the two modes updates the preview; leaving them or emptying the
 * query discards it; Enter / Commit seal it (see SearchBar).
 *
 * Returns `flush`, which applies a preview that is still waiting for its
 * debounce. Call it before sealing the preview: Enter pressed right after the
 * last letter (within the debounce) would otherwise seal nothing, and the
 * search would silently select nothing.
 */
export function usePredicateSearch(
  query: string,
  searchMode: SearchMode,
  handlers: SelectionModel<string>["handlers"],
) {
  /** Lower-cased query of the live preview, for the refinement hint. */
  const previewQueryRef = useRef("");
  /** The preview update waiting for the debounce, if any. */
  const pendingRef = useRef<{ run: () => void; timeoutId: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!isPredicateMode(searchMode) || q === "") {
      handlers.onCancelPredicate(); // no-op after Enter/commit
      previewQueryRef.current = "";
      return;
    }

    const run = () => {
      if (pendingRef.current?.run !== run) return; // already applied, or superseded
      pendingRef.current = null;
      // Substring search: a query containing the previous one can only match
      // a subset, so the engine may reuse the previous results.
      const prev = previewQueryRef.current;
      handlers.onPredicateSelect((node: TreeNode) => node.name.toLowerCase().includes(q), {
        select: searchMode === "select",
        refinesPrevious: prev !== "" && q.includes(prev),
      });
      previewQueryRef.current = q;
    };
    pendingRef.current = { run, timeoutId: setTimeout(run, PREDICATE_DEBOUNCE_MS) };
    return () => {
      if (pendingRef.current?.run !== run) return;
      clearTimeout(pendingRef.current.timeoutId);
      pendingRef.current = null;
    };
  }, [query, handlers, searchMode]);

  /** Applies the pending preview now (no-op if there is none). */
  const flush = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    pending.run();
  }, []);

  return { flush };
}
