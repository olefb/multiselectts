/**
 * Identity-based anchors/cursor, view switching and folder drill-down (review bugs 4 and 5).
 */
import { describe, expect, it } from "vitest";
import { useExplorer } from "./support/fixtures";
import { TREE_ROW_PX } from "./support/explorer";

const A = "meeting_notes_1.pdf";
const B = "budget_summary_3.pdf";

describe("navigation", () => {
  const ex = useExplorer();

  it("the range anchor follows its item when a folder above it expands", async () => {
    await ex().click(A);
    await ex().viewport.getByText("▶").first().click(); // expand '2024', above A
    await ex().settle();
    await ex().click(B, "Shift");
    await expect
      .poll(() => ex().selection())
      .toEqual([A, "project_specification_2.txt", B].sort());
  });

  it("double-clicking a grid folder enters it without changing selection or history", async () => {
    await ex().click(A);
    await ex().click(B, "Control");
    const before = await ex().selection();
    const depth = await ex().undoDepth();
    await ex().view("Icon (Grid)");
    await ex().item("Documents").dblclick();
    await expect.poll(() => ex().breadcrumbs()).toContain("Documents");
    expect(await ex().selection()).toEqual(before);
    expect(await ex().undoDepth()).toBe(depth);
  });

  it("a slow double-click (click, pause, double-click) on a grid folder also keeps the selection", async () => {
    // Regression (study log): the single click before the double-click selected the
    // folder and cleared the selection, and only the double-click's own click was retracted.
    await ex().click(A);
    await ex().click(B, "Control");
    const before = await ex().selection();
    const depth = await ex().undoDepth();
    await ex().view("Icon (Grid)");
    await ex().item("Documents").click();
    await expect.poll(() => ex().selection()).toEqual(["Documents"]);
    await ex().page.waitForTimeout(700); // longer than the double-click interval
    await ex().item("Documents").dblclick();
    await expect.poll(() => ex().breadcrumbs()).toContain("Documents");
    await expect.poll(() => ex().selection()).toEqual(before);
    expect(await ex().undoDepth()).toBe(depth);
  });

  it("keyboard selection works in the grid after switching views", async () => {
    await ex().click(A);
    await ex().view("Icon (Grid)");
    await ex().press("ArrowRight");
    await ex().press("ArrowRight");
    await expect.poll(() => ex().selectedCount()).toBe(1);
    await ex().press("Shift+ArrowRight");
    await expect.poll(() => ex().selectedCount()).toBe(2);
  });

  it("the dataset is identical across reloads", async () => {
    const first = await ex().rows();
    await ex().page.reload();
    await ex().page.locator("text=/Selected: \\d+/").first().waitFor();
    expect((await ex().rows()).slice(0, 30)).toEqual(first.slice(0, 30));
  });
});

// Regression (study log, predicate system): after a click in blank space below
// the rows, every Shift-click selected nothing until the next click on an item.
describe.each(["algebraic", "windows"] as const)("blank-space click, then Shift-click: %s", (model) => {
  const ex = useExplorer(`?model=${model}`);

  it("extends the range from the last clicked item", async () => {
    await ex().search("readme_10"); // a short filtered list with blank space below it
    const rows = await ex().rows();
    const top = rows.findIndex((r) => r.includes("Documents"));
    const last = rows.findIndex((r) => r.includes("readme_10.txt"));
    expect(top).toBeGreaterThanOrEqual(0);
    expect(last).toBeGreaterThan(top);
    await ex().click("readme_10.txt");
    const box = (await ex().viewport.boundingBox())!;
    await ex().page.mouse.click(box.x + 200, box.y + (rows.length + 2) * TREE_ROW_PX); // blank space
    await ex().settle();
    await expect.poll(() => ex().selectedCount()).toBe(0);
    await ex().click("Documents", "Shift");
    await expect.poll(() => ex().selectedCount()).toBe(last - top + 1);
    expect(await ex().selection()).toEqual(expect.arrayContaining(["Documents", "readme_10.txt"]));
  });
});
