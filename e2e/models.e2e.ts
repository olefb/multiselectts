/**
 * The selection-model picker (experimenter control) and URL parameters.
 */
import { describe, expect, it } from "vitest";
import { useExplorer } from "./support/fixtures";

const A = "meeting_notes_1.pdf";
const footnote = (ex: ReturnType<ReturnType<typeof useExplorer>>) =>
  ex.page.getByText(/dataset seed \d+ · /).innerText();

describe("model picker", () => {
  const ex = useExplorer();
  const picker = () => ex().page.getByLabel("Selection model:");

  it("switches models, updates the URL, and survives a reload", async () => {
    expect(await picker().inputValue()).toBe("algebraic");
    expect(await ex().page.getByLabel("Select Items (Predicate)", { exact: true }).count()).toBe(1);

    await picker().selectOption("windows");
    await expect.poll(() => footnote(ex())).toContain("Traditional (Windows-like)");
    expect(await ex().page.getByLabel("Select Items (Predicate)", { exact: true }).count()).toBe(0);
    expect(ex().page.url()).toContain("model=windows");

    await ex().page.reload();
    await expect.poll(() => footnote(ex())).toContain("Traditional (Windows-like)");
    expect(await picker().inputValue()).toBe("windows");
  });

  it("switching models starts with an empty selection", async () => {
    await ex().click(A);
    await expect.poll(() => ex().selectedCount()).toBe(1);
    await picker().selectOption("mac");
    await expect.poll(() => footnote(ex())).toContain("Finder-like");
    expect(await ex().selectedCount()).toBe(0);
  });

  it("arrow keys in the search box do not move the selection", async () => {
    await ex().click(A);
    await ex().searchBox().fill("x");
    await ex().searchBox().press("ArrowDown");
    await ex().settle();
    expect(await ex().selection()).toEqual([A]);
  });
});

describe("?locked=1", () => {
  const ex = useExplorer("?model=mac&locked=1");

  it("hides the picker but still runs the requested model", async () => {
    await expect.poll(() => footnote(ex())).toContain("Finder-like");
    expect(await ex().page.getByLabel("Selection model:").count()).toBe(0);
  });
});
