// File: components/explorer/text.ts
//
// Labels of the explorer UI. "dev" is the experimenter/developer view (the
// e2e tests use these labels); "en" and "nb" are the participant-facing labels
// in study mode. Tutorial texts in the datasets quote the study labels (“…” in
// English, «…» in Norwegian); a unit test checks that they match.

import type { SearchMode } from "./layout";

/** Whether a match note describes a live preview or an applied one. */
export type MatchState = "live" | "kept";

export interface ExplorerText {
  title: string;
  list: string;
  grid: string;
  searchModes: Record<SearchMode, string>;
  placeholders: Record<SearchMode, string>;
  clear: string;
  /** Seals the live predicate preview. */
  commit: string;
  showSelectedOnly: string;
  selected: (n: number) => string;
  notVisible: (n: number) => string;
  /**
   * Note next to the search box: files the last "Select / Deselect matching"
   * changed that are not visible (names as "file (folder)", `more` = not listed).
   */
  /**
   * Note next to the search box after "Select / Deselect matching": how many
   * files changed, and the first of those not on screen (folded away, filtered
   * out or scrolled out of view). The count comes first: the note is two lines
   * high, and a trailing "and N more" was cut off (pilot).
   *
   * `state` "live" (revision 23): the preview is not applied yet, so the note
   * gives the count and says to press Enter, without the file names (the row
   * is two lines high; they return after Enter, when the note flashes again).
   * Participants typed a second query or switched mode without pressing Enter
   * and lost the first result.
   */
  matchNote: (
    mode: "select" | "deselect",
    total: number,
    hidden: string[],
    hiddenTotal: number,
    state?: MatchState,
  ) => string;
  /** Note next to the search box while a search hides selected files (predicate system, selection aid). */
  hiddenBySearch: (n: number) => string;
  selectAll: string;
  deselectAll: string;
  up: string;
  root: string;
}

const DEV: ExplorerText = {
  title: "File Explorer",
  list: "List (Tree)",
  grid: "Icon (Grid)",
  searchModes: {
    filter: "Filter View (Mask)",
    exclude: "Exclude View",
    select: "Select Items (Predicate)",
    deselect: "Deselect Items (Predicate)",
  },
  placeholders: {
    filter: "Hide everything else...",
    exclude: "Hide matching files...",
    select: "Select matching files...",
    deselect: "Deselect matching files...",
  },
  clear: "Clear ✕",
  commit: "Commit Selection",
  showSelectedOnly: "Show Selected Only",
  selected: (n) => `Selected: ${n}`,
  notVisible: (n) => `(${n} not visible)`,
  matchNote: (mode, total, hidden, hiddenTotal, state) =>
    `${total} ${mode === "select" ? "selected" : "deselected"}` +
    (state === "live" ? " – press Enter to keep" : "") +
    (hiddenTotal === 0 || state === "live" ? "" : `, ${hiddenTotal} not visible: ${hidden.join(", ")}${hiddenTotal > hidden.length ? " …" : ""}`),
  hiddenBySearch: (n) => `${n} selected ${n === 1 ? "file is" : "files are"} hidden by the search but still selected.`,
  selectAll: "Select All",
  deselectAll: "Deselect All",
  up: "Up ⬆",
  root: "Root",
};

const EN: ExplorerText = {
  title: "Files",
  list: "List",
  grid: "Icons",
  searchModes: {
    filter: "Search",
    exclude: "Hide matching",
    select: "Select matching",
    deselect: "Deselect matching",
  },
  placeholders: {
    filter: "Search...",
    exclude: "Hide files matching...",
    select: "Select files matching...",
    deselect: "Deselect files matching...",
  },
  clear: "Clear ✕",
  commit: "Apply",
  showSelectedOnly: "Show selected only",
  selected: (n) => `Selected: ${n}`,
  notVisible: (n) => `(${n} not visible)`,
  matchNote: (mode, total, hidden, hiddenTotal, state) =>
    `${total} ${mode === "select" ? "selected" : "deselected"}` +
    (state === "live" ? " – press Enter to keep" : "") +
    (hiddenTotal === 0 || state === "live" ? "" : `, ${hiddenTotal} not visible: ${hidden.join(", ")}${hiddenTotal > hidden.length ? " …" : ""}`),
  hiddenBySearch: (n) => `${n} selected ${n === 1 ? "file is" : "files are"} hidden by the search but still selected.`,
  selectAll: "Select all",
  deselectAll: "Select none",
  up: "Up ⬆",
  root: "Files",
};

const NB: ExplorerText = {
  title: "Filer",
  list: "Liste",
  grid: "Ikoner",
  searchModes: {
    filter: "Søk",
    exclude: "Skjul treff",
    select: "Merk alle treff",
    deselect: "Fjern merking av treff",
  },
  placeholders: {
    filter: "Søk...",
    exclude: "Skjul filer som inneholder...",
    select: "Merk filer som inneholder...",
    deselect: "Fjern merking av filer som inneholder...",
  },
  clear: "Tøm ✕",
  commit: "Bruk",
  showSelectedOnly: "Vis bare merkede",
  selected: (n) => `Merket: ${n}`,
  notVisible: (n) => `(${n} ikke ${n === 1 ? "synlig" : "synlige"})`,
  matchNote: (mode, total, hidden, hiddenTotal, state) =>
    `${total} ${mode === "select" ? "merket" : "fjernet fra merkingen"}` +
    (state === "live" ? " – trykk Enter for å beholde" : "") +
    (hiddenTotal === 0 || state === "live"
      ? ""
      : `, ${hiddenTotal} ikke ${hiddenTotal === 1 ? "synlig" : "synlige"}: ${hidden.join(", ")}${hiddenTotal > hidden.length ? " …" : ""}`),
  hiddenBySearch: (n) =>
    n === 1 ? "1 merket fil er skjult av søket, men fortsatt merket." : `${n} merkede filer er skjult av søket, men fortsatt merket.`,
  selectAll: "Merk alt",
  deselectAll: "Merk ingen",
  up: "Opp ⬆",
  root: "Filer",
};

export const EXPLORER_TEXT = { dev: DEV, en: EN, nb: NB } as const;
