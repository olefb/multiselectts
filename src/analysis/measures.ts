// File: analysis/measures.ts
//
// Turns study telemetry logs (study-data/<P-id>.json) into tidy tables for the
// statistics (analysis/ Python package). One row per:
//   sessions : participant
//   tasks    : participant × tutorial step or task attempt
//   blocks   : participant × block (System A / B)
//   answers  : participant × questionnaire item (without the free-text comment)
//   comments : participant with a comment (kept apart: free text)
// plus data-quality issues. Definitions follow docs/study-methodology.md §10.
// Pure functions, no file I/O (see scripts/analysis/extract.ts).

import type { KeyCommand, TelemetryEvent, TelemetryLog } from "../telemetry/schema";

/** Key commands that change the selection (count as gestures). */
export const SELECTION_KEYS: ReadonlySet<KeyCommand> = new Set<KeyCommand>([
  "move",
  "extend",
  "select",
  "toggle",
  "selectAll",
  "invert",
  "escape",
  "undo",
  "redo",
]);

/** Events that count as the participant's first input in a task (not mouse movement or scrolling). */
const INPUT_EVENTS: ReadonlySet<TelemetryEvent["type"]> = new Set<TelemetryEvent["type"]>([
  "press",
  "key",
  "searchInput",
  "searchCommit",
  "searchClear",
  "searchMode",
  "button",
  "view",
  "navigate",
  "expand",
  "setting",
]);

/** Search modes with a live, selecting preview ("Select / Deselect matching"). */
const PREDICATE_MODES: ReadonlySet<string> = new Set(["select", "deselect"]);
const SEARCH_EVENTS: ReadonlySet<TelemetryEvent["type"]> = new Set<TelemetryEvent["type"]>([
  "searchInput",
  "searchMode",
  "searchClear",
  "searchCommit",
]);
/** Events after which a selection change is the participant's own gesture, not a search preview. */
const GESTURE_EVENTS: ReadonlySet<TelemetryEvent["type"]> = new Set<TelemetryEvent["type"]>(["press", "key", "button"]);

/** Share of wrong items (missing + extra, relative to the required items) above which an attempt is excluded from time and gesture analyses. */
export const ERROR_EXCLUSION_RATE = 0.1;

interface BlockMeta {
  label: string;
  system: string;
  model: string;
  dataset: string;
  datasetKey: string;
  undo: boolean;
  aids: boolean;
}

interface StudyMeta {
  version?: string;
  group?: string;
  pilot?: boolean;
  completed?: boolean;
  stoppedAt?: string;
  language?: string;
  os?: string;
  knowsExperimenter?: boolean;
  blocks?: BlockMeta[];
}

export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;

export interface SessionRow extends Row {
  participant: string;
  version: string | null;
  commit: string;
  group: string | null;
  pilot: boolean;
  completed: boolean;
  stoppedAt: string | null;
  language: string | null;
  os: string | null;
  knowsExperimenter: boolean | null;
  startedAt: string;
  viewportWidth: number;
  viewportHeight: number;
  systemA: string | null;
  modelA: string | null;
  datasetA: string | null;
  systemB: string | null;
  modelB: string | null;
  datasetB: string | null;
  /** Model of the traditional block ("windows" / "mac"). */
  baseline: string | null;
  /** Consent screen → end of the study (or last event), ms. */
  sessionMs: number | null;
  preference: string | null;
  /** Preference translated to the system: "predicate" / "traditional" / "none". */
  preferredSystem: string | null;
  lostSelection: string | null;
  /** Systems in which the participant says they lost a selection: "none" / "predicate" / "traditional" / "both". */
  lostSelectionSystem: string | null;
}

