/**
 * Undo/redo history as seen through the UI (review bugs 1 and 3).
 */
import { describe, expect, it } from "vitest";
import { useExplorer } from "./support/fixtures";

const A = "meeting_notes_1.pdf";
const B = "budget_summary_3.pdf";
const C = "backup_snapshot_5.docx";
const D = "experiment_results_8.pdf";

describe("undo history", () => {
  const ex = useExplorer();

  it("undo removes the last cmd-click", async () => {
    await ex().click(A);
    await ex().click(B, "Control");
    await ex().click(C, "Control");
    await ex().undo();
    await expect.poll(() => ex().selection()).toEqual([B, A].sort());
  });

  it("shift-click after undo adds a range from the cursor without rewriting history", async () => {
    await ex().click(A);
    await ex().click(B, "Control");
    await ex().click(C, "Control");
    await ex().undo(); // A, B selected; cursor still on C
    await ex().click(D, "Shift");
    await expect.poll(() => ex().selectedCount()).toBe(6); // A, B + C..D (4 rows)
    expect(await ex().selection()).toEqual(expect.arrayContaining([A, B, C, D]));
    await ex().undo();
    await expect.poll(() => ex().selection()).toEqual([A, B].sort()); // B survived
  });

  it("Select All and Deselect All are single undoable steps", async () => {
    await ex().button("Select All").click();
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(1);
    await ex().button("Deselect All").click();
    await expect.poll(() => ex().selectedCount()).toBe(0);
    await ex().undo();
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(1);
    await ex().undo();
    await expect.poll(() => ex().selectedCount()).toBe(0);
    expect(await ex().undoDepth()).toBe(0);
  });

  it("Deselect All with nothing selected records no step", async () => {
    await ex().button("Deselect All").click();
    await ex().settle();
    expect(await ex().undoDepth()).toBe(0);
  });

  it("a click that changes nothing keeps the redo stack", async () => {
    await ex().click(A);
    await ex().click(B, "Control");
    await ex().undo();
    await ex().click(A); // A is already the only selection
    await ex().redo();
    await expect.poll(() => ex().selection()).toEqual([A, B].sort());
  });

  it("cmd-click in empty space records no step", async () => {
    await ex().view("Icon (Grid)");
    await ex().click("Documents");
    const depth = await ex().undoDepth();
    const box = (await ex().viewport.boundingBox())!;
    // The 8px padding around each grid cell is empty space.
    await ex().page.keyboard.down("Control");
    await ex().page.mouse.click(box.x + 2, box.y + 2);
    await ex().page.keyboard.up("Control");
    await ex().settle();
    expect(await ex().undoDepth()).toBe(depth);
    expect(await ex().selection()).toEqual(["Documents"]);
  });
});
