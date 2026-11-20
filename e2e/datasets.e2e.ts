/**
 * Task-folder datasets with thumbnails (?dataset=pets-demo) and the dataset picker.
 */
import { describe, expect, it } from "vitest";
import { useExplorer } from "./support/fixtures";

const footnote = (ex: ReturnType<ReturnType<typeof useExplorer>>) =>
  ex.page.getByText(/^dataset /).innerText();

describe("pets-demo dataset", () => {
  const ex = useExplorer("?dataset=pets-demo");
  /** Loaded thumbnails currently rendered in the list/grid. */
  const loadedImages = () =>
    ex().viewport.locator("img").evaluateAll((imgs) =>
      imgs.filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0).length,
    );

  it("shows its name in the footnote and thumbnails in the list", async () => {
    await expect.poll(() => footnote(ex())).toContain("dataset pets-demo");
    await expect.poll(loadedImages).toBeGreaterThan(5); // "Photos" is expanded on load
  });

  it("shows thumbnails in the grid after opening a folder", async () => {
    await ex().view("Icon (Grid)");
    await ex().item("Photos").dblclick();
    await expect.poll(() => ex().breadcrumbs()).toContain("Photos");
    await expect.poll(loadedImages).toBeGreaterThan(10);
  });

  it("a box lasso over pictures selects them (no native image drag)", async () => {
    await ex().view("Icon (Grid)");
    await ex().item("Photos").dblclick();
    await ex().strategy("Box");
    await ex().drag({ x: 2, y: 2 }, { x: 350, y: 180 }, 12);
    await ex().release();
    await expect.poll(() => ex().selectedCount()).toBeGreaterThanOrEqual(6);
    expect(await ex().undoDepth()).toBe(1);
  });

  it("clicking a picture selects it", async () => {
    await ex().view("Icon (Grid)");
    await ex().item("Photos").dblclick();
    await ex().click("IMG_4813.jpg");
    await expect.poll(() => ex().selection()).toEqual(["IMG_4813.jpg"]);
  });
});

describe("dataset picker", () => {
  const ex = useExplorer();
  const picker = () => ex().page.getByLabel("Dataset:");

  it("switches datasets, updates the URL, and survives a reload", async () => {
    await expect.poll(() => footnote(ex())).toMatch(/dataset seed \d+/);
    await ex().page.getByLabel("Selection model:").selectOption("mac");
    await picker().selectOption("pets-demo");
    await expect.poll(() => footnote(ex())).toContain("dataset pets-demo");
    expect(ex().page.url()).toContain("dataset=pets-demo");
    expect(ex().page.url()).toContain("model=mac"); // the model is kept
    await ex().page.reload();
    await expect.poll(() => footnote(ex())).toContain("dataset pets-demo · Traditional (Finder-like)");
  });
});
