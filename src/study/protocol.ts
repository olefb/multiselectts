// File: study/protocol.ts
//
// Pure study logic: which group a new participant gets, what each block runs
// (system, selection model, dataset, tutorial steps, tasks), and the order of
// the screens. No React here, so it is unit-tested directly.

import type { SelectionModelName } from "../lib/engines";
import type {
  BaselineChoice,
  DatasetKey,
  GroupId,
  MainOs,
  StudyConfig,
  StudySystem,
} from "./config";

export const GROUP_IDS: readonly GroupId[] = ["G1", "G2", "G3", "G4"];

export function isGroupId(value: string | null | undefined): value is GroupId {
  return (GROUP_IDS as readonly string[]).includes(value ?? "");
}

/**
 * The group for the next participant: the one with the fewest completed
 * sessions, ties broken in group order. With every session completed this is
 * plain rotation (G1, G2, G3, G4, G1, ...); a session stopped early leaves its
 * group free for the next participant.
 */
export function nextGroup(completed: Partial<Record<string, number>>): GroupId {
  let best: GroupId = GROUP_IDS[0];
  for (const g of GROUP_IDS) if ((completed[g] ?? 0) < (completed[best] ?? 0)) best = g;
  return best;
}

/** The traditional preset a participant gets. Linux and other systems get the Windows-like one. */
export function baselineModel(choice: BaselineChoice, os: MainOs): "windows" | "mac" {
  if (choice !== "os-matched") return choice;
  return os === "macos" ? "mac" : "windows";
}

export interface BlockPlan {
  /** 0 or 1. */
  index: number;
  /** What participants see: "A" (first block) or "B". */
  label: "A" | "B";
  system: StudySystem;
  model: SelectionModelName;
  datasetKey: DatasetKey;
  dataset: string;
  undo: boolean;
  aids: boolean;
  tutorial: string[];
  tasks: string[];
}

export interface SessionPlan {
  group: GroupId;
  blocks: [BlockPlan, BlockPlan];
}

export function planSession(config: StudyConfig, group: GroupId, os: MainOs): SessionPlan {
  const blocks = config.groups[group].map((spec, index): BlockPlan => {
    const model: SelectionModelName = spec.system === "predicate" ? "algebraic" : baselineModel(config.baseline, os);
    return {
      index,
      label: index === 0 ? "A" : "B",
      system: spec.system,
      model,
      datasetKey: spec.dataset,
      dataset: config.datasets[spec.dataset],
      ...config.systems[spec.system],
      tutorial: config.tutorial
        .filter(
          (s) =>
            (!s.systems || s.systems.includes(spec.system)) &&
            (!s.firstBlockOnly || index === 0) &&
            (!s.requiresAids || config.systems[spec.system].aids),
        )
        .map((s) => s.task),
      tasks: [...config.tasks],
    };
  });
  return { group, blocks: blocks as [BlockPlan, BlockPlan] };
}

/** Explorer configuration of a block, as logged in "context" events. */
export const contextOf = (block: BlockPlan) => ({
  model: block.model,
  dataset: block.dataset,
  undo: block.undo,
  aids: block.aids,
});

/** The participant's screens after consent, in order. */
export type StudyStep =
  | { kind: "blockIntro"; block: number }
  | { kind: "tutorial"; block: number; task: string; index: number; count: number }
  | { kind: "task"; block: number; task: string; index: number; count: number }
  | { kind: "blockQuestions"; block: number }
  | { kind: "final" }
  | { kind: "debrief" };

export function sessionSteps(plan: SessionPlan): StudyStep[] {
  const steps: StudyStep[] = [];
  for (const b of plan.blocks) {
    steps.push({ kind: "blockIntro", block: b.index });
    b.tutorial.forEach((task, index) =>
      steps.push({ kind: "tutorial", block: b.index, task, index, count: b.tutorial.length }),
    );
    b.tasks.forEach((task, index) => steps.push({ kind: "task", block: b.index, task, index, count: b.tasks.length }));
    steps.push({ kind: "blockQuestions", block: b.index });
  }
  steps.push({ kind: "final" }, { kind: "debrief" });
  return steps;
}

/** Session metadata for the log header (meta.study). */
export function planMeta(plan: SessionPlan) {
  return {
    group: plan.group,
    blocks: plan.blocks.map((b) => ({
      label: b.label,
      system: b.system,
      model: b.model,
      dataset: b.dataset,
      datasetKey: b.datasetKey,
      undo: b.undo,
      aids: b.aids,
    })),
  };
}
