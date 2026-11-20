// File: data/tasks.ts
//
// Task specifications live next to their dataset (the "tasks" section of a
// dataset JSON file). A task fixes the starting view, the pre-selection, the
// markers participants see, and the target set used for scoring.

/** Languages of the participant-facing texts (study mode). */
export const LANGS = ["en", "nb"] as const;
export type Lang = (typeof LANGS)[number];

/** A text in one language (English), or per language with English required. */
export type LocalizedText = string | ({ en: string } & Partial<Record<Lang, string>>);

/** The text in `lang`, falling back to English. */
export function localize(text: LocalizedText | undefined, lang: Lang): string | undefined {
  if (text === undefined || typeof text === "string") return text;
  return text[lang] ?? text.en;
}

/** A task as written in a dataset JSON file (IDs are the slash-separated name paths). */
export interface TaskFileEntry {
  title?: string;
  /**
   * Shown to the participant (a string, or per language: { "en": ..., "nb": ... }).
   * Line breaks are kept: tasks put each numbered step on its own line.
   */
  instructions?: LocalizedText;
  /** Tutorial steps: shown in place of the instructions once the step is done. */
  doneNote?: LocalizedText;
  /** Starting view (default "tree"). */
  view?: "tree" | "grid";
  /** Grid view: folder that is open at the start (default: root). */
  folder?: string;
  /** List view: folders expanded at the start (default: the first two root folders). */
  expanded?: string[];
  /** Selected at the start, outside the history (cannot be undone). */
  preselected?: string[];
  /** Selected items that must still be selected at the end (flagged like targets). */
  keep?: string[];
  /**
   * Range anchor at the start (the fixed end of a Shift-click range), as if
   * the participant had made the pre-selection: Task A, the first kept photo.
   */
  anchor?: string;
  /** Active end (keyboard focus) at the start; defaults to `anchor`. Task A: the last kept photo. */
  focus?: string;
  /** Item shown as the first row at the start (the list starts scrolled), so all targets are in view. */
  scrollTo?: string;
  /** Must be selected at the end. */
  targets?: string[];
  /** Show a blue flag on each target (default true). Off for rule- or picture-based tasks. */
  markTargets?: boolean;
  /**
   * Tutorial steps: explorer state that must also hold before the step passes,
   * for steps that practise a control (the view switch, "Show selected only").
   */
  requires?: Partial<ExplorerViewState>;
  /** Tutorial steps: the control(s) the step is about, outlined in the explorer. */
  highlight?: Highlight | Highlight[];
}

/** Explorer controls a tutorial step can point at. */
export const HIGHLIGHTS = ["searchBox", "listView", "selectMatching", "deselectMatching", "showSelectedOnly"] as const;
export type Highlight = (typeof HIGHLIGHTS)[number];

/** The parts of the explorer's view state a tutorial step can require. */
export interface ExplorerViewState {
  view: "tree" | "grid";
  /** "Show selected only" is on (always false when the selection aids are off). */
  showSelectedOnly: boolean;
}

/** True if `state` satisfies the task's `requires` (always true without one). */
export function meetsRequirements(task: TaskFileEntry, state: ExplorerViewState): boolean {
  const r = task.requires ?? {};
  return (r.view === undefined || r.view === state.view) && (r.showSelectedOnly === undefined || r.showSelectedOnly === state.showSelectedOnly);
}

export interface TaskSpec extends TaskFileEntry {
  id: string;
}

export type MarkerKind = "target" | "keep";

/** Which items carry a marker. "keep" wins over "target". */
export function taskMarkers(task: TaskSpec | undefined): ReadonlyMap<string, MarkerKind> {
  const markers = new Map<string, MarkerKind>();
  if (!task) return markers;
  if (task.markTargets !== false) for (const id of task.targets ?? []) markers.set(id, "target");
  for (const id of task.keep ?? []) markers.set(id, "keep");
  return markers;
}

export interface TaskScore {
  /** Final selection equals targets ∪ keep. */
  exact: boolean;
  /** Required (targets ∪ keep) but not selected. */
  missing: string[];
  /** Selected but not required. */
  extra: string[];
  /** "keep" items that are no longer selected. */
  keepLost: string[];
  /** (missing + extra) / required, the NIK 2016 exclusion measure. */
  errorRate: number;
}

/** Scores a final selection against a task. */
export function evaluateTask(task: TaskSpec, selected: ReadonlySet<string>): TaskScore {
  const keep = task.keep ?? [];
  const required = new Set([...(task.targets ?? []), ...keep]);
  const missing = [...required].filter((id) => !selected.has(id)).sort();
  const extra = [...selected].filter((id) => !required.has(id)).sort();
  const keepLost = keep.filter((id) => !selected.has(id)).sort();
  const errors = missing.length + extra.length;
  return {
    exact: errors === 0,
    missing,
    extra,
    keepLost,
    errorRate: required.size === 0 ? (errors === 0 ? 0 : 1) : errors / required.size,
  };
}
