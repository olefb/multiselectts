import type { Highlight } from "../../data/tasks";
import type { ClickScope, StrategyName } from "../../lib/multiselect";
import { highlightProps } from "./highlight";
import type { SearchMode, ViewMode } from "./layout";
import type { ExplorerText } from "./text";

interface Props {
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  searchMode: SearchMode;
  onSearchMode: (mode: SearchMode) => void;
  /** Search modes offered, in order (the radio group is hidden when there is only one). */
  searchModes: readonly SearchMode[];
  strategyMode: StrategyName;
  /** Omit to hide the drag-strategy picker (study mode). */
  onStrategyMode?: (mode: StrategyName) => void;
  /** Omit to hide the "Show Selected Only" control (selection aids off). */
  showSelectedOnly?: boolean;
  onShowSelectedOnly?: (on: boolean) => void;
  /** Omit to hide the control (models without a configurable click scope). */
  clickScope?: ClickScope;
  onClickScope?: (scope: ClickScope) => void;
  /** Control(s) to outline (tutorial steps). */
  highlight?: Highlight | readonly Highlight[];
  text: ExplorerText;
}

/** Search modes a tutorial step can point at. */
const MODE_HIGHLIGHT: Partial<Record<SearchMode, Highlight>> = { select: "selectMatching", deselect: "deselectMatching" };

const STRATEGIES: Array<[StrategyName, string]> = [
  ["mixed", "Auto"],
  ["rectangular", "Box"],
  ["rowwise", "Range"],
  ["snake", "Snake"],
];

const groupStyle = { display: "flex", gap: "10px", fontSize: "13px", borderRight: "2px solid #ccc", paddingRight: "15px" };

/** View, search-mode, lasso-strategy and selection-policy controls. */
export function Toolbar({
  viewMode,
  onViewMode,
  searchMode,
  onSearchMode,
  searchModes,
  strategyMode,
  onStrategyMode,
  showSelectedOnly,
  onShowSelectedOnly,
  clickScope,
  onClickScope,
  highlight,
  text,
}: Props) {
  return (
    <div style={{ marginTop: "10px", display: "flex", gap: "15px", alignItems: "center" }}>
      {/* View mode */}
      <div
        style={{
          display: "flex",
          gap: "5px",
          ...(searchModes.length > 1 || onShowSelectedOnly || onClickScope || (viewMode === "grid" && onStrategyMode)
            ? { borderRight: "2px solid #ccc", paddingRight: "15px" }
            : {}),
        }}
      >
        <button onClick={() => onViewMode("tree")} {...highlightProps(highlight, "listView", { fontWeight: viewMode === "tree" ? "bold" : "normal" })}>
          {text.list}
        </button>
        <button onClick={() => onViewMode("grid")} style={{ fontWeight: viewMode === "grid" ? "bold" : "normal" }}>
          {text.grid}
        </button>
      </div>

      {/* What the search box does */}
      {searchModes.length > 1 && (
      <div style={groupStyle}>
        {searchModes.map((mode) => (
          <label key={mode} {...highlightProps(highlight, MODE_HIGHLIGHT[mode])}>
            <input
              type="radio"
              name="searchMode"
              checked={searchMode === mode}
              onChange={() => onSearchMode(mode)}
            />
            {text.searchModes[mode]}
          </label>
        ))}
      </div>
      )}

      {/* Drag strategy (grid only) */}
      {viewMode === "grid" && onStrategyMode && (
        <div style={groupStyle}>
          {STRATEGIES.map(([mode, label]) => (
            <label key={mode}>
              <input type="radio" checked={strategyMode === mode} onChange={() => onStrategyMode(mode)} />{" "}
              {label}
            </label>
          ))}
        </div>
      )}

      {/* Selection focus */}
      {onShowSelectedOnly && (
        <label
          {...highlightProps(highlight, "showSelectedOnly", {
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            cursor: "pointer",
            fontWeight: showSelectedOnly ? "bold" : "normal",
            color: showSelectedOnly ? "#2684FF" : "inherit",
          })}
        >
          <input
            type="checkbox"
            checked={!!showSelectedOnly}
            onChange={(e) => onShowSelectedOnly(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          {text.showSelectedOnly}
        </label>
      )}

      {/* Click-scope policy (study condition) */}
      {clickScope && onClickScope && (
        <label
          title="Whether a plain click also deselects items that are not currently visible"
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}
        >
          Click clears:
          <select value={clickScope} onChange={(e) => onClickScope(e.target.value as ClickScope)}>
            <option value="global">all selections</option>
            <option value="visible">visible only</option>
          </select>
        </label>
      )}
    </div>
  );
}
