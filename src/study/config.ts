// File: study/config.ts
//
// Configuration of the user study (docs/study-methodology.md). Everything a
// supervisor decision can change lives here; bump `version` whenever the
// protocol changes after the pilot (it is written into every log).

import type { Lang } from "../data/tasks";

/** The two systems compared (participants see them as "System A" / "System B"). */
export type StudySystem = "predicate" | "traditional";
export type DatasetKey = "D1" | "D2";
export type GroupId = "G1" | "G2" | "G3" | "G4";
export type MainOs = "windows" | "macos" | "linux" | "other";
/** Traditional preset: matched to the participant's main OS, or fixed. */
export type BaselineChoice = "os-matched" | "windows" | "mac";

export interface BlockSpec {
  system: StudySystem;
  dataset: DatasetKey;
}

export interface TutorialStepSpec {
  /** Task ID in the block's dataset. */
  task: string;
  /** Only for these systems (default: both). */
  systems?: StudySystem[];
  /** Only in the first block (steps that are the same in both systems). */
  firstBlockOnly?: boolean;
  /** Only in blocks with the selection aids (the step practises "Show selected only"). */
  requiresAids?: boolean;
}

export interface StudyConfig {
  version: string;
  /** Dataset IDs (src/data/datasets/<id>.json) of D1 and D2. */
  datasets: Record<DatasetKey, string>;
  /** Counterbalancing groups (methodology §3.1): system order × dataset. */
  groups: Record<GroupId, [BlockSpec, BlockSpec]>;
  baseline: BaselineChoice;
  /** Undo/redo and selection aids ("Show selected only", "(N not visible)", folder badges) per system. */
  systems: Record<StudySystem, { undo: boolean; aids: boolean }>;
  tutorial: TutorialStepSpec[];
  /** Measured tasks, in order, identical in both blocks. */
  tasks: string[];
  /** "Skip task" appears after this long on a task (null: never). */
  taskSkipAfterMs: number | null;
  /** "Skip this step" appears after this long on a tutorial step (null: never). */
  tutorialSkipAfterMs: number | null;
  /** Answer buttons (Start, Next, Done, rating scales) are inactive this long after they appear (0: off). */
  screenGuardMs: number;
  /** Height of the file list/grid in px (fits the instruction bar and toolbar into the viewport below). */
  explorerHeight: number;
  /** The same in tasks, whose instruction bar also lists the system's tools. */
  taskExplorerHeight: number;
  /**
   * Browser viewport of the study laptop as set up for sessions (full screen,
   * fixed zoom). The setup screen warns when the viewport differs by more than
   * `viewportSlack` px, which catches a forgotten F11 or a changed zoom.
   */
  viewport: { width: number; height: number };
  viewportSlack: number;
  /** Smallest viewport every study screen fits without page scrolling. */
  minViewport: { width: number; height: number };
  languages: Lang[];
  /** Shown on the consent screen. Replace the placeholders before the pilot. */
  contact: string;
  /** How long the anonymous data are kept (consent screen), per language. */
  retention: Record<Lang, string>;
}

export const STUDY: StudyConfig = {
  version: "study-3.8", // study-1: pilot 1 (study-data/pilot-1/); study-2: own test run (pilot); 2.1 → 2.2: wording; 2.7: review fixes; 2.8: Explorer check; 2.9: practice steps as numbered lists; 2.10: hidden-by-search note; 2.11: Shift-click after a click in blank space; 2.12: dog-only subfolders, slow double-click; 3: Task D (keep-and-extend) added after C; 3.1: permanent scrollbar on the file list; 3.2: bold step numbers; 3.3: a press on the scrollbar no longer selects; 3.4: drag from below the rows, leave-page guard; 3.5: "press Enter to keep" in the match note; 3.6: Finder-like preset checked against Finder; 3.7: Ctrl+Space in Helium; 3.8: practice range step names no files, minimum age 18 → 16 on the consent screen
  datasets: { D1: "pets-demo", D2: "pets-demo-2" },
  groups: {
    G1: [{ system: "predicate", dataset: "D1" }, { system: "traditional", dataset: "D2" }],
    G2: [{ system: "predicate", dataset: "D2" }, { system: "traditional", dataset: "D1" }],
    G3: [{ system: "traditional", dataset: "D1" }, { system: "predicate", dataset: "D2" }],
    G4: [{ system: "traditional", dataset: "D2" }, { system: "predicate", dataset: "D1" }],
  },
  baseline: "os-matched", // methodology §3.2
  systems: {
    predicate: { undo: false, aids: true },
    traditional: { undo: false, aids: false }, // methodology §7: aids in the predicate system only
  },
  tutorial: [
    { task: "tutorial-warmup" }, // timed: the simple-selection measurement (H1), in both blocks
    { task: "tutorial-range", firstBlockOnly: true }, // range, then Ctrl-click deselect (one step since revision 8)
    { task: "tutorial-search", firstBlockOnly: true },
    { task: "tutorial-list-view", firstBlockOnly: true }, // list view and folder arrows (one way to reach Task B's other folder)
    { task: "tutorial-select-matching", systems: ["predicate"] }, // select and deselect matching (one step since revision 8)
    { task: "tutorial-show-selected", requiresAids: true },
  ],
  // Task D (revision 18) comes last, so Tasks A-C run exactly as in earlier sessions.
  tasks: ["keep-what-you-have", "context-switch", "rule-with-exceptions", "keep-and-extend"],
  taskSkipAfterMs: 120_000, // methodology §8.3: soft skip after 2 min
  tutorialSkipAfterMs: 60_000, // per step, so a stuck participant still sees the remaining steps
  screenGuardMs: 0, // off since 2.8 (was 1500 ms from 2.1: mostly annoying in sessions); `&guard=<s>` turns it on
  explorerHeight: 570,
  taskExplorerHeight: 540,
  // Lenovo Legion 5 Pro: 2560×1600 panel, Plasma scale 125 %, browser zoom 150 %, F11.
  viewport: { width: 1365, height: 853 },
  viewportSlack: 2,
  minViewport: { width: 1280, height: 800 },
  languages: ["en", "nb"],
  contact: "Ole Birketvedt, ole.birketvedt@uib.no, University of Bergen (supervisors: Jaakko Järvi, Mikhail Barash)",
  retention: {
    en: "until the thesis has been graded, at the latest 1 January 2027",
    nb: "til oppgaven er sensurert, senest 1. januar 2027",
  },
};

/** Placeholders ("[...]") still in the configuration; shown as a warning before a session. */
export function configPlaceholders(config: StudyConfig): string[] {
  const texts = [config.contact, ...Object.values(config.retention)];
  return texts.filter((t) => /\[[^\]]+\]/.test(t));
}
