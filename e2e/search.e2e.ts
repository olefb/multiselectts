/**
 * Predicate search and filtering (review bugs 2, 3 and the click-scope policy).
 */
import { describe, expect, it } from "vitest";
import { useExplorer } from "./support/fixtures";

const A = "meeting_notes_1.pdf";
const B = "budget_summary_3.pdf";

describe("predicate search", () => {
  const ex = useExplorer();

  it("Enter commits the preview as one step and one Ctrl+Z reverts it", async () => {
    await ex().click(A);
    const depth = await ex().undoDepth();
    await ex().searchMode("Select Items (Predicate)");
    await ex().search("readme");
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(1);
    await ex().searchBox().press("Enter");
    await ex().page.waitForTimeout(300); // the debounced empty-query effect must not add a step
    expect(await ex().undoDepth()).toBe(depth + 1);
    await ex().undo();
    await expect.poll(() => ex().selection()).toEqual([A]);
  });

  it("Enter right after the last letter commits the matches (no debounce race)", async () => {
    // Regression: Enter within the 150 ms debounce sealed nothing, so the
    // search emptied and selected nothing.
    await ex().click(A);
    const depth = await ex().undoDepth();
    await ex().searchMode("Select Items (Predicate)");
    await ex().searchBox().click();
    await ex().searchBox().pressSequentially("readme\n"); // no pause before Enter
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(1);
    expect(await ex().searchBox().inputValue()).toBe("");
    await expect.poll(() => ex().page.getByTestId("hidden-matches").count()).toBe(1); // the note stays
    const committed = await ex().selectedCount();
    await ex().page.waitForTimeout(300); // no late preview after the commit
    expect(await ex().selectedCount()).toBe(committed);
    expect(await ex().undoDepth()).toBe(depth + 1);
    await ex().undo();
    await expect.poll(() => ex().selection()).toEqual([A]);
  });

  it("Select All during a refined live preview selects every visible item", async () => {
    await ex().button("Select All").click();
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(1);
    expect(await ex().hiddenCount()).toBe(0); // only what is visible
    const visible = await ex().selectedCount();
    await ex().button("Deselect All").click();
    await ex().searchMode("Select Items (Predicate)");
    await ex().search("re");
    await ex().search("rea"); // second keystroke uses the refinement cache
    await ex().button("Select All").click();
    // Every visible item, plus the hidden matches of the preview (sealed by Select All).
    await expect.poll(async () => (await ex().selectedCount()) - (await ex().hiddenCount())).toBe(visible);
    expect(await ex().hiddenCount()).toBeGreaterThan(0);
  });

  it("Clear ✕ restores the selection and leaves history unchanged", async () => {
    await ex().click(A);
    const depth = await ex().undoDepth();
    await ex().searchMode("Select Items (Predicate)");
    await ex().search("pdf");
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(1);
    await ex().button("Clear ✕").click();
    await expect.poll(() => ex().selection()).toEqual([A]);
    await ex().page.waitForTimeout(300);
    expect(await ex().undoDepth()).toBe(depth);
  });
});

describe("filtering and click scope", () => {
  const ex = useExplorer();

  it("says next to the search box that files hidden by the search are still selected", async () => {
    const note = ex().page.getByTestId("hidden-matches");
    await ex().click(A);
    await ex().click(B, "Control");
    await ex().search("budget_summary"); // hides A, shows B
    await expect.poll(() => note.textContent()).toBe("1 selected file is hidden by the search but still selected.");
    // The note is two lines high at most: nothing may be cut off.
    expect(await note.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await ex().search("");
    await expect.poll(() => note.count()).toBe(0);
  });

  it("shows how many selected items the filter hides", async () => {
    await ex().click(A);
    await ex().search("budget_summary");
    await expect.poll(() => ex().hiddenCount()).toBe(1);
    await ex().search("");
    await expect.poll(() => ex().hiddenCount()).toBe(0);
  });

  it("'visible only' keeps hidden selections on a plain click", async () => {
    await ex().click(A);
    await ex().search("budget_summary");
    await ex().clickScope("visible");
    await ex().click(B);
    await expect.poll(() => ex().selection()).toEqual([A, B].sort());
  });

  it("'all selections' (default) clears hidden selections on a plain click", async () => {
    await ex().click(A);
    await ex().search("budget_summary");
    await ex().click(B);
    await expect.poll(() => ex().selection()).toEqual([B]);
    await ex().undo();
    await expect.poll(() => ex().selection()).toEqual([A]);
  });
});
