/**
 * Study tasks from the pets-demo dataset (?dataset=pets-demo&task=...): start
 * state, markers, and that each task discriminates between the models as the
 * methodology predicts when the same gestures are used.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { useExplorer } from "./support/fixtures";

interface TaskJson {
  keep?: string[];
  targets?: string[];
}
const TASKS: Record<string, TaskJson> = JSON.parse(
  readFileSync("src/data/datasets/pets-demo.json", "utf8"),
).tasks;
const name = (id: string) => id.split("/").pop()!;
const names = (ids: string[] = []) => ids.map(name).sort();
const markerCount = (ex: ReturnType<ReturnType<typeof useExplorer>>, kind: string) =>
  ex.viewport.locator(`[data-marker="${kind}"]`).count();

describe("Task A: keep what you have", () => {
  const A = TASKS["keep-what-you-have"];
  const keep = names(A.keep);
  const targets = names(A.targets);

  // The anchor starts on the first kept photo and the active end on the last (as
  // after a click and a Shift-click), so a Shift-click on the last target as the
  // first action extends the range in every model.
  const ends = [targets[0], targets[targets.length - 1]];
  describe.each([
    // Shift-click adjusts the Ctrl-click step: pre-selection kept
    ["algebraic", [...keep, ...targets], [...keep, ...targets]],
    // Ctrl-click moves the anchor, Shift-click replaces: pre-selection lost; Ctrl+Shift-click adds the range
    ["windows", targets, [...keep, ...targets]],
    // Shift-click adds the range: pre-selection kept; Cmd+Shift-click is a Cmd-click (Finder, 2026-10-16)
    ["mac", [...keep, ...targets], [...keep, ...ends]],
  ] as const)("%s", (model, expected, afterCtrlShift) => {
    const ex = useExplorer(`?dataset=pets-demo&task=keep-what-you-have&model=${model}`);

    it("starts with the kept photos selected and flagged, targets flagged", async () => {
      await expect.poll(() => ex().page.getByTestId("task-instructions").innerText()).toContain("1. Three of the flagged photos");
      await expect.poll(() => ex().selection()).toEqual(keep);
      expect(await markerCount(ex(), "keep")).toBe(3);
      expect(await markerCount(ex(), "target")).toBe(6);
      await ex().undo(); // the pre-selection is not undoable
      expect(await ex().selection()).toEqual(keep);
    });

    it("starts scrolled so the kept photos and all six targets are in view", async () => {
      await expect.poll(() => ex().viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      const box = (await ex().viewport.boundingBox())!;
      for (const n of [...keep, ...targets]) {
        const item = (await ex().item(n).boundingBox())!;
        expect(item.y, n).toBeGreaterThanOrEqual(box.y);
        expect(item.y + item.height, n).toBeLessThanOrEqual(box.y + box.height);
      }
    });

    it("Ctrl-click the first target, Shift-click the last", async () => {
      await ex().click(targets[0], "Control");
      await ex().click(targets[targets.length - 1], "Shift");
      await expect.poll(() => ex().selection()).toEqual([...expected].sort());
    });

    it("Ctrl-click the first target, Ctrl+Shift-click the last: the kept photos stay", async () => {
      // In Explorer, Ctrl+Shift-click adds the range (checked 2026-10-11); before study-2.8
      // the Windows-like preset treated it as a Shift-click and dropped the kept photos.
      // In Finder it only toggles the clicked photo (checked 2026-10-16, study-3.6).
      await ex().click(targets[0], "Control");
      await ex().click(targets[targets.length - 1], ["Control", "Shift"]);
      await expect.poll(() => ex().selection()).toEqual([...afterCtrlShift].sort());
    });

    it("Shift-click the last target first: the range runs from the first kept photo", async () => {
      await expect.poll(() => ex().selection()).toEqual(keep);
      await ex().click(targets[targets.length - 1], "Shift");
      await expect.poll(() => ex().selection()).toEqual([...keep, ...targets].sort());
    });
  });
});

describe("Task D: keep and extend", () => {
  const D = TASKS["keep-and-extend"];
  const keep = names(D.keep);
  const targets = names(D.targets);
  const all = [...keep, ...targets].sort();

  // Starts as after a click on the first kept file and a Ctrl-click on the second
  // (anchor on the second); an unflagged file lies between the two kept files.
  const ends = [targets[0], targets[targets.length - 1]];
  describe.each([
    ["algebraic", all, all, all], // Shift-click adds the range (from the cursor / adjusts the Ctrl-click step)
    ["windows", [keep[1], ...targets], targets, all], // Shift-click replaces the selection with the range
    ["mac", all, all, [...keep, ...ends]], // Shift-click adds the range; Cmd+Shift-click is a Cmd-click
  ] as const)("%s", (model, afterShift, afterCtrlShift, afterCtrlCtrlShift) => {
    const ex = useExplorer(`?dataset=pets-demo&task=keep-and-extend&model=${model}`);

    it("starts with the two kept files selected, all eight flagged and in view", async () => {
      await expect.poll(() => ex().page.getByTestId("task-instructions").innerText()).toContain("1. Two of the flagged files");
      await expect.poll(() => ex().selection()).toEqual(keep);
      expect(await markerCount(ex(), "keep")).toBe(2);
      expect(await markerCount(ex(), "target")).toBe(6);
      const box = (await ex().viewport.boundingBox())!;
      for (const n of all) {
        const item = (await ex().item(n).boundingBox())!;
        expect(item.y, n).toBeGreaterThanOrEqual(box.y);
        expect(item.y + item.height, n).toBeLessThanOrEqual(box.y + box.height);
      }
    });

    it("Shift-click the last target (extend from the second kept file)", async () => {
      await ex().click(targets[targets.length - 1], "Shift");
      await expect.poll(() => ex().selection()).toEqual([...afterShift].sort());
    });

    it("Ctrl-click the first target, Shift-click the last", async () => {
      await ex().click(targets[0], "Control");
      await ex().click(targets[targets.length - 1], "Shift");
      await expect.poll(() => ex().selection()).toEqual([...afterCtrlShift].sort());
    });

    it("Ctrl-click the first target, Ctrl+Shift-click the last: the kept files stay in every model", async () => {
      await ex().click(targets[0], "Control");
      await ex().click(targets[targets.length - 1], ["Control", "Shift"]);
      await expect.poll(() => ex().selection()).toEqual([...afterCtrlCtrlShift].sort());
    });
  });
});

describe("Task B: context switch", () => {
  const B = TASKS["context-switch"];
  const cats = names(B.targets).filter((n) => n.startsWith("IMG_"));

  describe.each([
    ["algebraic", names(B.targets)], // the cats survive the search
    ["windows", ["budget_2025.xlsx"]], // searching cleared the cats
  ] as const)("%s", (model, expected) => {
    const ex = useExplorer(`?dataset=pets-demo&task=context-switch&model=${model}`);

    it("starts in the grid inside Photos, without markers", async () => {
      await expect.poll(() => ex().breadcrumbs()).toContain("Photos");
      expect(await markerCount(ex(), "target")).toBe(0);
      expect(await ex().selectedCount()).toBe(0);
    });

    it("Ctrl-click the cats, then search for the spreadsheet and Ctrl-click it", async () => {
      for (const cat of cats) await ex().click(cat, "Control");
      await expect.poll(() => ex().selectedCount()).toBe(8);
      await ex().search("budget");
      await ex().click("budget_2025.xlsx", "Control");
      await expect.poll(() => ex().selection()).toEqual([...expected].sort());
    });
  });
});

describe("Task C: rule with exceptions (algebraic)", () => {
  const C = TASKS["rule-with-exceptions"];
  const ex = useExplorer("?dataset=pets-demo&task=rule-with-exceptions");

  it("Select matching 'pdf', Deselect matching 'draft', Ctrl-click the readmes", async () => {
    expect(await markerCount(ex(), "target")).toBe(0);
    await ex().searchMode("Select Items (Predicate)");
    await ex().search("pdf");
    await ex().searchBox().press("Enter");
    await ex().searchMode("Deselect Items (Predicate)");
    await ex().search("draft");
    await ex().searchBox().press("Enter");
    await ex().page.waitForTimeout(300);
    await ex().click("readme.txt", "Control");
    await ex().click("README_data.md", "Control");
    await expect.poll(() => ex().selection()).toEqual(names(C.targets));
    expect(await ex().undoDepth()).toBe(4); // two searches + two clicks
  });
});

describe("file list scrollbar (revision 19)", () => {
  const ex = useExplorer("?dataset=pets-demo&task=rule-with-exceptions");

  it("is always visible: a 14 px track beside the rows, not an overlay", async () => {
    const width = () =>
      ex().page.getByTestId("explorer-viewport").evaluate((el) => {
        const e = el as HTMLElement;
        return e.offsetWidth - e.clientWidth - 2; // minus the 1 px border on each side
      });
    await expect.poll(width).toBe(14);
    expect(await ex().page.getByTestId("explorer-viewport").evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  });

  it("a press on the scrollbar keeps the selection (revision 21)", async () => {
    await ex().click("readme.txt");
    await ex().click("README_data.md", "Control");
    await expect.poll(() => ex().selectedCount()).toBe(2);
    const box = (await ex().viewport.boundingBox())!;
    for (const y of [0.1, 0.5, 0.9]) {
      // 7 px from the right edge: inside the 14 px scrollbar, beside a row
      await ex().page.mouse.click(box.x + box.width - 8, box.y + box.height * y);
      await ex().settle();
    }
    await ex().page.mouse.move(box.x + box.width - 8, box.y + 20);
    await ex().page.mouse.down();
    await ex().page.mouse.move(box.x + box.width - 8, box.y + box.height - 20, { steps: 5 });
    await ex().page.mouse.up();
    await ex().settle();
    expect(await ex().selection()).toEqual(["README_data.md", "readme.txt"]);
  });
});

describe("task picker", () => {
  const ex = useExplorer("?dataset=pets-demo");

  it("applies a task, keeps it in the URL, and drops it when the dataset changes", async () => {
    expect(await ex().page.getByTestId("task-instructions").count()).toBe(0);
    await ex().page.getByLabel("Task:").selectOption("keep-what-you-have");
    await expect.poll(() => ex().selectedCount()).toBe(3);
    expect(ex().page.url()).toContain("task=keep-what-you-have");
    await ex().page.getByLabel("Dataset:").selectOption("mock");
    await expect.poll(() => ex().page.getByTestId("task-instructions").count()).toBe(0);
    expect(ex().page.url()).not.toContain("task=");
    expect(await ex().page.getByLabel("Task:").isDisabled()).toBe(true); // mock has no tasks
  });
});
