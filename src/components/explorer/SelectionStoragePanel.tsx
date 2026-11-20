interface Props {
  selected: ReadonlySet<string>;
  nameOf: (id: string) => string;
}

/** Thesis verification panel: the current selection, resolved to names. */
export function SelectionStoragePanel({ selected, nameOf }: Props) {
  return (
    <div
      style={{
        marginTop: "15px",
        padding: "10px",
        backgroundColor: "#f9f9f9",
        border: "1px dashed #ccc",
        borderRadius: "4px",
      }}
    >
      <h4 style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#555" }}>Selection Storage:</h4>
      <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#666", wordBreak: "break-all" }}>
        {selected.size === 0 ? "Empty Set (No active selection)" : Array.from(selected, nameOf).join(", ")}
      </div>
    </div>
  );
}
