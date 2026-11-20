/**
 * Study mode (?study=1) end to end: a complete scripted session through setup,
 * consent, both blocks (tutorial with automatic checks, tasks, questions), the
 * final questions and the debrief; stopping early; group rotation. The saved
 * log is checked against what the participant did.
 */
import { describe, expect, inject, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { useExplorer } from "./support/fixtures";
import type { Explorer } from "./support/explorer";
import type { TelemetryEvent, TelemetryLog } from "../src/telemetry/schema";
import { extractSession } from "../src/analysis/measures";
import { STUDY, configPlaceholders } from "../src/study/config";

type TaskJson = { targets?: string[]; keep?: string[]; preselected?: string[]; instructions: { en: string } };
const load = (id: string) =>
  JSON.parse(readFileSync(`src/data/datasets/${id}.json`, "utf8")) as { tasks: Record<string, TaskJson> };
const D1 = load("pets-demo").tasks;
const name = (id: string) => id.split("/").pop()!;
const dir = inject("telemetryDir");
const STUDY_PAGE = { viewport: { width: 1280, height: 800 }, readyWhen: "[data-testid='study-setup']" };

async function savedLog(id: string, until: (e: TelemetryEvent) => boolean): Promise<TelemetryLog> {
  const file = join(dir, `${id}.json`);
  let log: TelemetryLog | null = null;
  await expect
    .poll(() => {
      if (!existsSync(file)) return false;
      log = JSON.parse(readFileSync(file, "utf8")) as TelemetryLog;
      return log.events.some(until);
    }, { timeout: 5000 })
    .toBe(true);
  return log!;
}
const ofType = <T extends TelemetryEvent["type"]>(log: TelemetryLog, type: T) =>
  log.events.filter((e): e is Extract<TelemetryEvent, { type: T }> => e.type === type);

const byTestId = (ex: Explorer, id: string) => ex.page.getByTestId(id);
/** Text content (not innerText: headings are upper-cased with CSS). */
const textOf = async (ex: Explorer, id: string) => (await byTestId(ex, id).textContent()) ?? "";
const participantId = async (ex: Explorer) => (await byTestId(ex, "participant-id").innerText()).trim();

async function handOverAndConsent(ex: Explorer, lang: "en" | "nb", os: 0 | 1 | 2 | 3, knows: 0 | 1) {
  await byTestId(ex, "hand-over").click();
  await byTestId(ex, `lang-${lang}`).click();
  expect(await byTestId(ex, "consent-continue").isDisabled()).toBe(true);
  await byTestId(ex, "consent-agree").check();
  await byTestId(ex, "choice-os").locator("input").nth(os).check();
  await byTestId(ex, "choice-knows").locator("input").nth(knows).check();
  await byTestId(ex, "consent-continue").click();
}

/** Waits for the tutorial check to pass, then goes on. */
async function passed(ex: Explorer) {
  await byTestId(ex, "tutorial-correct").waitFor({ timeout: 3000 });
  await byTestId(ex, "tutorial-next").click();
}

async function likert(ex: Explorer, id: string, value: number) {
  await byTestId(ex, `likert-${id}`).getByRole("button", { name: String(value), exact: true }).click();
}

/** Start → Done (or Skip) → ease rating. */
async function runTask(ex: Explorer, seq: number, how: "done" | "skip" = "done") {
  await byTestId(ex, "task-start").click();
  await ex.page.locator("div[tabindex='0']").waitFor();
  await byTestId(ex, how === "done" ? "task-done" : "task-skip").click({ timeout: 5000 });
  await likert(ex, "seq", seq);
}

describe.skipIf(!dir)("study mode: complete session (G1, English, Windows user)", () => {
  const ex = useExplorer("?study=1&group=G1&pilot=1&skipAfter=1", STUDY_PAGE);

  it("runs setup → consent → two blocks → final questions → debrief, and logs all of it", async () => {
    const e = ex();
    expect(await byTestId(e, "group-select").inputValue()).toBe("G1");
    const id = await participantId(e);
    expect(id).toMatch(/^P-[0-9A-Z]{6}$/);
    await handOverAndConsent(e, "en", 0, 1);

    // --- Block A: predicate system, dataset D1, full tutorial
    expect(await textOf(e, "block-intro")).toContain("System A");
    expect(await byTestId(e, "block-start").isDisabled()).toBe(false); // no screen guard by default
    await byTestId(e, "block-start").click();

    // Study mode ignores the right mouse button (no selection, no context menu)
    await e.item(name(D1["tutorial-warmup"].targets![0])).click({ button: "right" });
    expect(await e.selectedCount()).toBe(0);
    expect(await byTestId(e, "restart-step").count()).toBe(0); // no pre-selection: nothing to restore
    for (const t of D1["tutorial-warmup"].targets!) await e.click(name(t), "Control");
    await passed(e);

    // Range, then deselect the two unflagged files in it (D1: agenda.docx … price_list.xlsx)
    const range = D1["tutorial-range"].targets!;
    await e.click(name(range[0]));
    await e.click(name(range[range.length - 1]), "Shift");
    await expect.poll(() => e.selectedCount()).toBe(8);
    expect(await byTestId(e, "tutorial-correct").count()).toBe(0);
    for (const out of ["letter.docx", "notes_week1.txt"]) await e.click(out, "Control");
    await passed(e);

    const target = name(D1["tutorial-search"].targets![0]);
    expect(await e.page.locator("[data-highlight]").getAttribute("data-highlight")).toBe("searchBox"); // the step's control
    await e.search(target.split(".")[0]);
    await e.click(target);
    await passed(e);

    // List view: the right selection alone is not enough, the list view is required
    await e.search("");
    await e.item("Archive").dblclick(); // grid: open the folder
    await e.click(name(D1["tutorial-list-view"].targets![0]));
    expect(await byTestId(e, "tutorial-correct").count()).toBe(0);
    await e.button("List").click();
    await passed(e);

    // Select and deselect matching start with two kept files: they stay selected, and the done note says so
    const matching = D1["tutorial-select-matching"];
    expect(await e.page.locator("[data-highlight]").evaluateAll((els) => els.map((el) => el.getAttribute("data-highlight")))).toEqual([
      "selectMatching",
      "deselectMatching",
    ]);
    await expect.poll(() => e.selectedCount()).toBe(matching.keep!.length);
    await e.click(name(matching.keep![0])); // a plain click loses the pre-selection ...
    expect(await e.selectedCount()).toBe(1);
    await byTestId(e, "restart-step").click(); // ... and "Start this step again" restores it
    await expect.poll(() => e.selectedCount()).toBe(matching.keep!.length);
    await e.page.getByLabel("Select matching", { exact: true }).check();
    await e.search("report");
    expect(await byTestId(e, "tutorial-correct").count()).toBe(0); // not while the preview is live
    // While the preview is live, the note says to press Enter (revision 23) ...
    await expect.poll(() => textOf(e, "hidden-matches")).toBe("7 selected – press Enter to keep");
    await e.searchBox().press("Enter");
    // ... and after Enter it names the match inside the closed Archive folder
    await expect.poll(() => textOf(e, "hidden-matches")).toMatch(/^7 selected, \d not visible: old_report\.docx \(Archive\)/);
    expect(await byTestId(e, "tutorial-correct").count()).toBe(0); // the copies are still selected
    await e.page.getByLabel("Deselect matching", { exact: true }).check();
    await e.search("copy");
    await expect.poll(() => textOf(e, "hidden-matches")).toMatch(/^2 deselected/); // the note also counts deselections
    await e.searchBox().press("Enter");
    await byTestId(e, "tutorial-correct").waitFor({ timeout: 3000 });
    expect(await textOf(e, "study-instructions")).toContain("the two files you had selected before are still selected");
    await passed(e);

    // Show selected only: two selected files are hidden in the closed Archive folder
    const focus = D1["tutorial-show-selected"];
    const out = name(focus.preselected!.find((p) => !focus.targets!.includes(p))!);
    expect(await e.hiddenCount()).toBe(2);
    expect(await e.item(out).count()).toBe(0);
    await e.page.getByLabel("Show selected only", { exact: true }).check();
    await e.click(out, "Control");
    await passed(e);

    expect(await textOf(e, "task-intro")).toContain("Task 1 of 4");
    expect(await textOf(e, "task-tools")).toContain("search · “List” / “Icons” · “Select matching” · “Deselect matching” · “Show selected only”");
    // The tools stay listed while the task runs; instructions keep their numbered lines
    await byTestId(e, "task-start").click();
    expect(await textOf(e, "task-tools-reminder")).toContain("“Select matching”");
    expect(await byTestId(e, "study-instructions").innerText()).toMatch(/selected\.\n2\. Also select/);
    // The step numbers are bold (revision 20), the rest of a task's text is not
    expect(await byTestId(e, "study-instructions").locator("[data-step-number]").allInnerTexts()).toEqual(["1.", "2."]);
    expect(await byTestId(e, "study-instructions").locator("b:not([data-step-number])").count()).toBe(0);
    await byTestId(e, "task-done").click();
    // The SEQ: standard wording and direction, the end labels beside 1 and 7
    expect(await textOf(e, "likert-seq")).toMatch(/how difficult or easy .*Very difficult1234567Very easy$/);
    await likert(e, "seq", 5);
    await runTask(e, 3, "skip"); // "Skip this task" appears after skipAfter=1 s
    await runTask(e, 6);
    await runTask(e, 7); // Task D (revision 18)
    await likert(e, "sufficient", 6);
    await likert(e, "frustrating", 2);
    await byTestId(e, "block-questions-continue").click();

    // --- Block B: traditional (Windows-like), dataset D2, warm-up only; skip it
    expect(await textOf(e, "block-intro")).toContain("System B");
    await byTestId(e, "block-start").click();
    expect(await textOf(e, "study-instructions")).toContain("Practice 1 of 1");
    expect(await e.page.getByLabel("Select matching", { exact: true }).count()).toBe(0); // no predicate search
    await byTestId(e, "skip-practice").click({ timeout: 5000 });
    expect(await textOf(e, "task-tools")).not.toContain("Select matching");
    expect(await textOf(e, "task-tools")).toContain("Ctrl-click, Shift-click, dragging · search");
    await runTask(e, 4);
    await runTask(e, 4);
    await runTask(e, 2);
    await runTask(e, 3);
    await likert(e, "sufficient", 4);
    await likert(e, "frustrating", 5);
    await byTestId(e, "block-questions-continue").click();

    // --- Final questions and debrief
    expect(await byTestId(e, "final-finish").isDisabled()).toBe(true);
    await byTestId(e, "choice-preference").locator("input").nth(0).check();
    await byTestId(e, "choice-lost").locator("input").nth(2).check();
    await byTestId(e, "comment").fill("  quick  ");
    await byTestId(e, "final-finish").click();
    const debrief = await textOf(e, "debrief");
    expect(debrief).toContain("System A was the new selection method");
    expect(debrief).toContain("File Explorer in Windows");
    expect(await byTestId(e, "stop-study").count()).toBe(0);
    expect(
      await e.page.evaluate(() => {
        const ev = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(ev);
        return ev.defaultPrevented;
      }),
    ).toBe(false); // debrief: the experimenter may reload for the next participant

    // --- The log
    const log = await savedLog(id, (ev) => ev.type === "studyEnd");
    expect(log.sessionId).toBe(id);
    expect(log.meta.study).toMatchObject({
      group: "G1",
      pilot: true,
      language: "en",
      os: "windows",
      knowsExperimenter: false,
      completed: true,
      overrides: { skipAfterMs: 1000 },
      blocks: [
        { label: "A", system: "predicate", model: "algebraic", dataset: "pets-demo", aids: true, undo: false },
        { label: "B", system: "traditional", model: "windows", dataset: "pets-demo-2", aids: false, undo: false },
      ],
    });
    const starts = ofType(log, "taskStart").map((s) => `${s.block}:${s.kind}:${s.task}`);
    expect(starts).toEqual([
      "0:tutorial:tutorial-warmup",
      "0:tutorial:tutorial-range",
      "0:tutorial:tutorial-search",
      "0:tutorial:tutorial-list-view",
      "0:tutorial:tutorial-select-matching",
      "0:tutorial:tutorial-select-matching",
      "0:tutorial:tutorial-show-selected",
      "0:task:keep-what-you-have",
      "0:task:context-switch",
      "0:task:rule-with-exceptions",
      "0:task:keep-and-extend",
      "1:tutorial:tutorial-warmup",
      "1:task:keep-what-you-have",
      "1:task:context-switch",
      "1:task:rule-with-exceptions",
      "1:task:keep-and-extend",
    ]);
    const ends = ofType(log, "taskEnd");
    expect(ends.map((x) => x.reason)).toEqual([
      "done", "done", "done", "done", "restarted", "done", "done",
      "done", "skipped", "done", "done", "skipped", "done", "done", "done", "done",
    ]);
    expect(ends.slice(0, 7).filter((x) => x.reason === "done").every((x) => x.score.exact)).toBe(true); // tutorial steps end when solved
    expect(ofType(log, "context").map((c) => c.model)).toEqual([...Array(11).fill("algebraic"), ...Array(5).fill("windows")]);

    const answers = ofType(log, "answer").map((a) => [a.question, a.value, a.block]);
    expect(answers).toEqual([
      ["seq", 5, 0],
      ["seq", 3, 0],
      ["seq", 6, 0],
      ["seq", 7, 0],
      ["sufficient", 6, 0],
      ["frustrating", 2, 0],
      ["seq", 4, 1],
      ["seq", 4, 1],
      ["seq", 2, 1],
      ["seq", 3, 1],
      ["sufficient", 4, 1],
      ["frustrating", 5, 1],
      ["preference", "A", null],
      ["lostSelection", "B", null],
      ["comment", "quick", null],
    ]);
    const screens = ofType(log, "screen").map((s) => s.screen);
    expect(screens.slice(0, 4)).toEqual(["language", "consent", "blockIntro", "tutorial"]);
    expect(screens.at(-1)).toBe("debrief");
    expect(screens.filter((s) => s === "seq")).toHaveLength(8);
    expect(ofType(log, "studyEnd")).toEqual([expect.objectContaining({ completed: true })]);

    // --- The analysis extraction reads the real log as intended
    const x = extractSession(log);
    expect(x.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(x.tasks).toHaveLength(16);
    expect(x.tasks.every((t) => t.replayOk)).toBe(true);
    const row = (block: number, task: string) => x.tasks.find((t) => t.block === block && t.task === task)!;
    expect(row(0, "tutorial-warmup")).toMatchObject({ ctrlClicks: 3, gestures: 3, exact: true, system: "predicate" });
    expect(row(0, "tutorial-range")).toMatchObject({ clicks: 1, shiftClicks: 1, ctrlClicks: 2, gestures: 4 });
    expect(row(0, "tutorial-search")).toMatchObject({ usedFilter: true });
    expect(row(0, "tutorial-select-matching")).toMatchObject({ reason: "restarted", clicks: 1 });
    expect(x.tasks.filter((t) => t.task === "tutorial-select-matching")[1]).toMatchObject({
      reason: "done",
      searchCommits: 2,
      usedPredicateSelect: true,
      usedPredicateDeselect: true,
      exact: true,
    });
    expect(row(0, "tutorial-list-view")).toMatchObject({ exact: true, reason: "done" });
    expect(row(0, "tutorial-show-selected")).toMatchObject({ usedShowSelectedOnly: true, exact: true });
    expect(row(0, "context-switch")).toMatchObject({ reason: "skipped", system: "predicate" });
    expect(row(1, "keep-what-you-have")).toMatchObject({ system: "traditional", model: "windows", gestures: 0, activeMs: null });
    expect(x.blocks.map((b) => [b.system, b.tutorialSteps, b.tutorialSkipped, b.tutorialRestarts, b.sufficient, b.frustrating])).toEqual([
      ["predicate", 6, false, 1, 6, 2],
      ["traditional", 1, true, 0, 4, 5],
    ]);
    expect(x.answers).toHaveLength(14);
    expect(x.comments).toEqual([{ participant: id, comment: "quick" }]);
    expect(x.sessions[0]).toMatchObject({ completed: true, pilot: true, preferredSystem: "predicate", lostSelectionSystem: "traditional", baseline: "windows" });
  }, 90_000);
});

describe.skipIf(!dir)("study mode: skipping a practice step, then stopping early (Norwegian)", () => {
  const ex = useExplorer("?study=1&group=G3&pilot=1&skipAfter=1&guard=1.5", STUDY_PAGE);

  it("skips one step at a time, ends the open step as abandoned and marks the session incomplete", async () => {
    const e = ex();
    const id = await participantId(e);
    // The page loaded at 1280×800; full screen is entered before hand-over: the log keeps the later size
    await e.page.setViewportSize({ width: 1365, height: 853 });
    await handOverAndConsent(e, "nb", 1, 0);
    expect(await textOf(e, "block-intro")).toContain("System A");
    // Screen guard (off by default; &guard=1.5 here): the button is inactive at first, then works
    expect(await byTestId(e, "block-start").isDisabled()).toBe(true);
    await expect.poll(() => byTestId(e, "block-start").isDisabled(), { timeout: 3000 }).toBe(false);
    await byTestId(e, "block-start").click();
    expect(await textOf(e, "study-instructions")).toContain("Øving 1 av 4"); // traditional first: no predicate steps
    expect(await e.page.getByText("Merket: 0").count()).toBe(1);
    await byTestId(e, "skip-practice").click({ timeout: 5000 }); // "Hopp over dette steget"
    await expect.poll(() => textOf(e, "study-instructions")).toContain("Øving 2 av 4");
    await e.page.setViewportSize({ width: 1280, height: 800 }); // e.g. full screen left during the session
    await e.page.waitForTimeout(500);

    // A running session asks before the page is left (revision 22); no swipe navigation
    const leaveBlocked = () =>
      e.page.evaluate(() => {
        const ev = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(ev);
        return ev.defaultPrevented;
      });
    expect(await leaveBlocked()).toBe(true);
    expect(await e.page.evaluate(() => getComputedStyle(document.body).overscrollBehaviorX)).toBe("none");

    await byTestId(e, "stop-study").click();
    await byTestId(e, "stop-yes").click();
    await byTestId(e, "stopped").waitFor();
    expect(await leaveBlocked()).toBe(false); // stopped: the experimenter may reload

    const log = await savedLog(id, (ev) => ev.type === "studyEnd");
    expect(log.meta.study).toMatchObject({ group: "G3", language: "nb", os: "macos", knowsExperimenter: true, completed: false, stoppedAt: "tutorial" });
    expect((log.meta.study as { blocks: { model: string }[] }).blocks.map((b) => b.model)).toEqual(["mac", "algebraic"]);
    expect(ofType(log, "taskEnd").map((t) => t.reason)).toEqual(["skipped", "abandoned"]);
    expect(ofType(log, "note").map((n) => n.text)).toEqual(["leave-page prompt"]);
    expect(ofType(log, "studyEnd")).toEqual([expect.objectContaining({ completed: false })]);
    expect(log.screen).toMatchObject({ viewportWidth: 1365, viewportHeight: 853 });
    expect(ofType(log, "viewport").at(-1)).toMatchObject({ width: 1280, height: 800 });
  }, 30_000);
});

describe.skipIf(!dir)("study mode: browser zoom", () => {
  const ex = useExplorer("?study=1&pilot=1", STUDY_PAGE);

  it("blocks Ctrl+wheel (zoom) but not plain wheel (scroll)", async () => {
    const e = ex();
    const prevented = (ctrlKey: boolean) =>
      e.page.evaluate((ctrlKey) => {
        const ev = new WheelEvent("wheel", { deltaY: 100, ctrlKey, bubbles: true, cancelable: true });
        document.body.dispatchEvent(ev);
        return ev.defaultPrevented;
      }, ctrlKey);
    expect(await prevented(true)).toBe(true);
    expect(await prevented(false)).toBe(false);
  });
});

describe.skipIf(!dir)("study mode: group rotation", () => {
  const ex = useExplorer("?study=1", STUDY_PAGE);

  it("offers the group with the fewest completed sessions", async () => {
    // Completed, non-pilot sessions in G1 and G2 (fake logs in the test's telemetry folder).
    for (const [file, group] of [["P-E2EG1A", "G1"], ["P-E2EG2A", "G2"]])
      writeFileSync(join(dir, `${file}.json`), JSON.stringify({ meta: { study: { group, completed: true } }, events: [] }));
    const e = ex();
    await e.page.reload();
    await expect.poll(() => textOf(e, "group-counts")).toContain("G1 1, G2 1, G3 0, G4 0");
    expect(await byTestId(e, "group-select").inputValue()).toBe("G3");
    if (configPlaceholders(STUDY).length > 0) expect(await textOf(e, "setup-warnings")).toContain("Placeholder");
  });
});
