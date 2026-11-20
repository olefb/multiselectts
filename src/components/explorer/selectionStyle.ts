// File: components/explorer/selectionStyle.ts
//
// The visual style matrix, shared by tree rows and grid cells:
//
//                      | not in active domain     | in active domain (preview)
//   -------------------+--------------------------+----------------------------
//   not selected       | plain                    | dashed accent, faint fill
//   selected           | thin solid accent, light | solid accent, deep fill
//
// The keyboard cursor overrides the border colour (orange). Grid cells use a
// 2px border for the active states and glow while active or focused.

export interface ItemState {
  selected: boolean;
  active: boolean;
  cursor: boolean;
}

export interface ItemStyle {
  border: string;
  background: string;
  glow: boolean;
}

const ACCENT = "#2684FF";
const CURSOR = "#FFA500";
const SELECTED_BG = "#E3F2FD";
const ACTIVE_SELECTED_BG = "#B3D7FF";
const PREVIEW_BG = "rgba(38, 132, 255, 0.05)";

export const GLOW_SHADOW = "0 0 8px rgba(38, 132, 255, 0.4)";

export function selectionStyle(view: "tree" | "grid", s: ItemState): ItemStyle {
  const strong = view === "grid" ? "2px" : "1px";
  let border = view === "grid" ? "1px solid #eee" : "1px solid transparent";
  let background = view === "grid" ? "white" : "transparent";

  if (s.selected && s.active) {
    border = `${strong} solid ${ACCENT}`;
    background = ACTIVE_SELECTED_BG;
  } else if (s.active) {
    border = `${strong} dashed ${ACCENT}`;
    background = PREVIEW_BG;
  } else if (s.selected) {
    border = `1px solid ${ACCENT}`;
    background = SELECTED_BG;
  }
  if (s.cursor) border = `${strong} solid ${CURSOR}`;

  return { border, background, glow: s.active || s.cursor };
}
