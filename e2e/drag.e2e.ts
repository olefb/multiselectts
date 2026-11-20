/**
 * Drag gestures (range drag, box lasso) and the frozen "Show Selected Only" projection.
 */
import { describe, expect, it } from "vitest";
import { useExplorer } from "./support/fixtures";
import { TREE_ROW_PX } from "./support/explorer";

describe("drag gestures", () => {
  const ex = useExplorer();

  it("a tree drag over six rows selects them as one step", async () => {
    const y = 2 * TREE_ROW_PX + TREE_ROW_PX / 2; // centre of row 2
    await ex().drag({ x: 200, y }, { x: 200, y: y + 5 * TREE_ROW_PX });
    await ex().release();
    await expect.poll(() => ex().selectedCount()).toBe(6);
    expect(await ex().undoDepth()).toBe(1);
  });

  it("a box lasso that starts in the grid gutter selects items", async () => {
    await ex().view("Icon (Grid)");
    await ex().strategy("Box");
    await ex().drag({ x: 2, y: 2 }, { x: 272, y: 152 }, 15);
    await ex().release();
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(0);
    expect(await ex().undoDepth()).toBe(1);
  });

  it("'Show Selected Only' does not re-project the list during a drag", async () => {
    await ex().button("Select All").click();
    await ex().page.getByLabel("Show Selected Only").check();
    await ex().settle();
    const before = await ex().rows();
    await ex().drag({ x: 200, y: TREE_ROW_PX / 2 }, { x: 200, y: TREE_ROW_PX * 1.5 }, 4);
    expect(await ex().rows()).toEqual(before); // selection changed, rows did not move
    await ex().release();
  });
});

// Revision 22: a participant searched "pdf" in Task C, pressed in the blank
// space below the short list and dragged up over the files: nothing was selected.
describe.each(["algebraic", "windows", "mac"] as const)("drag from the blank space below the rows (%s)", (model) => {
  const ex = useExplorer(`?dataset=pets-demo&task=rule-with-exceptions&model=${model}`);

  it("selects the rows the drag crosses, as in Explorer and Finder", async () => {
    await ex().search("pdf");
    await expect.poll(() => ex().rows()).toHaveLength(15); // Research + its 14 PDFs
    await ex().drag({ x: 300, y: 15 * TREE_ROW_PX + 10 }, { x: 300, y: 5 * TREE_ROW_PX + TREE_ROW_PX / 2 }, 8);
    await ex().release();
    await expect.poll(() => ex().selectedCount()).toBe(10); // rows 5-14
  });

  it("a click there still clears the selection and selects nothing", async () => {
    await ex().search("pdf");
    await expect.poll(() => ex().rows()).toHaveLength(15);
    await ex().drag({ x: 300, y: 3 * TREE_ROW_PX + TREE_ROW_PX / 2 }, { x: 300, y: 3 * TREE_ROW_PX + TREE_ROW_PX / 2 }, 1);
    await ex().release();
    await expect.poll(() => ex().selectedCount()).toBe(1);
    await ex().drag({ x: 300, y: 15 * TREE_ROW_PX + 10 }, { x: 300, y: 15 * TREE_ROW_PX + 12 }, 1);
    await ex().release();
    await expect.poll(() => ex().selectedCount()).toBe(0);
  });
});

describe("edge auto-scroll", () => {
  const ex = useExplorer();
  const scrollTop = () => ex().viewport.evaluate((el) => el.scrollTop);

  // Pilot 1: holding a click on one of the last rows scrolled the list and
  // stretched the selection over the rows below.
  it("a click held still in the bottom edge zone selects one row and does not scroll", async () => {
    const box = (await ex().viewport.boundingBox())!;
    await ex().page.mouse.move(box.x + 200, box.y + box.height - 12);
    await ex().page.mouse.down();
    await ex().page.waitForTimeout(400);
    expect(await scrollTop()).toBe(0);
    await ex().release();
    await expect.poll(() => ex().selectedCount()).toBe(1);
    expect(await scrollTop()).toBe(0);
  });

  it("a drag into the bottom edge zone still scrolls and extends the selection", async () => {
    const box = (await ex().viewport.boundingBox())!;
    await ex().drag({ x: 200, y: box.height - 4 * TREE_ROW_PX }, { x: 200, y: box.height - 12 }, 5);
    await ex().page.waitForTimeout(400);
    expect(await scrollTop()).toBeGreaterThan(0);
    await ex().release();
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(4);
  });
});
