/**
 * Log → tables extraction (src/analysis/measures.ts): gesture counting,
 * completion time, accidental clears, selection replay, answers, and a check
 * against robot participants whose behaviour is known.
 */
import { describe, expect, it } from "vitest";
import { extractAll, extractSession, toCsv } from "../measures";
import { EXPECTED_EFFECTS, robotSessions } from "../robots";
import { DATASETS } from "../../data/datasets";
import { evaluateTask } from "../../data/tasks";
import { STUDY } from "../../study/config";
import { TELEMETRY_SCHEMA, type TelemetryEventBody, type TelemetryLog } from "../../telemetry/schema";

const BLOCKS = [
  { label: "A", system: "predicate", model: "algebraic", dataset: "d1", datasetKey: "D1", undo: false, aids: true },
  { label: "B", system: "traditional", model: "windows", dataset: "d2", datasetKey: "D2", undo: false, aids: false },
];
const TASK = { id: "t", targets: ["a", "b"], keep: ["k"], preselected: ["k"] };

function makeLog(events: Array<[number, TelemetryEventBody]>, study: Record<string, unknown> = {}): TelemetryLog {
  return {
    schema: TELEMETRY_SCHEMA,
    sessionId: "P-TEST01",
    startedAt: "2026-10-01T10:00:00.000Z",
    app: { commit: "abc1234" },
    screen: { viewportWidth: 1280, viewportHeight: 800, devicePixelRatio: 1 },
    meta: { study: { version: "v", group: "G1", pilot: false, completed: true, language: "nb", os: "windows", knowsExperimenter: false, blocks: BLOCKS, ...study } },
    events: events.map(([t, e]) => ({ t, ...e }) as TelemetryLog["events"][number]),
  };
}

const sel = (added: string[], removed: string[], size: number): TelemetryEventBody => ({ type: "selection", added, removed, size, undo: 0, redo: 0 });
const press = (modifier: "none" | "ctrl" | "shift" | "ctrlShift", clickCount = 1): TelemetryEventBody => ({ type: "press", x: 10, y: 10, item: "a", modifier, clickCount });
const release = (dragged: boolean): TelemetryEventBody => ({ type: "release", x: 10, y: 10, item: "a", dragged });

const TASK_EVENTS: Array<[number, TelemetryEventBody]> = [
  [1000, { type: "screen", screen: "consent", block: null, task: null }],
  [2000, { type: "context", model: "algebraic", dataset: "d1", task: "t", undo: false, aids: true }],
  [2000, { type: "taskStart", task: "t", view: "tree", targets: ["a", "b"], keep: ["k"], preselected: ["k"], kind: "task", block: 0 }],
  [2100, { type: "move", x: 10, y: 0, dragging: false }],
  [2200, { type: "move", x: 10, y: 30, dragging: false }],
  [3000, press("ctrl")],
  [3050, sel(["a"], [], 2)],
  [3080, release(false)],
  [4000, press("none")], // a plain click clears k and a ...
  [4050, sel(["b"], ["k", "a"], 1)],
  [4080, release(false)],
  [5000, press("ctrl")], // ... and a Ctrl-drag brings them back
  [5200, sel(["k", "a"], [], 3)],
  [5300, release(true)],
  [5500, { type: "key", key: "ArrowDown", ctrl: false, shift: true, alt: false, command: "extend" }],
  [5600, { type: "key", key: "ArrowDown", ctrl: true, shift: false, alt: false, command: "moveCursor" }], // not a gesture
  [5700, { type: "searchCommit", mode: "select", query: "x", via: "enter" }],
  [5800, { type: "button", name: "selectAll" }],
  [5900, press("none", 2)], // second click of a double-click
  [7000, { type: "taskEnd", task: "t", reason: "done", duration: 5000, selected: ["a", "b", "k"], score: evaluateTask(TASK, new Set(["a", "b", "k"])) }],
  [7500, { type: "answer", question: "seq", value: 6, block: 0, task: "t" }],
  [8000, { type: "answer", question: "sufficient", value: 5, block: 0, task: null }],
  [8000, { type: "answer", question: "frustrating", value: 2, block: 0, task: null }],
  [8500, { type: "answer", question: "preference", value: "A", block: null, task: null }],
  [8500, { type: "answer", question: "lostSelection", value: "B", block: null, task: null }],
  [8500, { type: "answer", question: "comment", value: "hi, \"quoted\"", block: null, task: null }],
  [9000, { type: "studyEnd", completed: true }],
];

