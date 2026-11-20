/**
 * Task specifications: scoring, markers, validation, and the pets-demo tasks.
 */
import { describe, expect, it } from "vitest";
import { datasetFromFile, type DatasetFile } from "../dataset";
import { datasetOrMock } from "../datasets";
import { evaluateTask, meetsRequirements, taskMarkers, type TaskFileEntry, type TaskSpec } from "../tasks";
import { flattenTree } from "../../lib/TreeModels";

const task: TaskSpec = { id: "t", keep: ["k1", "k2"], targets: ["t1", "t2"], preselected: ["k1", "k2"] };

describe("evaluateTask", () => {
  it("exact when the selection is exactly targets plus keep", () => {
    const s = evaluateTask(task, new Set(["k1", "k2", "t1", "t2"]));
    expect(s).toEqual({ exact: true, missing: [], extra: [], keepLost: [], errorRate: 0 });
  });

  it("reports missing, extra and lost keep items", () => {
    const s = evaluateTask(task, new Set(["k1", "t1", "x"]));
    expect(s.exact).toBe(false);
    expect(s.missing).toEqual(["k2", "t2"]);
    expect(s.extra).toEqual(["x"]);
    expect(s.keepLost).toEqual(["k2"]);
    expect(s.errorRate).toBeCloseTo(3 / 4);
  });
});

describe("taskMarkers", () => {
  it("marks targets and keep items with their kind (keep wins)", () => {
    const m = taskMarkers({ id: "t", keep: ["a"], targets: ["a", "b"] });
    expect(m.size).toBe(2);
    expect(m.get("a")).toBe("keep");
    expect(m.get("b")).toBe("target");
  });

  it("hides target markers when markTargets is false", () => {
    expect([...taskMarkers({ id: "t", keep: ["a"], targets: ["b"], markTargets: false })]).toEqual([["a", "keep"]]);
    expect(taskMarkers(undefined).size).toBe(0);
  });
});

describe("meetsRequirements", () => {
  const listView = { view: "tree", showSelectedOnly: false } as const;
  const focused = { view: "tree", showSelectedOnly: true } as const;
  it("holds without requirements", () => {
    expect(meetsRequirements({}, listView)).toBe(true);
  });
  it("checks each required part of the view state", () => {
    expect(meetsRequirements({ requires: { view: "tree" } }, listView)).toBe(true);
    expect(meetsRequirements({ requires: { view: "grid" } }, listView)).toBe(false);
    expect(meetsRequirements({ requires: { showSelectedOnly: true } }, listView)).toBe(false);
    expect(meetsRequirements({ requires: { showSelectedOnly: true, view: "tree" } }, focused)).toBe(true);
  });
});

describe("task validation", () => {
  const base = (tasks: DatasetFile["tasks"]): DatasetFile => ({
    id: "v",
    tree: [{ name: "Docs", children: [{ name: "a.txt" }] }],
    tasks,
  });

  it("accepts valid references", () => {
    const d = datasetFromFile(base({ ok: { view: "grid", folder: "Docs", targets: ["Docs/a.txt"] } }));
    expect(d.tasks.get("ok")).toMatchObject({ id: "ok", folder: "Docs", targets: ["Docs/a.txt"] });
  });

  it("rejects unknown items and non-folders", () => {
    expect(() => datasetFromFile(base({ bad: { targets: ["Docs/missing.txt"] } }))).toThrow(/unknown item "Docs\/missing.txt"/);
    expect(() => datasetFromFile(base({ bad: { folder: "Docs/a.txt" } }))).toThrow(/is not a folder/);
    expect(() => datasetFromFile(base({ bad: { expanded: ["Nope"] } }))).toThrow(/unknown item/);
  });

  it("checks requirements", () => {
    expect(datasetFromFile(base({ ok: { requires: { view: "tree", showSelectedOnly: true } } })).tasks.get("ok")?.requires).toEqual({
      view: "tree",
      showSelectedOnly: true,
    });
    const bad = (requires: unknown) => () => datasetFromFile(base({ bad: { requires } as TaskFileEntry }));
    expect(bad({ view: "icons" })).toThrow(/requires.view/);
    expect(bad({ showSelectedOnly: "yes" })).toThrow(/requires.showSelectedOnly/);
    expect(bad({ sorted: true })).toThrow(/unknown requirement "sorted"/);
    expect(bad(null)).toThrow(/requires must be an object/);
  });

  it("checks highlights and done notes", () => {
    const ok = datasetFromFile(base({ ok: { highlight: "selectMatching", doneNote: { en: "Done.", nb: "Ferdig." } } })).tasks.get("ok");
    expect(ok).toMatchObject({ highlight: "selectMatching", doneNote: { en: "Done.", nb: "Ferdig." } });
    const bad = (entry: unknown) => () => datasetFromFile(base({ bad: entry as TaskFileEntry }));
    expect(bad({ highlight: "searchField" })).toThrow(/highlight must be one of searchBox/);
    expect(bad({ doneNote: { nb: "Ferdig." } })).toThrow(/doneNote must be a string or an object with an "en" text/);
  });
});

describe("pets-demo tasks", () => {
  const d = datasetOrMock("pets-demo");
  const get = (id: string) => d.tasks.get(id)!;

  it("A: the pre-selected photos sit directly above the targets in the list", () => {
    const t = get("keep-what-you-have");
    expect(t.keep).toHaveLength(3);
    expect(t.preselected).toEqual(t.keep);
    expect(t.targets).toHaveLength(6);
    const rows = flattenTree(d.tree, new Set(t.expanded)).map((n) => n.id);
    const block = [...t.keep!, ...t.targets!].map((id) => rows.indexOf(id));
    expect(block.every((i, k) => k === 0 || i === block[k - 1] + 1)).toBe(true); // contiguous
  });

  it("B: all cats in Photos plus the spreadsheet, no markers", () => {
    const t = get("context-switch");
    const cats = t.targets!.filter((id) => d.byId.get(id)?.tags?.includes("cat"));
    expect(cats).toHaveLength(8);
    // "All the cats in this folder" is unambiguous: the subfolder has none (revision 17).
    for (const id of ["pets-demo", "pets-demo-2"]) {
      const ds = datasetOrMock(id);
      const all = ds.flat.filter((n) => n.tags?.includes("cat")).map((n) => n.id).sort();
      expect(all, id).toEqual(ds.tasks.get("context-switch")!.targets!.filter((x) => all.includes(x)).sort());
      expect(all, id).toHaveLength(8);
    }
    expect(t.targets).toContain("Documents/budget_2025.xlsx");
    expect(t.markTargets).toBe(false);
    expect(t.view).toBe("grid");
  });

  it("D: two kept files and six flagged targets in the last root folder", () => {
    const t = get("keep-and-extend");
    expect(t.keep).toHaveLength(2);
    expect(t.preselected).toEqual(t.keep);
    expect(t.targets).toHaveLength(6);
    expect(t.view).toBe("tree");
    expect(t.expanded).toEqual(["Lectures"]);
  });

  it("C: non-draft PDFs plus readmes, no markers", () => {
    const t = get("rule-with-exceptions");
    expect(t.targets).toHaveLength(12);
    expect(t.targets!.some((id) => id.includes("draft"))).toBe(false);
    expect(t.markTargets).toBe(false);
  });
});
