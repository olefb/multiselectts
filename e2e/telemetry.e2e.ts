/**
 * Telemetry end to end: a scripted session must produce the expected log,
 * saved by the local endpoint and available as a download.
 */
import { describe, expect, inject, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { useExplorer } from "./support/fixtures";
import type { TelemetryEvent, TelemetryLog } from "../src/telemetry/schema";

const DATASET = JSON.parse(readFileSync("src/data/datasets/pets-demo.json", "utf8"));
const A = DATASET.tasks["keep-what-you-have"] as { keep: string[]; targets: string[] };
const name = (id: string) => id.split("/").pop()!;
const dir = inject("telemetryDir");

/** Reads the saved log once it contains an event matching `until`. */
async function savedLog(sessionId: string, until: (e: TelemetryEvent) => boolean): Promise<TelemetryLog> {
  const file = join(dir, "dev", `${sessionId}.json`);
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

describe.skipIf(!dir)("telemetry: Task A", () => {
  describe.each([
    ["algebraic", 0],
    ["windows", 3], // Shift-click replaces the selection: the pre-selected photos are lost
  ] as const)("%s", (model, lost) => {
    const ex = useExplorer(`?dataset=pets-demo&task=keep-what-you-have&model=${model}`);

    it("logs the task, the gestures, the selection, and the score", async () => {
      const first = name(A.targets[0]);
      const last = name(A.targets.at(-1)!);
      await ex().click(first, "Control");
      await ex().click(last, "Shift");
      await ex().page.getByRole("button", { name: "Done" }).click();
      await expect
        .poll(() => ex().page.getByTestId("task-score").innerText())
        .toBe(lost ? `missing ${lost}, extra 0, kept lost ${lost}` : "Exact ✓");

      const id = await ex().sessionId();
      const log = await savedLog(id, (e) => e.type === "taskEnd");

      // Header
      expect(log.schema).toBe("multiselect-telemetry/1");
      expect(log.sessionId).toBe(id);
      expect(log.app.commit).toMatch(/^[0-9a-f]{7,}(-dirty)?$|^unknown$/);
      expect(log.screen.viewportWidth).toBeGreaterThan(0);

      // Structure
      const [context] = ofType(log, "context");
      expect(context).toMatchObject({ model, dataset: "pets-demo", task: "keep-what-you-have", undo: true, aids: true });
      const [start] = ofType(log, "taskStart");
      expect(start).toMatchObject({ task: "keep-what-you-have", view: "tree", keep: A.keep, targets: A.targets });

      // Gestures: exactly two presses, on the right items with the right modifiers
      const presses = ofType(log, "press");
      expect(presses.map((p) => [p.item, p.modifier])).toEqual([
        [A.targets[0], "ctrl"],
        [A.targets.at(-1), "shift"],
      ]);
      expect(ofType(log, "release").every((r) => !r.dragged)).toBe(true);

      // Replaying the selection diffs from the pre-selection gives the logged final selection
      const replay = new Set(start.preselected);
      for (const s of ofType(log, "selection")) {
        s.removed.forEach((x) => replay.delete(x));
        s.added.forEach((x) => replay.add(x));
      }
      const [end] = ofType(log, "taskEnd");
      expect([...replay].sort()).toEqual(end.selected);
      expect(end).toMatchObject({ task: "keep-what-you-have", reason: "done" });
      expect(end.score.keepLost).toHaveLength(lost);
      expect(end.score.exact).toBe(lost === 0);
      expect(end.duration).toBeGreaterThan(0);

      // Timestamps never go backwards
      const ts = log.events.map((e) => e.t);
      expect(ts).toEqual([...ts].sort((a, b) => a - b));
    });
  });
});

describe.skipIf(!dir)("telemetry: Ctrl+Shift-click", () => {
  const ex = useExplorer("?dataset=pets-demo&task=keep-what-you-have&model=windows");

  it("is logged as ctrlShift and keeps the pre-selection in the Windows-like preset", async () => {
    await ex().click(name(A.targets[0]), "Control");
    await ex().click(name(A.targets.at(-1)!), ["Control", "Shift"]);
    await ex().page.getByRole("button", { name: "Done" }).click();
    await expect.poll(() => ex().page.getByTestId("task-score").innerText()).toBe("Exact ✓");
    const log = await savedLog(await ex().sessionId(), (e) => e.type === "taskEnd");
    expect(ofType(log, "press").map((p) => p.modifier)).toEqual(["ctrl", "ctrlShift"]);
  });
});

describe.skipIf(!dir)("telemetry: search, keys, navigation", () => {
  const ex = useExplorer("?dataset=pets-demo&task=rule-with-exceptions");

  it("logs search mode, input, commit, keys and view switches", async () => {
    await ex().searchMode("Select Items (Predicate)");
    await ex().search("pdf");
    await ex().searchBox().press("Enter");
    await ex().page.waitForTimeout(300);
    await ex().press("ArrowDown");
    await ex().press("Shift+ArrowDown");
    await ex().view("Icon (Grid)");
    await ex().item("Photos").dblclick();
    await ex().page.getByRole("button", { name: "Done" }).click();

    const log = await savedLog(await ex().sessionId(), (e) => e.type === "taskEnd");
    expect(ofType(log, "searchMode").map((e) => e.mode)).toEqual(["select"]);
    // Typed "pdf", then Enter committed the preview and cleared the box.
    expect(ofType(log, "searchInput").map((e) => [e.mode, e.query])).toEqual([
      ["select", "pdf"],
      ["select", ""],
    ]);
    expect(ofType(log, "searchCommit")).toEqual([expect.objectContaining({ mode: "select", query: "pdf", via: "enter" })]);
    expect(ofType(log, "key").map((k) => k.command)).toEqual(["move", "extend"]);
    expect(ofType(log, "view").map((v) => v.mode)).toEqual(["grid"]);
    expect(ofType(log, "doubleClick").map((d) => d.item)).toEqual(["Photos"]);
    expect(ofType(log, "navigate")).toEqual([expect.objectContaining({ folder: "Photos", via: "doubleClick" })]);
    expect(ofType(log, "move").length).toBeGreaterThan(0); // pointer trace
  });
});

describe("telemetry: download and task switching", () => {
  const ex = useExplorer("?dataset=pets-demo&task=keep-what-you-have");

  it("Save JSON downloads the session log", async () => {
    await ex().click(name(A.targets[0]), "Control");
    const [download] = await Promise.all([
      ex().page.waitForEvent("download"),
      ex().page.getByRole("button", { name: "Save JSON" }).click(),
    ]);
    const id = await ex().sessionId();
    expect(download.suggestedFilename()).toBe(`${id}.json`);
    const log = JSON.parse(readFileSync(await download.path(), "utf8")) as TelemetryLog;
    expect(log.sessionId).toBe(id);
    expect(ofType(log, "press")).toHaveLength(1);
  });

  it("switching to another task ends the open one as abandoned", async () => {
    await ex().page.getByLabel("Task:").selectOption("context-switch");
    await expect.poll(() => ex().breadcrumbs()).toContain("Photos");
    const [download] = await Promise.all([
      ex().page.waitForEvent("download"),
      ex().page.getByRole("button", { name: "Save JSON" }).click(),
    ]);
    const log = JSON.parse(readFileSync(await download.path(), "utf8")) as TelemetryLog;
    expect(ofType(log, "taskEnd")).toEqual([expect.objectContaining({ task: "keep-what-you-have", reason: "abandoned" })]);
    expect(ofType(log, "taskStart").map((s) => s.task)).toEqual(["keep-what-you-have", "context-switch"]);
  });
});