describe("extractSession", () => {
  const out = extractSession(makeLog(TASK_EVENTS));
  const task = out.tasks[0];

  it("counts gestures by kind (double-click second presses and cursor moves excluded)", () => {
    expect(task).toMatchObject({
      clicks: 1,
      ctrlClicks: 1,
      shiftClicks: 0,
      drags: 1,
      doubleClicks: 1,
      selectionKeys: 1,
      searchCommits: 1,
      selectionButtons: 1,
      gestures: 6,
      usedDrag: true,
      usedCtrlClick: true,
      usedKeyboard: true,
      usedPredicateSelect: true,
      usedSelectAll: true,
      usedFilter: false,
    });
  });

  it("counts a Ctrl+Shift-click (logged since study-2.8) as a Shift-click", () => {
    const events = TASK_EVENTS.map(([t, e]): [number, TelemetryEventBody] => (t === 3000 ? [t, press("ctrlShift")] : [t, e]));
    expect(extractSession(makeLog(events)).tasks[0]).toMatchObject({ ctrlClicks: 0, shiftClicks: 1, usedShiftClick: true, gestures: 6 });
  });

  it("measures completion time from the first input", () => {
    expect(task).toMatchObject({ durationMs: 5000, firstInputMs: 1000, activeMs: 4000, pathLengthPx: 30 });
  });

  it("finds accidental clears: required items lost and selected again", () => {
    expect(task).toMatchObject({ lossEvents: 1, itemsReselected: 2, replayOk: true, exact: true, keepLost: 0, excludedForErrors: false });
  });

  it("maps answers, blocks and the session to the systems", () => {
    expect(out.answers.map((a) => [a.question, a.value, a.system])).toEqual([
      ["seq", 6, "predicate"],
      ["sufficient", 5, "predicate"],
      ["frustrating", 2, "predicate"],
      ["preference", "A", null],
      ["lostSelection", "B", null],
    ]);
    expect(out.comments).toEqual([{ participant: "P-TEST01", comment: 'hi, "quoted"' }]);
    expect(out.blocks[0]).toMatchObject({ system: "predicate", sufficient: 5, frustrating: 2, tutorialSteps: 0 });
    expect(out.sessions[0]).toMatchObject({
      group: "G1",
      completed: true,
      sessionMs: 8000,
      preferredSystem: "predicate",
      lostSelectionSystem: "traditional",
      baseline: "windows",
    });
    expect(out.issues).toEqual([]);
  });

  it("reports a selection replay that does not match the logged end state", () => {
    const events = TASK_EVENTS.map(([t, e]): [number, TelemetryEventBody] =>
      e.type === "taskEnd" ? [t, { ...e, selected: ["a"] }] : [t, e],
    );
    const bad = extractSession(makeLog(events));
    expect(bad.tasks[0].replayOk).toBe(false);
    expect(bad.issues.map((i) => i.message)).toContain("selection replay does not match taskEnd in t (block 0)");
  });

  it("warns when the viewport changed during the session", () => {
    const resize: Array<[number, TelemetryEventBody]> = [[2500, { type: "viewport", width: 1360, height: 785, devicePixelRatio: 1.875 }]];
    const x = extractSession(makeLog([...TASK_EVENTS, ...resize].sort((a, b) => a[0] - b[0])));
    expect(x.issues.map((i) => i.message)).toContain("viewport changed 1× during the session (last 1360×785)");
    expect(extractSession(makeLog(TASK_EVENTS)).issues.some((i) => i.message.startsWith("viewport"))).toBe(false);
  });

  it("flags attempts with more than 10 % wrong items", () => {
    const score = evaluateTask(TASK, new Set(["k"])); // 2 of 3 missing
    const events = TASK_EVENTS.map(([t, e]): [number, TelemetryEventBody] =>
      e.type === "taskEnd" ? [t, { ...e, score }] : [t, e],
    );
    expect(extractSession(makeLog(events)).tasks[0]).toMatchObject({ missing: 2, excludedForErrors: true });
  });
});

// Merged selection changes. Task t: targets a, b; k pre-selected and kept.
// Start: k, a, b selected (by a Ctrl-drag).
type E = [number, TelemetryEventBody];
const runTask = (events: E[], final: string[]) => {
  const all: E[] = [
    [2000, { type: "context", model: "algebraic", dataset: "d1", task: "t", undo: false, aids: true }],
    [2000, { type: "taskStart", task: "t", view: "tree", targets: ["a", "b"], keep: ["k"], preselected: ["k"], kind: "task", block: 0 }],
    [2100, press("ctrl")],
    [2150, sel(["a", "b"], [], 3)],
    [2200, release(true)],
    ...events,
    [9000, { type: "taskEnd", task: "t", reason: "done", duration: 7000, selected: final, score: evaluateTask(TASK, new Set(final)) }],
  ];
  return extractSession(makeLog(all)).tasks[0];
};

