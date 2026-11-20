// File: telemetry/schema.ts
//
// Format of a telemetry log: one JSON file per session (participant).
// Times `t` are milliseconds since the session started (0.1 ms resolution).
// Coordinates are in the list/grid's content space (scroll-independent px).
// Item IDs are dataset IDs (slash-separated name paths for task datasets).
//
// Gesture counting (methodology §10.2) is derived in analysis from:
//   press (one per click / Ctrl-click / Shift-click / drag start),
//   key events whose `command` changes the selection, and searchCommit.

import type { TaskScore } from "../data/tasks";

export const TELEMETRY_SCHEMA = "multiselect-telemetry/1";

/** Modifier keys of a press (Ctrl means Ctrl or ⌘). "ctrlShift" since study-2.8; earlier builds logged Ctrl+Shift as "shift". */
export type Modifier = "none" | "ctrl" | "shift" | "ctrlShift";

/** Every event body; `t` is added by the recorder. */
export type TelemetryEventBody =
  // --- Session / study structure
  | { type: "context"; model: string; dataset: string; task: string | null; undo: boolean; aids: boolean }
  | {
      type: "taskStart";
      task: string;
      view: "tree" | "grid";
      targets: string[];
      keep: string[];
      preselected: string[];
      /** Study mode: tutorial step or measured task, and the block (0 = System A, 1 = System B). */
      kind?: "tutorial" | "task";
      block?: number;
    }
  | {
      type: "taskEnd";
      task: string;
      /**
       * Why the task ended: participant pressed Done, used Skip, the session
       * moved on (abandoned), or a practice step was started again ("restarted";
       * the next taskStart for the same step is the new attempt).
       */
      reason: "done" | "skipped" | "abandoned" | "restarted";
      /** ms from taskStart. */
      duration: number;
      selected: string[];
      score: TaskScore;
    }
  | { type: "note"; text: string }
  // --- Study harness (study mode)
  /** A study screen was shown (consent, blockIntro, tutorial, taskIntro, task, seq, ...). */
  | { type: "screen"; screen: string; block: number | null; task: string | null }
  /** A questionnaire answer (7-point items are numbers 1-7; choices are strings; null = skipped). */
  | { type: "answer"; question: string; value: string | number | null; block: number | null; task: string | null }
  /** The study ended: completed normally, or stopped early by the participant. */
  | { type: "studyEnd"; completed: boolean }
  /** The browser viewport changed size during a session (full screen left or entered, zoom changed). */
  | { type: "viewport"; width: number; height: number; devicePixelRatio: number }
  // --- Pointer
  | { type: "press"; x: number; y: number; item: string | null; modifier: Modifier; clickCount: number }
  | { type: "release"; x: number; y: number; item: string | null; dragged: boolean }
  | { type: "doubleClick"; item: string }
  | { type: "move"; x: number; y: number; dragging: boolean }
  | { type: "scroll"; top: number }
  // --- Keyboard (only keys the explorer handles; typing in the search box is logged as searchInput)
  | { type: "key"; key: string; ctrl: boolean; shift: boolean; alt: boolean; command: KeyCommand }
  // --- View state
  | { type: "view"; mode: "tree" | "grid" }
  | { type: "navigate"; folder: string | null; via: "doubleClick" | "enter" | "breadcrumb" | "up" | "key" }
  | { type: "expand"; folder: string; expanded: boolean; via: "chevron" | "key" }
  | { type: "searchMode"; mode: string }
  | { type: "searchInput"; mode: string; query: string }
  | { type: "searchCommit"; mode: string; query: string; via: "enter" | "button" }
  | { type: "searchClear"; mode: string; query: string; via: "button" | "escape" }
  | { type: "button"; name: "selectAll" | "deselectAll" }
  | { type: "setting"; name: string; value: string | boolean }
  // --- Selection state (diff after every change)
  | { type: "selection"; added: string[]; removed: string[]; size: number; undo: number; redo: number };

export type KeyCommand =
  | "move" // arrow / Home / End / PageUp / PageDown: move and select
  | "extend" // Shift + navigation key
  | "moveCursor" // Ctrl + navigation key
  | "select" // Space
  | "toggle" // Ctrl+Space
  | "selectAll"
  | "invert"
  | "escape"
  | "undo"
  | "redo"
  | "search" // Ctrl+F
  | "open" // Enter on a folder (grid)
  | "expand" // Enter / ← / → on a folder (tree)
  | "up"; // Backspace / Alt+↑

export type TelemetryEvent = TelemetryEventBody & { t: number };

export interface SessionHeader {
  schema: typeof TELEMETRY_SCHEMA;
  sessionId: string;
  /** Wall-clock start (ISO 8601). */
  startedAt: string;
  app: { commit: string };
  /** Viewport when the session started (study mode: at hand-over; before that, at page load). */
  screen: { viewportWidth: number; viewportHeight: number; devicePixelRatio: number };
  /** Free-form session metadata (participant group, main OS, ...), set by the study harness. */
  meta: Record<string, unknown>;
}

export interface TelemetryLog extends SessionHeader {
  events: TelemetryEvent[];
}
