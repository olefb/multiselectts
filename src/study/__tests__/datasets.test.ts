/**
 * The study datasets (D1, D2): every configured task exists, the two are
 * matched, and the tutorial steps can be solved exactly as instructed.
 */
import { describe, expect, it } from "vitest";
import { DATASETS } from "../../data/datasets";
import { evaluateTask, LANGS, localize, type TaskSpec } from "../../data/tasks";
import type { Dataset } from "../../data/dataset";
import { EXPLORER_TEXT } from "../../components/explorer/text";
import { STUDY } from "../config";
import { STUDY_TEXT } from "../text";

const d1 = DATASETS.get(STUDY.datasets.D1)!;
const d2 = DATASETS.get(STUDY.datasets.D2)!;
const allTasks = [...STUDY.tutorial.map((s) => s.task), ...STUDY.tasks];
const files = (d: Dataset) => d.flat.filter((n) => !n.children);
const name = (id: string) => id.split("/").pop()!;
/** What "Select matching <word>" selects: every item whose name contains the word. */
const matching = (d: Dataset, word: string) =>
  d.flat.filter((n) => n.name.toLowerCase().includes(word.toLowerCase())).map((n) => n.id).sort();
const shape = (t: TaskSpec) => ({
  view: t.view,
  targets: t.targets?.length ?? 0,
  keep: t.keep?.length ?? 0,
  anchor: t.anchor !== undefined,
  preselected: t.preselected?.length ?? 0,
  markTargets: t.markTargets,
  expanded: t.expanded?.length ?? 0,
});