export interface TaskRow extends Row {
  participant: string;
  group: string | null;
  block: number;
  label: string | null;
  system: string | null;
  model: string;
  dataset: string;
  kind: string;
  task: string;
  /** done / skipped / abandoned / restarted (practice steps only). */
  reason: string;
  /** Times of taskStart and taskEnd, ms since the session started. */
  startT: number;
  endT: number;
  /** taskStart → taskEnd, ms. */
  durationMs: number;
  /** First input → taskEnd, ms (the methodology's completion time); null without input. */
  activeMs: number | null;
  /** taskStart → first input, ms. */
  firstInputMs: number | null;
  /** clicks + ctrlClicks + shiftClicks + drags + selectionKeys + searchCommits + selectionButtons. */
  gestures: number;
  clicks: number;
  ctrlClicks: number;
  shiftClicks: number;
  drags: number;
  doubleClicks: number;
  selectionKeys: number;
  searchCommits: number;
  selectionButtons: number;
  exact: boolean;
  missing: number;
  extra: number;
  keepLost: number;
  errorRate: number;
  /** errorRate > ERROR_EXCLUSION_RATE. */
  excludedForErrors: boolean;
  /** Selection changes that removed at least one selected required item (target or orange). */
  lossEvents: number;
  /** Required items that were selected, became unselected, and were selected again ("accidental clears"). */
  itemsReselected: number;
  usedFilter: boolean;
  usedPredicateSelect: boolean;
  usedPredicateDeselect: boolean;
  usedNavigate: boolean;
  usedViewSwitch: boolean;
  usedDrag: boolean;
  usedShiftClick: boolean;
  usedCtrlClick: boolean;
  usedKeyboard: boolean;
  usedSelectAll: boolean;
  usedShowSelectedOnly: boolean;
  pathLengthPx: number;
  /** Replaying the selection diffs reproduces the selection logged at taskEnd. */
  replayOk: boolean;
}

export interface BlockRow extends Row {
  participant: string;
  block: number;
  label: string;
  system: string;
  model: string;
  dataset: string;
  /** First tutorial step shown → last tutorial step ended, ms. */
  tutorialMs: number | null;
  /** Distinct tutorial steps shown (a restarted step counts once). */
  tutorialSteps: number;
  tutorialSkipped: boolean;
  /** Practice steps started again ("Start this step again"). */
  tutorialRestarts: number;
  warmupMs: number | null;
  warmupActiveMs: number | null;
  warmupGestures: number | null;
  sufficient: number | null;
  frustrating: number | null;
}

export interface AnswerRow extends Row {
  participant: string;
  question: string;
  value: string | number | null;
  block: number | null;
  label: string | null;
  system: string | null;
  task: string | null;
}

export interface CommentRow extends Row {
  participant: string;
  comment: string;
}

export interface Issue extends Row {
  participant: string;
  severity: "error" | "warning";
  message: string;
}

export interface Extracted {
  sessions: SessionRow[];
  tasks: TaskRow[];
  blocks: BlockRow[];
  answers: AnswerRow[];
  comments: CommentRow[];
  issues: Issue[];
}

const round = (ms: number) => Math.round(ms * 10) / 10;
type Ev<T extends TelemetryEvent["type"]> = Extract<TelemetryEvent, { type: T }>;

/** True for logs written by study mode (developer-view logs have no meta.study). */
export function isStudyLog(log: TelemetryLog): boolean {
  const study = log.meta?.study as StudyMeta | undefined;
  return !!study && typeof study.group === "string";
}