// Search previews: one search logs a selection change per keystroke.
describe("losses during a predicate search", () => {
  const run = runTask;
  const search = (type: "searchInput" | "searchMode" | "searchCommit" | "searchClear", mode: string, query = ""): TelemetryEventBody =>
    type === "searchMode"
      ? { type, mode }
      : type === "searchInput"
        ? { type, mode, query }
        : type === "searchCommit"
          ? { type, mode, query, via: "enter" }
          : { type, mode, query, via: "button" };

  it("intermediate states while typing are not losses", () => {
    const row = run(
      [
        [3000, search("searchMode", "deselect")],
        [3100, search("searchInput", "deselect", "d")],
        [3250, sel([], ["a", "b", "x"], 1)], // "d" matches a, b and x
        [3300, search("searchInput", "deselect", "dr")],
        [3450, sel(["a", "b"], [], 3)], // "dr" only x
        [4000, search("searchCommit", "deselect", "dr")],
        [4000, search("searchInput", "deselect", "")],
      ],
      ["a", "b", "k"],
    );
    expect(row).toMatchObject({ lossEvents: 0, itemsReselected: 0, replayOk: true });
  });

  it("a discarded preview is not a loss", () => {
    const row = run(
      [
        [3000, search("searchInput", "deselect", "a")],
        [3150, sel([], ["a"], 2)],
        [3500, search("searchClear", "deselect", "a")],
        [3510, sel(["a"], [], 3)], // the selection before the search comes back
        [4000, press("ctrl")], // a later gesture ends the search
      ],
      ["a", "b", "k"],
    );
    expect(row).toMatchObject({ lossEvents: 0, itemsReselected: 0 });
  });

  it("a committed search that deselects a target is one loss, and selecting it again a re-selection", () => {
    const row = run(
      [
        [3000, search("searchInput", "deselect", "b")],
        [3150, sel([], ["b"], 2)],
        [3500, search("searchCommit", "deselect", "b")],
        [3510, search("searchInput", "deselect", "")],
        [4000, press("ctrl")],
        [4050, sel(["b"], [], 3)],
      ],
      ["a", "b", "k"],
    );
    expect(row).toMatchObject({ lossEvents: 1, itemsReselected: 1 });
  });

  it("the preview applied at Enter belongs to the search it commits", () => {
    const row = run(
      [
        [3000, search("searchInput", "deselect", "b")],
        [3050, search("searchCommit", "deselect", "b")], // Enter within the debounce ...
        [3050, sel([], ["b"], 2)], // ... applies the preview after the commit event
        [3050, search("searchInput", "deselect", "")],
        [3100, search("searchInput", "select", "b")], // a new search selects b again
        [3250, sel(["b"], [], 3)],
        [3500, search("searchCommit", "select", "b")],
      ],
      ["a", "b", "k"],
    );
    expect(row).toMatchObject({ lossEvents: 1, itemsReselected: 1 });
  });

  it("a gesture during a live search is counted on its own", () => {
    const row = run(
      [
        [3000, search("searchInput", "select", "z")],
        [3150, sel(["z"], [], 4)],
        [4000, press("none")], // a plain click on z clears a, b and k
        [4050, sel([], ["a", "b", "k"], 1)],
      ],
      ["z"],
    );
    expect(row).toMatchObject({ lossEvents: 1, itemsReselected: 0 });
  });

  it("a filter that clears the selection (baselines) is still a loss", () => {
    const row = run(
      [
        [3000, search("searchInput", "filter", "q")],
        [3050, sel([], ["a", "b", "k"], 0)],
      ],
      [],
    );
    expect(row).toMatchObject({ lossEvents: 1 });
  });
});