describe("study datasets", () => {
  it("exist and define every configured task", () => {
    expect(d1).toBeDefined();
    expect(d2).toBeDefined();
    for (const d of [d1, d2]) for (const t of allTasks) expect(d.tasks.has(t), `${d.id}: ${t}`).toBe(true);
  });

  it("are matched: same structure, item counts and task shapes", () => {
    expect(files(d1).length).toBe(files(d2).length);
    expect(d1.flat.length).toBe(d2.flat.length);
    for (const t of allTasks) expect(shape(d2.tasks.get(t)!), t).toEqual(shape(d1.tasks.get(t)!));
    const tags = (d: Dataset) => files(d).map((n) => (n.tags ?? []).join("+")).sort();
    expect(tags(d2)).toEqual(tags(d1));
  });

  it("use different file names, so targets cannot be remembered between blocks", () => {
    const names1 = new Set(files(d1).map((n) => n.name));
    const photos2 = files(d2).filter((n) => n.thumbnail);
    expect(photos2.some((n) => names1.has(n.name))).toBe(false);
  });

  it("have instructions in every language", () => {
    for (const d of [d1, d2])
      for (const t of allTasks)
        for (const lang of LANGS) {
          const text = d.tasks.get(t)!.instructions;
          expect(typeof text === "object" && text[lang], `${d.id} ${t} ${lang}`).toBeTruthy();
        }
  });

  it("bold only the words to type, and only in the practice", () => {
    for (const d of [d1, d2])
      for (const t of allTasks)
        for (const lang of LANGS) {
          const text = localize(d.tasks.get(t)!.instructions, lang)!;
          const bold = [...text.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]);
          expect(text.split("**").length % 2, `${d.id} ${t} ${lang}: unbalanced **`).toBe(1);
          if (STUDY.tasks.includes(t)) expect(bold, `${d.id} ${t} ${lang}`).toEqual([]);
        }
    const typed = (d: Dataset, t: string) => [...localize(d.tasks.get(t)!.instructions, "en")!.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]);
    expect(typed(d1, "tutorial-search")).toEqual(["signature"]);
    expect(typed(d1, "tutorial-select-matching")).toEqual(["report", "copy"]);
  });

  it("quote only labels that the study UI shows", () => {
    for (const d of [d1, d2])
      for (const t of allTasks)
        for (const lang of LANGS) {
          const spec = d.tasks.get(t)!;
          const text = [localize(spec.instructions, lang)!, localize(spec.doneNote, lang) ?? ""].join("\n");
          const quoted = [...text.matchAll(/[“«]([^”»]+)[”»]/g)].map((m) => m[1]);
          const ui = EXPLORER_TEXT[lang];
          const labels = [...Object.values(ui.searchModes), ui.list, ui.grid, ui.showSelectedOnly];
          for (const q of quoted) expect(labels, `${d.id} ${t} ${lang}: “${q}”`).toContain(q);
        }
  });

  it("quote only study UI labels in the tools line", () => {
    for (const lang of LANGS) {
      const text = STUDY_TEXT[lang].tools({ predicate: true, aids: true });
      const quoted = [...text.matchAll(/[“«]([^”»]+)[”»]/g)].map((m) => m[1]);
      const ui = EXPLORER_TEXT[lang];
      const labels = [...Object.values(ui.searchModes), ui.list, ui.grid, ui.showSelectedOnly];
      expect(quoted, lang).toContain(ui.list);
      expect(quoted, lang).toContain(ui.grid);
      for (const q of quoted) expect(labels, `tools ${lang}: “${q}”`).toContain(q);
    }
  });

  it("write each measured task as numbered steps, one per line (pilot 1)", () => {
    for (const d of [d1, d2])
      for (const t of STUDY.tasks)
        for (const lang of LANGS) {
          const lines = localize(d.tasks.get(t)!.instructions, lang)!.split("\n");
          expect(lines[0], `${d.id} ${t} ${lang}`).toMatch(/^1\. /);
          expect(lines[1], `${d.id} ${t} ${lang}`).toMatch(/^2\. /);
        }
  });

  it("write each practice step as a goal followed by numbered steps (revision 14)", () => {
    for (const d of [d1, d2])
      for (const s of STUDY.tutorial)
        for (const lang of LANGS) {
          const lines = localize(d.tasks.get(s.task)!.instructions, lang)!.split("\n");
          const where = `${d.id} ${s.task} ${lang}`;
          expect(lines, where).toHaveLength(3); // three lines fit the practice bar (a fourth overflows)
          expect(lines[0], where).toMatch(/:$/);
          expect(lines[1], where).toMatch(/^1\. /);
          expect(lines[2], where).toMatch(/^2\. /);
        }
  });

  it("outline the control of the steps that practise one", () => {
    const highlights = (d: Dataset) => Object.fromEntries(STUDY.tutorial.map((s) => [s.task, d.tasks.get(s.task)!.highlight ?? null]));
    expect(highlights(d1)).toEqual({
      "tutorial-warmup": null,
      "tutorial-range": null,
      "tutorial-search": "searchBox",
      "tutorial-list-view": "listView",
      "tutorial-select-matching": ["selectMatching", "deselectMatching"],
      "tutorial-show-selected": "showSelectedOnly",
    });
    expect(highlights(d2)).toEqual(highlights(d1));
  });

  describe.each([d1, d2])("$id", (d) => {
    const task = (id: string) => d.tasks.get(id)!;

    it("no tutorial step or task is already solved at the start", () => {
      for (const t of allTasks) expect(evaluateTask(task(t), new Set(task(t).preselected ?? [])).exact, t).toBe(false);
    });

    it("range: Shift-click from the first to the last flagged file, then Ctrl-click the two without a flag", () => {
      const t = task("tutorial-range");
      const ids = d.flat.filter((n) => n.id.startsWith("Practice/") && n.id.split("/").length === 2 && !n.children).map((n) => n.id);
      const flagged = ids.filter((id) => t.targets!.includes(id));
      const span = ids.slice(ids.indexOf(flagged[0]), ids.indexOf(flagged.at(-1)!) + 1);
      expect(localize(t.instructions, "en")).toMatch(/^Select the six files with a flag:/);
      expect(flagged).toHaveLength(6);
      expect(span).toHaveLength(8);
      expect(span.filter((id) => !t.targets!.includes(id))).toHaveLength(2);
      expect([...t.targets!].sort()).toEqual(span.filter((id) => t.targets!.includes(id)).sort());
    });

    it("select-matching: the word, then 'copy' leave exactly the targets; two kept files the words do not match", () => {
      const t = task("tutorial-select-matching");
      const word = localize(t.instructions, "en")!.match(/'([^']+)'/)![1];
      const left = matching(d, word).filter((id) => !matching(d, "copy").includes(id));
      expect(left).toEqual([...t.targets!].sort());
      expect(t.keep).toHaveLength(2);
      expect(t.preselected).toEqual(t.keep);
      for (const id of t.keep!) {
        expect(matching(d, word)).not.toContain(id);
        expect(matching(d, "copy")).not.toContain(id);
      }
      for (const lang of LANGS) expect(typeof t.doneNote === "object" && t.doneNote[lang], lang).toBeTruthy();
    });

    it("search: the search word finds only the target", () => {
      const t = task("tutorial-search");
      const word = localize(t.instructions, "en")!.match(/\*\*(.+?)\*\*/)![1];
      expect(matching(d, word)).toEqual(t.targets);
    });

    it("list view: starts in the grid, the target is in a closed subfolder, and the step needs the list view", () => {
      const t = task("tutorial-list-view");
      expect(t).toMatchObject({ view: "grid", requires: { view: "tree" } });
      const parent = t.targets![0].split("/").slice(0, -1).join("/");
      expect(t.folder).toBe(parent.split("/")[0]);
      expect(t.expanded).not.toContain(parent);
      expect(localize(t.instructions, "en")).toContain(name(t.targets![0]));
    });

    it("show selected only: two selected files are in a closed folder, one of them is to be deselected", () => {
      const t = task("tutorial-show-selected");
      expect(t.requires).toEqual({ showSelectedOnly: true });
      const closed = (id: string) => !t.expanded!.includes(id.split("/").slice(0, -1).join("/"));
      expect(t.preselected!.filter(closed)).toHaveLength(2);
      const out = t.preselected!.filter((id) => !t.targets!.includes(id));
      expect(out).toHaveLength(1);
      expect(closed(out[0])).toBe(true);
      expect(localize(t.instructions, "en")).toContain(name(out[0]));
      expect(localize(t.instructions, "nb")).toContain(name(out[0]));
    });

    it("Task B: the spreadsheet's word matches nothing else (predicate search is global)", () => {
      const t = task("context-switch");
      const sheet = t.targets!.find((id) => id.endsWith(".xlsx"))!;
      const word = name(sheet).replace(/\.xlsx$/, "").replace(/_?\d+$/, "").split("_").pop()!; // "budget"
      expect(word).toBe("budget");
      expect(matching(d, word)).toEqual([sheet]);
    });

    it("Task C: pdf, draft and readme occur only in the task folder (predicate search is global)", () => {
      const t = task("rule-with-exceptions");
      const folder = t.expanded![0];
      for (const word of ["pdf", "draft", "readme"])
        for (const id of matching(d, word)) expect(id.startsWith(`${folder}/`), `${word}: ${id}`).toBe(true);
      const rule = matching(d, "pdf").filter((id) => !id.toLowerCase().includes("draft"));
      expect([...rule, ...matching(d, "readme")].sort()).toEqual([...t.targets!].sort());
    });

    it("Task A: anchor on the first kept photo, focus on the last, directly above the first target", () => {
      const t = task("keep-what-you-have");
      const ids = d.flat.map((n) => n.id);
      const kept = [...t.keep!].sort((a, b) => ids.indexOf(a) - ids.indexOf(b));
      const lastKept = kept.at(-1)!;
      expect(t.anchor).toBe(kept[0]);
      expect(t.focus).toBe(lastKept);
      const firstTarget = [...t.targets!].sort((a, b) => ids.indexOf(a) - ids.indexOf(b))[0];
      expect(ids.indexOf(firstTarget)).toBe(ids.indexOf(lastKept) + 1);
    });

    it("Task A: starts scrolled so the kept photos and all targets are within the task list", () => {
      const t = task("keep-what-you-have");
      const ids = d.flat.map((n) => n.id);
      const rows = [...t.keep!, ...t.targets!].map((id) => ids.indexOf(id) - ids.indexOf(t.scrollTo!));
      const fullRows = Math.floor(STUDY.taskExplorerHeight / 32); // tree rows are 32 px
      expect(Math.min(...rows)).toBeGreaterThanOrEqual(2); // a little context above
      expect(Math.max(...rows)).toBeLessThanOrEqual(fullRows - 3); // and below, clear of the edge
    });

    // Task D (revision 18): K1, an unflagged file, K2, then six targets directly below.
    it("Task D: two kept files with an unflagged file between them, directly followed by six targets", () => {
      const t = task("keep-and-extend");
      const folder = t.expanded![0];
      const rows = d.flat.filter((n) => n.id.startsWith(`${folder}/`)).map((n) => n.id);
      const role = (id: string) => (t.keep!.includes(id) ? "K" : t.targets!.includes(id) ? "T" : "-");
      expect(rows.map(role).join("")).toBe("--K-KTTTTTT-----");
      expect(t.preselected).toEqual(t.keep);
      expect(t.anchor).toBe(t.keep![1]); // as after a click on K1 and a Ctrl-click on K2
      expect(t.focus).toBe(t.keep![1]);
      expect(t.scrollTo).toBe(folder);
      expect(t.markTargets).not.toBe(false);
    });

    it("Task D: its folder is the last root folder, so Tasks A-C and the practice are unchanged", () => {
      const t = task("keep-and-extend");
      expect(d.tree.at(-1)!.name).toBe(t.expanded![0]);
    });

    it("Task D: no word another task searches for matches its files, and its stem matches nothing else", () => {
      const t = task("keep-and-extend");
      const folder = t.expanded![0];
      const typed = [...STUDY.tutorial.map((s) => s.task), ...STUDY.tasks]
        .flatMap((id) => [...(localize(d.tasks.get(id)!.instructions, "en") ?? "").matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]));
      expect(typed.length).toBeGreaterThan(0);
      const budget = name(task("context-switch").targets!.find((id) => id.endsWith(".xlsx"))!).replace(/\.xlsx$/, "").split("_").pop()!;
      for (const word of ["pdf", "draft", "readme", budget, ...typed])
        for (const id of matching(d, word)) expect(id.startsWith(`${folder}/`), `${word}: ${id}`).toBe(false);
      const stem = name(t.keep![0]).split("_")[0];
      for (const id of matching(d, stem)) expect(id.startsWith(`${folder}/`) || id === folder, `${stem}: ${id}`).toBe(true);
    });

    it("Task C names the two readme files and the word 'draft' (pilot 1)", () => {
      const t = task("rule-with-exceptions");
      for (const lang of LANGS) {
        const text = localize(t.instructions, lang)!;
        expect(text).toContain("'draft'");
        for (const id of matching(d, "readme")) expect(text, lang).toContain(name(id));
      }
    });
  });
});