/** Extracts all tables from one study log. */
export function extractSession(log: TelemetryLog): Extracted {
  const participant = log.sessionId;
  const study = (log.meta.study ?? {}) as StudyMeta;
  const blocks = study.blocks ?? [];
  const events = log.events;
  const issues: Issue[] = [];
  const issue = (severity: Issue["severity"], message: string) => issues.push({ participant, severity, message });

  for (let i = 1; i < events.length; i++)
    if (events[i].t < events[i - 1].t) {
      issue("error", `timestamps go backwards at event ${i}`);
      break;
    }
  if (log.app.commit.endsWith("-dirty") || log.app.commit === "unknown")
    issue("warning", `build ${log.app.commit} had uncommitted changes`);
  // Viewport changes during the session (full screen left, zoom changed); the header holds the
  // size at hand-over (before study-2.8: at page load, which can predate F11).
  const resized = events.filter((e): e is Ev<"viewport"> => e.type === "viewport");
  if (resized.length > 0) {
    const last = resized[resized.length - 1];
    issue("warning", `viewport changed ${resized.length}× during the session (last ${last.width}×${last.height})`);
  }

  // --- Tasks -----------------------------------------------------------------
  const tasks: TaskRow[] = [];
  let context: Ev<"context"> | null = null;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === "context") context = e;
    if (e.type !== "taskStart") continue;
    const end = events.findIndex((x, j) => j > i && (x.type === "taskEnd" || x.type === "taskStart"));
    if (end < 0 || events[end].type !== "taskEnd") {
      issue("error", `task ${e.task} (block ${e.block ?? "?"}) has no taskEnd`);
      continue;
    }
    tasks.push(taskRow(participant, study, blocks, context, e, events.slice(i + 1, end), events[end] as Ev<"taskEnd">, issue));
  }

  // --- Answers -----------------------------------------------------------------
  const answers: AnswerRow[] = [];
  const comments: CommentRow[] = [];
  for (const e of events) {
    if (e.type !== "answer") continue;
    if (e.question === "comment") {
      if (typeof e.value === "string" && e.value.trim() !== "") comments.push({ participant, comment: e.value });
      continue;
    }
    const b = e.block === null ? undefined : blocks[e.block];
    answers.push({
      participant,
      question: e.question,
      value: e.value,
      block: e.block,
      label: b?.label ?? null,
      system: b?.system ?? null,
      task: e.task,
    });
  }
  const answer = (question: string, block: number | null = null) =>
    answers.find((a) => a.question === question && a.block === block)?.value ?? null;

  // --- Blocks ------------------------------------------------------------------
  const blockRows: BlockRow[] = blocks.map((b, index) => {
    const tutorial = tasks.filter((t) => t.block === index && t.kind === "tutorial");
    const warmup = tutorial.find((t) => t.task === "tutorial-warmup");
    const num = (v: Cell) => (typeof v === "number" ? v : null);
    return {
      participant,
      block: index,
      label: b.label,
      system: b.system,
      model: b.model,
      dataset: b.dataset,
      tutorialMs: tutorial.length > 0 ? round(tutorial[tutorial.length - 1].endT - tutorial[0].startT) : null,
      tutorialSteps: new Set(tutorial.map((t) => t.task)).size,
      tutorialSkipped: tutorial.some((t) => t.reason === "skipped"),
      tutorialRestarts: tutorial.filter((t) => t.reason === "restarted").length,
      warmupMs: warmup?.durationMs ?? null,
      warmupActiveMs: warmup?.activeMs ?? null,
      warmupGestures: warmup?.gestures ?? null,
      sufficient: num(answer("sufficient", index)),
      frustrating: num(answer("frustrating", index)),
    };
  });

  // --- Session -----------------------------------------------------------------
  const consent = events.find((e) => e.type === "screen" && e.screen === "consent");
  const studyEnd = events.find((e) => e.type === "studyEnd");
  const lastT = events.at(-1)?.t ?? 0;
  const bySystem = (label: Cell) => blocks.find((b) => b.label === label)?.system ?? null;
  const preference = answer("preference") as string | null;
  const lost = answer("lostSelection") as string | null;
  const traditional = blocks.find((b) => b.system === "traditional");
  const completed = study.completed === true;
  if (!completed) issue("warning", `session not completed (stopped at ${study.stoppedAt ?? "unknown"})`);
  if (completed && !studyEnd) issue("error", "meta says completed, but there is no studyEnd event");
  for (const t of tasks) if (!t.replayOk) issue("error", `selection replay does not match taskEnd in ${t.task} (block ${t.block})`);

  const session: SessionRow = {
    participant,
    version: study.version ?? null,
    commit: log.app.commit,
    group: study.group ?? null,
    pilot: study.pilot === true,
    completed,
    stoppedAt: study.stoppedAt ?? null,
    language: study.language ?? null,
    os: study.os ?? null,
    knowsExperimenter: study.knowsExperimenter ?? null,
    startedAt: log.startedAt,
    viewportWidth: log.screen.viewportWidth,
    viewportHeight: log.screen.viewportHeight,
    systemA: blocks[0]?.system ?? null,
    modelA: blocks[0]?.model ?? null,
    datasetA: blocks[0]?.dataset ?? null,
    systemB: blocks[1]?.system ?? null,
    modelB: blocks[1]?.model ?? null,
    datasetB: blocks[1]?.dataset ?? null,
    baseline: traditional?.model ?? null,
    sessionMs: consent ? round((studyEnd?.t ?? lastT) - consent.t) : null,
    preference,
    preferredSystem: preference === null ? null : preference === "none" ? "none" : bySystem(preference),
    lostSelection: lost,
    lostSelectionSystem: lost === null ? null : lost === "no" ? "none" : lost === "both" ? "both" : bySystem(lost),
  };

  return { sessions: [session], tasks, blocks: blockRows, answers, comments, issues };
}

