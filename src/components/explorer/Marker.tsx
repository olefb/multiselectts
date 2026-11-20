import type { CSSProperties } from "react";
import type { MarkerKind } from "../../data/tasks";

// One colour for both kinds (pilot 1: a second, orange flag read as "remove this").
// The kind stays in data-marker and the accessible label.
const COLORS: Record<MarkerKind, string> = { target: "#1565C0", keep: "#1565C0" };
const LABELS: Record<MarkerKind, string> = { target: "Select this item", keep: "Keep this item selected" };

/** Task marker flag: "target" = select this, "keep" = already selected, keep it (same look). */
export function Marker({ kind, style }: { kind: MarkerKind; style?: CSSProperties }) {
  const color = COLORS[kind];
  return (
    <svg data-marker={kind} role="img" aria-label={LABELS[kind]} width="12" height="14" viewBox="0 0 12 14" style={style}>
      <title>{LABELS[kind]}</title>
      <line x1="1.5" y1="1" x2="1.5" y2="13.5" stroke={color} strokeWidth="1.5" />
      <polygon points="2,1 11,4.5 2,8" fill={color} />
    </svg>
  );
}
