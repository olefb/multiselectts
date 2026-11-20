interface Props {
  /** Show the undo/redo row (models with selection history). */
  undo: boolean;
}

const SHORTCUTS: Array<[string, string, boolean?]> = [
  ["↑ ↓ ← →", "Move and select (tree: ←/→ also collapse/expand folders)"],
  ["Home / End, PageUp / PageDown", "Jump to first / last item, or by a screenful"],
  ["Shift + any of the above", "Extend the range from the anchor"],
  ["Ctrl + any of the above", "Move the cursor without selecting"],
  ["Space / Ctrl+Space", "Select / toggle the item at the cursor"],
  ["Ctrl+A", "Select all visible items"],
  ["Ctrl+I", "Invert the selection of the visible items"],
  ["Esc", "Discard the search preview, otherwise deselect all"],
  ["Ctrl+Z / Ctrl+Shift+Z", "Undo / redo selection changes", true],
  ["Ctrl+F", "Search (Esc in the search box clears it)"],
  ["Enter", "Open folder (grid) / expand or collapse it (tree)"],
  ["Backspace or Alt+↑", "Up one folder (grid)"],
];

/** Collapsible list of keyboard shortcuts. "Ctrl" also means ⌘ on macOS. */
export function ShortcutHelp({ undo }: Props) {
  return (
    <details style={{ marginTop: "10px", fontSize: "12px", color: "#555" }}>
      <summary style={{ cursor: "pointer" }}>Keyboard shortcuts</summary>
      <table style={{ borderCollapse: "collapse", marginTop: "6px" }}>
        <tbody>
          {SHORTCUTS.filter(([, , needsUndo]) => undo || !needsUndo).map(([keys, action]) => (
            <tr key={keys}>
              <td style={{ padding: "2px 16px 2px 0", fontFamily: "monospace", whiteSpace: "nowrap" }}>{keys}</td>
              <td style={{ padding: "2px 0" }}>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: "4px", color: "#999" }}>On macOS, Ctrl also works as ⌘.</div>
    </details>
  );
}
