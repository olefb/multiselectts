import type { CSSProperties } from "react";
import type { Highlight } from "../../data/tasks";

/**
 * Pulsing outline on the control a tutorial step is about (keyframes in
 * index.css). Pilot 1: participants did not find the search modes and
 * "Show selected only" on their own.
 */
const STYLE: CSSProperties = {
  outline: "3px solid #f9a825",
  outlineOffset: "3px",
  borderRadius: "4px",
  animation: "tutorial-highlight 1.4s ease-in-out infinite",
};

/** Props that mark an element as the highlighted control (data-highlight for tests). */
export function highlightProps(highlight: Highlight | readonly Highlight[] | undefined, control: Highlight | undefined, style?: CSSProperties) {
  const on = control !== undefined && (Array.isArray(highlight) ? highlight.includes(control) : highlight === control);
  return on ? { "data-highlight": control, style: { ...style, ...STYLE } } : { style };
}
