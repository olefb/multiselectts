/**
 * The traditional baseline (?model=windows | ?model=mac) in the real UI.
 */
import { describe, expect, it } from "vitest";
import { useExplorer } from "./support/fixtures";
import { TREE_ROW_PX } from "./support/explorer";

// Initial tree rows: 0 Documents, 1 2024, 2 meeting_notes_1, 3 project_specification_2,
// 4 budget_summary_3, 5 user_study_protocol_4, 6 backup_snapshot_5, 7 abstract_v2_6
const MEETING = "meeting_notes_1.pdf";
const PROJECT = "project_specification_2.txt";
const BUDGET = "budget_summary_3.pdf";
const STUDY = "user_study_protocol_4.csv";
const BACKUP = "backup_snapshot_5.docx";
const ABSTRACT = "abstract_v2_6.pdf";
const rowCentre = (row: number) => row * TREE_ROW_PX + TREE_ROW_PX / 2;

describe.each(["windows", "mac"] as const)("baseline: %s", (model) => {
  const ex = useExplorer(`?model=${model}`);

  it("hides controls the baseline does not support", async () => {
    await expect.poll(() => ex().page.getByText(/dataset seed \d+ · Traditional/).count()).toBe(1);
    expect(await ex().page.getByLabel("Select Items (Predicate)", { exact: true }).count()).toBe(0);
    expect(await ex().page.getByLabel("Deselect Items (Predicate)", { exact: true }).count()).toBe(0);
    expect(await ex().page.getByText("Click clears:").count()).toBe(0);
    expect(await ex().page.getByText(/undo \(\d+\)/).count()).toBe(0);
  });

  it("Ctrl+Z does not change the selection", async () => {
    await ex().click(MEETING);
    await ex().click(BUDGET);
    await ex().undo();
    await expect.poll(() => ex().selection()).toEqual([BUDGET]);
  });

  it("filtering clears the selection", async () => {
    await ex().click(MEETING);
    await ex().search("budget");
    await expect.poll(() => ex().selectedCount()).toBe(0);
  });

  it("entering a folder clears the selection", async () => {
    await ex().view("Icon (Grid)");
    await ex().click("Projects");
    await ex().item("Documents").dblclick();
    await expect.poll(() => ex().breadcrumbs()).toContain("Documents");
    await expect.poll(() => ex().selectedCount()).toBe(0);
  });

  it("switching between list and grid keeps the selection", async () => {
    await ex().click(MEETING);
    await ex().click(BUDGET, "Control");
    await ex().view("Icon (Grid)");
    await ex().view("List (Tree)");
    await expect.poll(() => ex().selection()).toEqual([MEETING, BUDGET].sort());
  });

  it(`shift-click ${model === "windows" ? "replaces the selection with" : "adds"} the range`, async () => {
    await ex().click(MEETING);
    await ex().click(BUDGET, "Control"); // range anchor moves to BUDGET
    await ex().click(ABSTRACT, "Shift");
    const range = [BUDGET, STUDY, BACKUP, ABSTRACT];
    const expected = model === "windows" ? range : [MEETING, ...range];
    await expect.poll(() => ex().selection()).toEqual(expected.sort());
  });

  it(`shift-click in the grid ${model === "windows" ? "makes a range" : "toggles the item (Finder icon view)"}`, async () => {
    await ex().view("Icon (Grid)");
    await ex().item("Documents").dblclick();
    await expect.poll(() => ex().breadcrumbs()).toContain("Documents");
    await ex().click(MEETING);
    await ex().click(BUDGET, "Shift");
    const expected = model === "windows" ? [MEETING, PROJECT, BUDGET] : [MEETING, BUDGET];
    await expect.poll(() => ex().selection()).toEqual(expected.sort());
  });

  it("ctrl-drag toggles items (Explorer and Finder)", async () => {
    await ex().click(MEETING);
    await ex().click(PROJECT, "Shift"); // MEETING, PROJECT
    await ex().page.keyboard.down("Control");
    await ex().drag({ x: 200, y: rowCentre(3) }, { x: 200, y: rowCentre(5) }, 6); // PROJECT..STUDY
    await ex().release();
    await ex().page.keyboard.up("Control");
    await expect.poll(() => ex().selection()).toEqual([MEETING, BUDGET, STUDY].sort());
  });
});
