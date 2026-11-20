/**
 * Study protocol: group assignment, per-block plans and the screen sequence.
 */
import { describe, expect, it } from "vitest";
import { STUDY, configPlaceholders, type StudyConfig } from "../config";
import {
  GROUP_IDS,
  baselineModel,
  isGroupId,
  nextGroup,
  planMeta,
  planSession,
  sessionSteps,
} from "../protocol";

describe("nextGroup", () => {
  it("rotates G1, G2, G3, G4, G1, ... when every session completes", () => {
    const completed: Record<string, number> = {};
    const order = [];
    for (let i = 0; i < 9; i++) {
      const g = nextGroup(completed);
      order.push(g);
      completed[g] = (completed[g] ?? 0) + 1;
    }
    expect(order).toEqual(["G1", "G2", "G3", "G4", "G1", "G2", "G3", "G4", "G1"]);
  });

  it("gives a group whose session was stopped early to the next participant", () => {
    // G1 and G2 completed, G3's participant stopped: G3 is offered again.
    expect(nextGroup({ G1: 1, G2: 1 })).toBe("G3");
    expect(nextGroup({ G1: 2, G2: 2, G3: 1, G4: 2 })).toBe("G3");
  });

  it("ignores unknown groups", () => {
    expect(nextGroup({ G9: 5 })).toBe("G1");
    expect(isGroupId("G4")).toBe(true);
    expect(isGroupId("G5")).toBe(false);
    expect(isGroupId(null)).toBe(false);
  });
});

describe("baselineModel", () => {
  it("matches the traditional preset to the participant's OS", () => {
    expect(baselineModel("os-matched", "macos")).toBe("mac");
    expect(baselineModel("os-matched", "windows")).toBe("windows");
    expect(baselineModel("os-matched", "linux")).toBe("windows");
    expect(baselineModel("os-matched", "other")).toBe("windows");
  });
  it("uses a fixed preset when configured", () => {
    expect(baselineModel("mac", "windows")).toBe("mac");
    expect(baselineModel("windows", "macos")).toBe("windows");
  });
});

describe("planSession", () => {
  it("counterbalances system order and dataset across the four groups", () => {
    const summary = GROUP_IDS.map((g) =>
      planSession(STUDY, g, "windows").blocks.map((b) => `${b.label}:${b.system}/${b.datasetKey}`).join(" "),
    );
    expect(summary).toEqual([
      "A:predicate/D1 B:traditional/D2",
      "A:predicate/D2 B:traditional/D1",
      "A:traditional/D1 B:predicate/D2",
      "A:traditional/D2 B:predicate/D1",
    ]);
    // Each system meets each dataset in each position exactly once over a full rotation.
    const cells = GROUP_IDS.flatMap((g) => planSession(STUDY, g, "windows").blocks.map((b) => `${b.index}${b.system}${b.datasetKey}`));
    expect(new Set(cells).size).toBe(8);
  });

  it("uses the algebraic model for the predicate system and the OS-matched preset otherwise", () => {
    const plan = planSession(STUDY, "G3", "macos");
    expect(plan.blocks.map((b) => b.model)).toEqual(["mac", "algebraic"]);
    expect(plan.blocks[1]).toMatchObject({ undo: false, aids: true, dataset: STUDY.datasets.D2 });
    expect(plan.blocks[0]).toMatchObject({ undo: false, aids: false, dataset: STUDY.datasets.D1 });
  });

  it("repeats only the warm-up and the system-specific tutorial steps in the second block", () => {
    const predicateFirst = planSession(STUDY, "G1", "windows");
    expect(predicateFirst.blocks[0].tutorial).toEqual([
      "tutorial-warmup",
      "tutorial-range",
      "tutorial-search",
      "tutorial-list-view",
      "tutorial-select-matching",
      "tutorial-show-selected",
    ]);
    expect(predicateFirst.blocks[1].tutorial).toEqual(["tutorial-warmup"]);

    const traditionalFirst = planSession(STUDY, "G3", "windows");
    expect(traditionalFirst.blocks[0].tutorial).toEqual([
      "tutorial-warmup",
      "tutorial-range",
      "tutorial-search",
      "tutorial-list-view",
    ]);
    expect(traditionalFirst.blocks[1].tutorial).toEqual([
      "tutorial-warmup",
      "tutorial-select-matching",
      "tutorial-show-selected",
    ]);
  });

  it("practises \"Show selected only\" in every block that has the selection aids, and only there", () => {
    const withAids: StudyConfig = { ...STUDY, systems: { ...STUDY.systems, traditional: { undo: false, aids: true } } };
    const plan = planSession(withAids, "G3", "windows");
    expect(plan.blocks[0]).toMatchObject({ system: "traditional", aids: true });
    expect(plan.blocks[0].tutorial).toContain("tutorial-show-selected");
    expect(plan.blocks[0].tutorial).not.toContain("tutorial-select-matching");
    expect(planSession(STUDY, "G3", "windows").blocks[0].tutorial).not.toContain("tutorial-show-selected");
  });

  it("describes the plan for the log header", () => {
    expect(planMeta(planSession(STUDY, "G2", "macos"))).toEqual({
      group: "G2",
      blocks: [
        { label: "A", system: "predicate", model: "algebraic", dataset: "pets-demo-2", datasetKey: "D2", undo: false, aids: true },
        { label: "B", system: "traditional", model: "mac", dataset: "pets-demo", datasetKey: "D1", undo: false, aids: false },
      ],
    });
  });
});

describe("sessionSteps", () => {
  const steps = sessionSteps(planSession(STUDY, "G1", "windows"));

  it("runs intro, tutorial, tasks and questions per block, then the final questions and the debrief", () => {
    expect(steps.map((s) => s.kind)).toEqual([
      "blockIntro",
      ...Array(6).fill("tutorial"),
      ...Array(4).fill("task"), // A, B, C and (since revision 18) D
      "blockQuestions",
      "blockIntro",
      "tutorial",
      ...Array(4).fill("task"),
      "blockQuestions",
      "final",
      "debrief",
    ]);
    expect(steps.filter((s) => s.kind === "task").map((s) => (s.kind === "task" ? s.task : ""))).toEqual([
      ...STUDY.tasks,
      ...STUDY.tasks,
    ]);
  });
});

describe("configuration", () => {
  it("flags placeholders that must be filled in before the pilot", () => {
    const filled: StudyConfig = { ...STUDY, contact: "Kari Nordmann, kari@example.org", retention: { en: "until 2027", nb: "til 2027" } };
    expect(configPlaceholders(filled)).toEqual([]);
    expect(configPlaceholders({ ...filled, contact: "[NAME]" })).toEqual(["[NAME]"]);
  });
});
