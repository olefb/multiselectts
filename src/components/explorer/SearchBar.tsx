import type { RefObject } from "react";
import type { Highlight } from "../../data/tasks";
import { highlightProps } from "./highlight";
import { isPredicateMode, type SearchMode } from "./layout";
import { useTelemetry } from "../../telemetry/context";
import type { ExplorerText } from "./text";

interface Props {
  inputRef?: RefObject<HTMLInputElement | null>;
  query: string;
  onQuery: (query: string) => void;
  searchMode: SearchMode;
  /** Seals the live predicate preview as one undoable step. */
  onCommit: () => void;
  /** Discards the live predicate preview. */
  onCancelPreview: () => void;
  /** Returns keyboard focus to the list. */
  focusViewport: () => void;
  /** Short note shown at the end of the row (what a predicate search changed). */
  notice?: string | null;
  /** Changes when the note should flash again (it appears, or the search is committed). */
  noticeKey?: string;
  /** Control(s) to outline (tutorial steps). */
  highlight?: Highlight | readonly Highlight[];
  text: ExplorerText;
}

/** Search box. In the predicate modes Enter / Commit seal the preview; Clear ✕ / Esc discard it. */
export function SearchBar({ inputRef, query, onQuery, searchMode, onCommit, onCancelPreview, focusViewport, notice, noticeKey, highlight, text }: Props) {
  const telemetry = useTelemetry();
  const clear = (via: "button" | "escape") => {
    telemetry.record({ type: "searchClear", mode: searchMode, query, via });
    onQuery("");
    if (isPredicateMode(searchMode)) onCancelPreview();
    focusViewport();
  };

  return (
    // Fixed row height: the note must not move the list when it appears or changes.
    <div style={{ display: "flex", gap: "10px", marginTop: "10px", alignItems: "center", height: "38px" }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            clear("escape");
            return;
          }
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (isPredicateMode(searchMode)) {
            telemetry.record({ type: "searchCommit", mode: searchMode, query, via: "enter" });
            onQuery("");
            onCommit();
          }
          focusViewport();
        }}
        placeholder={text.placeholders[searchMode]}
        {...highlightProps(highlight, "searchBox", { padding: "8px", width: "300px", borderRadius: "4px", border: "1px solid #ccc" })}
      />

      {query && (
        <button
          onClick={() => clear("button")}
          style={{
            padding: "8px 12px",
            cursor: "pointer",
            borderRadius: "4px",
            border: "1px solid #ccc",
            backgroundColor: "#fff",
            fontWeight: "bold",
            color: "#555",
          }}
        >
          {text.clear}
        </button>
      )}

      {isPredicateMode(searchMode) && (
        <button
          onClick={() => {
            telemetry.record({ type: "searchCommit", mode: searchMode, query, via: "button" });
            onQuery("");
            onCommit();
          }}
          style={{ padding: "8px 12px", cursor: "pointer" }}
        >
          {text.commit}
        </button>
      )}

      {notice && (
        <span
          // Flash when the note appears and again on Enter, not on every keystroke.
          key={noticeKey ?? notice}
          data-testid="hidden-matches"
          role="status"
          title={notice}
          style={{
            // Fixed width: the note must not widen the header (the selection
            // summary would wrap and push the list below the screen).
            flex: "0 0 320px",
            boxSizing: "border-box",
            maxHeight: "38px",
            overflow: "hidden",
            padding: "2px 8px",
            borderRadius: "6px",
            border: "1px solid #7aa7e6",
            background: "#e3efff",
            fontSize: "13px",
            fontWeight: 600,
            lineHeight: 1.25,
            color: "#0b3d91",
            textAlign: "left",
            // A short flash so the note is noticed (pilot: more visible note, index.css).
            animation: "hidden-note-in 1s ease-out",
          }}
        >
          {notice}
        </span>
      )}
    </div>
  );
}
