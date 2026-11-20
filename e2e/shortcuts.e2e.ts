/**
 * Keyboard shortcuts (see ShortcutHelp).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { useExplorer } from "./support/fixtures";

const A = "meeting_notes_1.pdf";
const B = "budget_summary_3.pdf";

describe("keyboard shortcuts", () => {
  const ex = useExplorer();

  it("Ctrl+A selects every visible item as one undoable step", async () => {
    await ex().click(A);
    await ex().press("Control+a");
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(1);
    expect(await ex().hiddenCount()).toBe(0); // nothing in collapsed folders
    await ex().undo();
    await expect.poll(() => ex().selection()).toEqual([A]);
  });

  it("Ctrl+A while filtering selects the same items as the Select All button", async () => {
    await ex().search("budget");
    await ex().viewport.focus();
    await ex().press("Control+a");
    const viaKey = await ex().selectedCount();
    await ex().button("Deselect All").click();
    await ex().button("Select All").click();
    await expect.poll(() => ex().selectedCount()).toBe(viaKey);
    expect(viaKey).toBeGreaterThan(0);
    expect(viaKey).toBeLessThan(1000);
  });

  it("Esc deselects all (undoable)", async () => {
    await ex().click(A);
    await ex().click(B, "Control");
    await ex().press("Escape");
    await expect.poll(() => ex().selectedCount()).toBe(0);
    await ex().undo();
    await expect.poll(() => ex().selection()).toEqual([A, B].sort());
  });

  it("Esc discards a live search preview and keeps the earlier selection", async () => {
    await ex().click(A);
    await ex().searchMode("Select Items (Predicate)");
    await ex().search("readme");
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(1);
    await ex().viewport.focus();
    await ex().press("Escape");
    await expect.poll(() => ex().selection()).toEqual([A]);
    expect(await ex().searchBox().inputValue()).toBe("");
  });

  it("Esc in the search box clears it", async () => {
    await ex().search("budget");
    await ex().searchBox().press("Escape");
    expect(await ex().searchBox().inputValue()).toBe("");
  });

  it("Ctrl+I inverts only the visible items", async () => {
    await ex().click(A);
    await ex().search("budget"); // A is now hidden
    await ex().viewport.focus();
    await ex().press("Control+i");
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(1);
    expect(await ex().selection()).toContain(A);
    expect(await ex().hiddenCount()).toBe(1); // only A is selected outside the view
    await ex().press("Control+i");
    await expect.poll(() => ex().selection()).toEqual([A]);
  });

  it("Home / End jump to the first / last item", async () => {
    await ex().click(A);
    await ex().press("End");
    await expect.poll(() => ex().selectedCount()).toBe(1);
    expect(await ex().selection()).not.toEqual([A]);
    await ex().press("Home");
    await expect.poll(() => ex().selection()).toEqual(["Documents"]);
  });

  it("PageDown moves one screenful; Shift+PageDown extends by one", async () => {
    await ex().click("Documents");
    await ex().press("PageDown"); // 17 rows (600px / 32px, minus one)
    await expect.poll(() => ex().selection()).toEqual(["benchmark_evaluation_16.jpg"]);
    await ex().press("Shift+PageDown");
    await expect.poll(() => ex().selectedCount()).toBe(18);
  });

  it("Ctrl+F focuses the search box", async () => {
    await ex().click(A);
    await ex().press("Control+f");
    expect(await ex().page.evaluate(() => document.activeElement?.tagName)).toBe("INPUT");
  });

  it("Enter opens a folder in the grid; Backspace and Alt+↑ go back up", async () => {
    await ex().view("Icon (Grid)");
    await ex().click("Documents");
    await ex().press("Enter");
    await expect.poll(() => ex().breadcrumbs()).toContain("Documents");
    await ex().press("Backspace");
    await expect.poll(() => ex().breadcrumbs()).not.toContain("Documents");

    await ex().click("Documents");
    await ex().press("Enter");
    await expect.poll(() => ex().breadcrumbs()).toContain("Documents");
    await ex().press("Alt+ArrowUp");
    await expect.poll(() => ex().breadcrumbs()).not.toContain("Documents");
  });

  it("Enter collapses and expands a folder in the tree", async () => {
    await ex().click("Documents");
    await ex().press("Enter");
    await expect.poll(async () => (await ex().rows())[0]).toMatch(/^▶/);
    await ex().press("Enter");
    await expect.poll(async () => (await ex().rows())[0]).toMatch(/^▼/);
  });
});

describe("keyboard shortcuts under a baseline model", () => {
  const ex = useExplorer("?model=windows");

  it("Ctrl+A, Ctrl+I and Esc work; there is no undo", async () => {
    await ex().click(A);
    await ex().press("Control+a");
    await expect.poll(() => ex().selectedCount()).toBeGreaterThan(1);
    expect(await ex().hiddenCount()).toBe(0); // the visible rows only
    const visible = await ex().selectedCount();
    // Ctrl+I flips the same visible rows.
    await ex().press("Control+i");
    await expect.poll(() => ex().selectedCount()).toBe(0);
    await ex().press("Control+i");
    await expect.poll(() => ex().selectedCount()).toBe(visible);
    await ex().click(A);
    await ex().press("Escape");
    await expect.poll(() => ex().selectedCount()).toBe(0);
    await ex().undo();
    expect(await ex().selectedCount()).toBe(0);
  });
});

// Space selects and Ctrl+Space toggles the item at the keyboard cursor (not the one
// under the pointer), in every model. Chromium on Linux can report Ctrl+Space as key
// "Unidentified" with code "Space" (Helium, 2026-10-16); that must work too.
describe.each(["algebraic", "windows", "mac"] as const)("Space and Ctrl+Space (%s)", (model) => {
  const ex = useExplorer(`?model=${model}`);
  const C = "project_specification_2.txt"; // the row between A and B
  const ctrlSpaceUnidentified = () =>
    ex().viewport.evaluate((el) =>
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Unidentified", code: "Space", ctrlKey: true, bubbles: true })),
    );

  it("Ctrl+Space toggles the item at the cursor; the pointer is ignored", async () => {
    await ex().click(A);
    await ex().press("Control+ArrowDown");
    await ex().press("Control+ArrowDown"); // cursor on B, selection unchanged
    await ex().press("Control+Space");
    await expect.poll(() => ex().selection()).toEqual([A, B].sort());
    await ex().item(C).hover();
    await ex().press("Control+Space");
    await expect.poll(() => ex().selection()).toEqual([A]);
    await ex().press("Space");
    await expect.poll(() => ex().selection()).toEqual([B]);
  });

  it("Ctrl+Space reported as key \"Unidentified\" still toggles", async () => {
    await ex().click(A);
    await ex().press("Control+ArrowDown");
    await ex().press("Control+ArrowDown");
    await ctrlSpaceUnidentified();
    await expect.poll(() => ex().selection()).toEqual([A, B].sort());
    await ctrlSpaceUnidentified();
    await expect.poll(() => ex().selection()).toEqual([A]);
  });
});

// Select All works on the visible items in every model, like Explorer (the open
// folder) and Finder (the shown rows). Regression: outside a filter it selected
// the whole dataset (100 items in pets-demo instead of the 25 in Photos).
const PETS: { tree: { name: string; children?: unknown[] }[] } = JSON.parse(
  readFileSync("src/data/datasets/pets-demo.json", "utf8"),
);
const PHOTOS_ITEMS = PETS.tree.find((n) => n.name === "Photos")!.children!.length;

describe.each(["algebraic", "windows", "mac"] as const)("Select All in the grid (%s)", (model) => {
  const ex = useExplorer(`?model=${model}&dataset=pets-demo&task=context-switch`);

  it("selects the items of the open folder only", async () => {
    await ex().button("Select All").click();
    await expect.poll(() => ex().selectedCount()).toBe(PHOTOS_ITEMS);
    expect(await ex().hiddenCount()).toBe(0);
    await ex().button("Deselect All").click();
    await ex().viewport.focus();
    await ex().press("Control+a");
    await expect.poll(() => ex().selectedCount()).toBe(PHOTOS_ITEMS);
  });
});
