/**
 * Study settings: Deselect matching, ?undo=0 and ?aids=0.
 */
import { describe, expect, it } from "vitest";
import { useExplorer } from "./support/fixtures";

const A = "meeting_notes_1.pdf";
const B = "budget_summary_3.pdf";

describe("Deselect Items (Predicate)", () => {
  const ex = useExplorer();

  it("previews live, commits as one step, and undoes in one step", async () => {
    await ex().button("Select All").click();
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(1);
    const all = await ex().selectedCount();
    const depth = await ex().undoDepth();
    await ex().searchMode("Deselect Items (Predicate)");
    await ex().search("pdf");
    await expect.poll(() => ex().selectedCount()).toBeLessThan(all);
    const afterPreview = await ex().selectedCount();
    await ex().searchBox().press("Enter");
    await ex().page.waitForTimeout(300);
    expect(await ex().selectedCount()).toBe(afterPreview);
    expect(await ex().undoDepth()).toBe(depth + 1);
    await ex().undo();
    await expect.poll(() => ex().selectedCount()).toBe(all);
  });

  it("Esc in the search box discards the preview", async () => {
    await ex().button("Select All").click();
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(1);
    const all = await ex().selectedCount();
    await ex().searchMode("Deselect Items (Predicate)");
    await ex().search("pdf");
    await expect.poll(() => ex().selectedCount()).toBeLessThan(all);
    await ex().searchBox().press("Escape");
    await expect.poll(() => ex().selectedCount()).toBe(all);
  });
});

describe("?undo=0", () => {
  const ex = useExplorer("?undo=0");

  it("hides undo, and Ctrl+Z changes nothing", async () => {
    expect(await ex().page.getByText(/undo \(\d+\)/).count()).toBe(0);
    expect(await ex().page.getByText("Undo / redo selection changes").count()).toBe(0);
    expect(await ex().page.getByLabel("Undo").isChecked()).toBe(false);
    await ex().click(A);
    await ex().click(B, "Control");
    await ex().undo();
    await expect.poll(() => ex().selection()).toEqual([A, B].sort());
  });
});

describe("?aids=0", () => {
  const ex = useExplorer("?aids=0");

  it("hides Show Selected Only and the not-visible count", async () => {
    expect(await ex().page.getByLabel("Show Selected Only").count()).toBe(0);
    await ex().click(A);
    await ex().search("budget");
    await ex().settle();
    expect(await ex().page.getByText(/not visible/).count()).toBe(0);
    expect(await ex().selection()).toEqual([A]); // still selected, just not indicated
  });
});