// The first click of a double-click selects the folder and clears the rest; the
// double-click retracts it (since study-2.12 also a click just before it).
describe("losses during a double-click", () => {
  const on = (item: string | null, clickCount = 1): TelemetryEventBody => ({ type: "press", x: 10, y: 10, item, modifier: "none", clickCount });
  const up = (item: string | null): TelemetryEventBody => ({ type: "release", x: 10, y: 10, item, dragged: false });
  const dbl = (item: string): TelemetryEventBody => ({ type: "doubleClick", item });
  const nav = (folder: string): TelemetryEventBody => ({ type: "navigate", folder, via: "doubleClick" });

  it("a double-click on a folder that keeps the selection is no loss", () => {
    const row = runTask(
      [
        [3000, on("f")],
        [3000, sel(["f"], ["a", "b", "k"], 1)],
        [3050, up("f")],
        [3200, on("f", 2)],
        [3250, up("f")],
        [3250, dbl("f")],
        [3250, sel(["a", "b", "k"], ["f"], 3)], // retracted
        [3250, nav("f")],
      ],
      ["a", "b", "k"],
    );
    expect(row).toMatchObject({ lossEvents: 0, itemsReselected: 0, replayOk: true });
  });

  it("a slow double-click (click, pause, double-click) is no loss either", () => {
    const row = runTask(
      [
        [3000, on("f")],
        [3000, sel(["f"], ["a", "b", "k"], 1)],
        [3050, up("f")],
        [3800, { type: "move", x: 12, y: 10, dragging: false }],
        [3900, on("f")],
        [3950, up("f")],
        [4100, on("f", 2)],
        [4150, up("f")],
        [4150, dbl("f")],
        [4150, sel(["a", "b", "k"], ["f"], 3)],
        [4150, nav("f")],
      ],
      ["a", "b", "k"],
    );
    expect(row).toMatchObject({ lossEvents: 0, itemsReselected: 0 });
  });

  it("a click on a folder without a double-click is a loss", () => {
    const row = runTask(
      [
        [3000, on("f")],
        [3000, sel(["f"], ["a", "b", "k"], 1)],
        [3050, up("f")],
        [4000, press("ctrl")],
        [4000, sel(["a"], [], 2)],
      ],
      ["a", "f"],
    );
    expect(row).toMatchObject({ lossEvents: 1, itemsReselected: 1 });
  });

  it("the baselines: the retraction is no loss, the clear on navigation is", () => {
    const row = runTask(
      [
        [3000, on("f")],
        [3000, sel(["f"], ["a", "b", "k"], 1)],
        [3200, on("f", 2)],
        [3250, dbl("f")],
        [3250, sel(["a", "b", "k"], ["f"], 3)],
        [3250, nav("f")],
        [3250, sel([], ["a", "b", "k"], 0)], // clearOn: navigate
      ],
      [],
    );
    expect(row).toMatchObject({ lossEvents: 1, itemsReselected: 0 });
  });

  it("a click on another item before the double-click still counts", () => {
    const row = runTask(
      [
        [3000, on("x")],
        [3000, sel(["x"], ["a", "b", "k"], 1)], // a real clear
        [3500, on("f")],
        [3500, sel(["f"], ["x"], 1)],
        [3700, on("f", 2)],
        [3700, dbl("f")],
        [3700, sel(["x"], ["f"], 1)], // only the click on f is retracted
        [3700, nav("f")],
      ],
      ["x"],
    );
    expect(row).toMatchObject({ lossEvents: 1, itemsReselected: 0 });
  });
});

describe("extractAll", () => {
  it("skips developer-view logs and notes incomplete sessions", () => {
    const dev = { ...makeLog([]), sessionId: "S-DEV", meta: {} };
    const stopped = makeLog(TASK_EVENTS.slice(0, 8), { completed: false, stoppedAt: "task" });
    const out = extractAll([dev, stopped]);
    expect(out.skipped).toEqual(["S-DEV"]);
    expect(out.sessions).toHaveLength(1);
    expect(out.issues.map((i) => i.message)).toEqual([
      "task t (block 0) has no taskEnd",
      "session not completed (stopped at task)",
    ]);
  });
});

describe("toCsv", () => {
  it("quotes commas, quotes and newlines; empty for null", () => {
    expect(toCsv([{ a: 'x,"y"', b: null, c: true, d: 1.5 }])).toBe('a,b,c,d\n"x,""y""",,true,1.5\n');
  });
});

describe("robot participants", () => {
  const sessions = robotSessions({ config: STUDY, datasets: DATASETS, profile: EXPECTED_EFFECTS, seed: 7, count: 16 });
  const tables = extractAll(sessions.map((s) => s.log));

  it("follow the protocol and balance the groups", () => {
    expect(tables.sessions).toHaveLength(16);
    const completed = tables.sessions.filter((s) => s.completed);
    const counts = ["G1", "G2", "G3", "G4"].map((g) => completed.filter((s) => s.group === g).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(tables.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("are measured as generated: gestures, skips, accidental clears, time, final selection", () => {
    const truth = sessions.flatMap((s) => s.truth.map((t) => ({ ...t, participant: s.log.sessionId })));
    expect(tables.tasks).toHaveLength(truth.length);
    tables.tasks.forEach((row, i) => {
      const t = truth[i];
      expect([row.participant, row.task, row.block]).toEqual([t.participant, t.task, t.block]);
      expect(row.gestures).toBe(t.gestures);
      expect(row.reason).toBe(t.reason);
      expect(row.itemsReselected).toBe(t.reselected);
      expect(row.replayOk).toBe(true);
      expect(Math.abs(row.activeMs! - t.activeMs)).toBeLessThan(400);
    });
  });
});