function taskRow(
  participant: string,
  study: StudyMeta,
  blocks: BlockMeta[],
  context: Ev<"context"> | null,
  start: Ev<"taskStart">,
  during: TelemetryEvent[],
  end: Ev<"taskEnd">,
  issue: (severity: Issue["severity"], message: string) => void,
): TaskRow {
  const block = start.block ?? 0;
  const meta = blocks[block];
  if (context?.task !== start.task) issue("warning", `no context event for ${start.task}`);

  // Gestures: one per press (clickCount 1), classified by the matching release.
  let clicks = 0,
    ctrlClicks = 0,
    shiftClicks = 0,
    drags = 0,
    doubleClicks = 0,
    selectionKeys = 0,
    searchCommits = 0,
    selectionButtons = 0,
    pathLengthPx = 0;
  let pending: Ev<"press"> | null = null;
  let lastMove: { x: number; y: number } | null = null;
  const flags = {
    usedFilter: false,
    usedPredicateSelect: false,
    usedPredicateDeselect: false,
    usedNavigate: false,
    usedViewSwitch: false,
    usedDrag: false,
    usedShiftClick: false,
    usedCtrlClick: false,
    usedKeyboard: false,
    usedSelectAll: false,
    usedShowSelectedOnly: false,
  };
  const classify = (press: Ev<"press">, dragged: boolean) => {
    if (dragged) {
      drags++;
      flags.usedDrag = true;
    } else if (press.modifier === "ctrl") {
      ctrlClicks++;
      flags.usedCtrlClick = true;
    } else if (press.modifier === "shift" || press.modifier === "ctrlShift") {
      // A Ctrl+Shift-click is a range gesture too; the log keeps the exact modifier.
      shiftClicks++;
      flags.usedShiftClick = true;
    } else clicks++;
  };
  let firstInput: number | null = null;

  for (const e of during) {
    if (firstInput === null && INPUT_EVENTS.has(e.type)) firstInput = e.t;
    switch (e.type) {
      case "press":
        if (pending) classify(pending, false);
        pending = null;
        if (e.clickCount === 1) pending = e;
        else doubleClicks++;
        break;
      case "release":
        if (pending) classify(pending, e.dragged);
        pending = null;
        break;
      case "key":
        if (SELECTION_KEYS.has(e.command)) {
          selectionKeys++;
          flags.usedKeyboard = true;
          if (e.command === "selectAll") flags.usedSelectAll = true;
        }
        break;
      case "searchCommit":
        searchCommits++;
        if (e.mode === "select") flags.usedPredicateSelect = true;
        if (e.mode === "deselect") flags.usedPredicateDeselect = true;
        break;
      case "searchInput":
        if (e.query.trim() !== "" && (e.mode === "filter" || e.mode === "exclude")) flags.usedFilter = true;
        break;
      case "button":
        selectionButtons++;
        if (e.name === "selectAll") flags.usedSelectAll = true;
        break;
      case "navigate":
        flags.usedNavigate = true;
        break;
      case "view":
        flags.usedViewSwitch = true;
        break;
      case "setting":
        if (e.name === "showSelectedOnly" && e.value === true) flags.usedShowSelectedOnly = true;
        break;
      case "move":
        if (lastMove) pathLengthPx += Math.hypot(e.x - lastMove.x, e.y - lastMove.y);
        lastMove = { x: e.x, y: e.y };
        break;
    }
  }
  if (pending) classify(pending, false);

  // Selection replay: losses of required items, and whether they came back.
  //
  // Two kinds of gesture log intermediate selections that are not losses.
  // Their changes are merged and counted once, by their net effect:
  // - A predicate search ("Select / Deselect matching") previews the matches
  //   while the participant types: in Deselect mode "d" deselects every file
  //   with a d, "dr" brings most of them back. Its changes (the preview, the
  //   flush at commit, the restore when it is discarded) count from the
  //   selection before the search to the selection when it ends: at its
  //   commit, or at the next gesture if it was not committed.
  // - A double-click: its first click selects the item and clears everything
  //   else, and the double-click on a folder retracts that click (since
  //   study-2.12 also the plain clicks on the folder just before it, a slow
  //   double-click). Plain clicks on one item followed by a double-click on
  //   it count from the selection before the first click to the selection
  //   after the retraction. Without a double-click, each change counts alone.
  // Every other selection change counts on its own.
  const required = new Set([...start.targets, ...start.keep]);
  const selected = new Set(start.preselected);
  const lostItems = new Set<string>();
  const reselected = new Set<string>();
  let lossEvents = 0;
  const apply = (into: Set<string>, e: Ev<"selection">) => {
    e.removed.forEach((id) => into.delete(id));
    e.added.forEach((id) => into.add(id));
  };
  /** Counts the change from `before` to `after` as one change. */
  const count = (before: ReadonlySet<string>, after: ReadonlySet<string>) => {
    for (const id of after) if (!before.has(id) && lostItems.has(id)) reselected.add(id);
    let lostHere = false;
    for (const id of before) {
      if (required.has(id) && !after.has(id)) {
        lostItems.add(id);
        lostHere = true;
      }
    }
    if (lostHere) lossEvents++;
  };
  type Group =
    | { kind: "search"; base: Set<string> }
    | { kind: "clicks"; base: Set<string>; item: string | null; changes: Ev<"selection">[]; doubleClicked: boolean };
  /** The gesture whose selection changes are being merged, with the selection before it. */
  let group: Group | null = null;
  /** A search was committed (its flush may still follow), or a double-click retracted its clicks. */
  let closeAtNextEvent = false;
  const close = () => {
    const g = group;
    group = null;
    closeAtNextEvent = false;
    if (!g) return;
    if (g.kind === "search" || g.doubleClicked) {
      count(g.base, selected);
      return;
    }
    const state = new Set(g.base); // plain clicks without a double-click: each change on its own
    for (const e of g.changes) {
      const before = new Set(state);
      apply(state, e);
      count(before, state);
    }
  };
  let mode = "filter";
  /** The latest search or gesture event was a predicate search (or ended one). */
  let byPredicateSearch = false;
  for (const e of during) {
    if (e.type === "selection") {
      if (!group && byPredicateSearch) group = { kind: "search", base: new Set(selected) };
      if (group) {
        if (group.kind === "clicks") group.changes.push(e);
        apply(selected, e);
      } else {
        const before = new Set(selected);
        apply(selected, e);
        count(before, selected);
      }
      continue;
    }
    if (closeAtNextEvent && (SEARCH_EVENTS.has(e.type) || GESTURE_EVENTS.has(e.type) || e.type === "doubleClick" || e.type === "navigate"))
      close();
    switch (e.type) {
      case "press": {
        byPredicateSearch = false;
        // Further plain clicks on the same item (a double-click's second click, or a slow double-click).
        if (e.modifier === "none" && e.item !== null && group?.kind === "clicks" && group.item === e.item) break;
        close();
        if (e.modifier === "none")
          group = { kind: "clicks", base: new Set(selected), item: e.item, changes: [], doubleClicked: false };
        break;
      }
      case "doubleClick":
        if (group?.kind === "clicks" && group.item === e.item) {
          group.doubleClicked = true;
          closeAtNextEvent = true; // the retraction follows at once
        }
        break;
      case "navigate":
        if (group?.kind === "clicks") close();
        break;
      case "key":
      case "button":
        close();
        byPredicateSearch = false;
        break;
      case "searchInput":
      case "searchMode":
      case "searchClear":
      case "searchCommit": {
        if (group?.kind === "clicks") close();
        const previous = mode;
        mode = e.mode;
        byPredicateSearch = PREDICATE_MODES.has(previous) || PREDICATE_MODES.has(mode);
        if (e.type === "searchCommit") closeAtNextEvent = true;
        break;
      }
    }
  }
  close();
  const replayOk = selected.size === end.selected.length && end.selected.every((id) => selected.has(id));

  const s = end.score;
  return {
    participant,
    group: study.group ?? null,
    block,
    label: meta?.label ?? null,
    system: meta?.system ?? null,
    model: context?.model ?? meta?.model ?? "",
    dataset: context?.dataset ?? meta?.dataset ?? "",
    kind: start.kind ?? "task",
    task: start.task,
    reason: end.reason,
    startT: start.t,
    endT: end.t,
    durationMs: end.duration,
    activeMs: firstInput === null ? null : round(end.t - firstInput),
    firstInputMs: firstInput === null ? null : round(firstInput - start.t),
    gestures: clicks + ctrlClicks + shiftClicks + drags + selectionKeys + searchCommits + selectionButtons,
    clicks,
    ctrlClicks,
    shiftClicks,
    drags,
    doubleClicks,
    selectionKeys,
    searchCommits,
    selectionButtons,
    exact: s.exact,
    missing: s.missing.length,
    extra: s.extra.length,
    keepLost: s.keepLost.length,
    errorRate: Math.round(s.errorRate * 1e4) / 1e4,
    excludedForErrors: s.errorRate > ERROR_EXCLUSION_RATE,
    lossEvents,
    itemsReselected: reselected.size,
    ...flags,
    pathLengthPx: Math.round(pathLengthPx),
    replayOk,
  };
}

/** Extracts and concatenates the tables of many logs; developer-view logs are skipped. */
export function extractAll(logs: TelemetryLog[]): Extracted & { skipped: string[] } {
  const out: Extracted & { skipped: string[] } = {
    sessions: [],
    tasks: [],
    blocks: [],
    answers: [],
    comments: [],
    issues: [],
    skipped: [],
  };
  for (const log of [...logs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    if (!isStudyLog(log)) {
      out.skipped.push(log.sessionId);
      continue;
    }
    const e = extractSession(log);
    out.sessions.push(...e.sessions);
    out.tasks.push(...e.tasks);
    out.blocks.push(...e.blocks);
    out.answers.push(...e.answers);
    out.comments.push(...e.comments);
    out.issues.push(...e.issues);
  }
  return out;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const csvCell = (v: Cell | undefined): string => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" && !Number.isFinite(v) ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC 4180 CSV with a header row; columns from `columns` or the first row's keys. */
export function toCsv(rows: Row[], columns?: string[]): string {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";
}
