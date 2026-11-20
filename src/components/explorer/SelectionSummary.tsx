import type { ExplorerText } from "./text";

interface Props {
  selectedCount: number;
  /** Selected elements not in the current projection. */
  hiddenCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  /** Undo/redo depths; omit for models without selection history. */
  history?: { undo: number; redo: number };
  /** Shown as "dataset <label>" (e.g. "seed 20260923", "pets-demo"). */
  /** Omit to hide the footnote (study mode: participants must not see the model). */
  datasetLabel?: string;
  modelLabel?: string;
  text: ExplorerText;
  /** Neutral button style (study mode). */
  plain?: boolean;
}

const bulkButtonStyle = {
  fontSize: "11px",
  padding: "3px 8px",
  cursor: "pointer",
  borderRadius: "3px",
  border: "1px solid #ccc",
  backgroundColor: "#de0d0d",
};

/** Selection count, bulk actions and history counters (right side of the header). */
export function SelectionSummary({
  selectedCount,
  hiddenCount,
  onSelectAll,
  onDeselectAll,
  history,
  datasetLabel,
  modelLabel,
  text,
  plain,
}: Props) {
  const buttonStyle = plain ? { ...bulkButtonStyle, fontSize: "13px", backgroundColor: "#fff", color: "#222" } : bulkButtonStyle;
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontWeight: "bold", fontSize: "16px", color: "#2684FF" }}>
        {text.selected(selectedCount)}
        {hiddenCount > 0 && (
          <span style={{ fontWeight: "normal", fontSize: "12px", color: "#555" }}>
            {" "}{text.notVisible(hiddenCount)}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "6px" }}>
        <button onClick={onSelectAll} style={buttonStyle}>
          {text.selectAll}
        </button>
        <button onClick={onDeselectAll} style={buttonStyle}>
          {text.deselectAll}
        </button>
      </div>

      {history && (
        <div style={{ fontSize: "11px", color: "#999", marginTop: "8px" }}>
          <b>Ctrl+Z</b> undo ({history.undo}) · <b>Ctrl+Shift+Z</b> redo ({history.redo})
        </div>
      )}
      {datasetLabel !== undefined && (
        <div style={{ fontSize: "10px", color: "#bbb", marginTop: "2px" }}>
          dataset {datasetLabel}
          {modelLabel && ` · ${modelLabel}`}
        </div>
      )}
    </div>
  );
}
