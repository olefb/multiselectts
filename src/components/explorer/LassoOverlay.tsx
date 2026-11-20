import type { Point } from "../../hooks/useSelection";
import type { StrategyName } from "../../lib/multiselect";

interface Props {
  /** Concrete strategy being drawn ("mixed" is resolved by the caller). */
  mode: Exclude<StrategyName, "mixed">;
  start: Point;
  end: Point;
  path: Point[];
  isBacktracking: boolean;
  /** Current scroll offset; points are in virtual coordinates. */
  scrollOffset: number;
  /** Height of the scroll viewport (px). */
  height: number;
}

/** Visual feedback for an in-progress drag: box, range line or snake path. */
export function LassoOverlay({ mode, start, end, path, isBacktracking, scrollOffset, height }: Props) {
  const tipColor = isBacktracking ? "#FF4444" : "#2684FF";
  const last = path[path.length - 1];

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: `${height}px`,
        pointerEvents: "none",
        zIndex: 100,
        transform: `translateY(${scrollOffset}px)`,
      }}
    >
      {mode === "rectangular" && (
        <div
          style={{
            position: "absolute",
            border: "1px solid #0078d7",
            backgroundColor: "rgba(0,120,215,0.15)",
            left: Math.min(start.x, end.x),
            top: Math.min(start.y, end.y) - scrollOffset,
            width: Math.abs(start.x - end.x),
            height: Math.abs(start.y - end.y),
          }}
        />
      )}
      {(mode === "snake" || mode === "rowwise") && (
        <svg style={{ width: "100%", height: "100%", overflow: "visible" }}>
          <polyline
            points={path.map((p) => `${p.x},${p.y - scrollOffset}`).join(" ")}
            fill="none"
            stroke={mode === "snake" ? "#2684FF" : "rgba(38, 132, 255, 0.3)"}
            strokeWidth={mode === "snake" ? "3" : "2"}
            strokeDasharray={mode === "rowwise" ? "4,4" : "none"}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {mode === "snake" && last && (
            <line
              x1={last.x}
              y1={last.y - scrollOffset}
              x2={end.x}
              y2={end.y - scrollOffset}
              stroke={tipColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}
          <circle cx={end.x} cy={end.y - scrollOffset} r="4" fill={tipColor} />
        </svg>
      )}
    </div>
  );
}
