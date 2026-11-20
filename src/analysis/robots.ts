// File: analysis/robots.ts
//
// "Robot participants": synthetic study logs with known behaviour, used to
// test the analysis pipeline before real data exist. Each robot follows the
// real protocol (group rotation, OS-matched baseline, the configured tutorial
// and tasks of each block's dataset) and produces a log in the same format as
// study mode, with time, gestures, errors, accidental clears and answers drawn
// from a profile. EXPECTED_EFFECTS encodes the effects the methodology
// predicts; NO_EFFECTS gives both systems the same behaviour, which the
// statistics must not mistake for a difference.
//
// This is a model of plausible logs, not a simulation of the UI: it does not
// click through the explorer. (e2e/study.e2e.ts checks the real logs.)

import type { Dataset } from "../data/dataset";
import { evaluateTask, type TaskSpec } from "../data/tasks";
import type { MainOs, StudyConfig, StudySystem } from "../study/config";
import { contextOf, nextGroup, planMeta, planSession, sessionSteps, type BlockPlan } from "../study/protocol";
import { TELEMETRY_SCHEMA, type TelemetryEvent, type TelemetryEventBody, type TelemetryLog } from "../telemetry/schema";

/** Behaviour of one system on one task (or tutorial step). */
export interface AttemptProfile {
  /** Median time from first input to Done, seconds. */
  medianS: number;
  /** Spread (sigma of the log-normal). */
  sigma: number;
  /** Mean number of gestures. */
  gestures: number;
  /** Probability that the final selection is exactly right. */
  pExact: number;
  /** Probability of ending with the orange (keep) items lost. */
  pKeepLost?: number;
  /** Probability of an accidental clear that is noticed and repaired. */
  pClear?: number;
  /** Probability of giving up with "Skip this task". */
  pSkip?: number;
}

export interface RobotProfile {
  name: string;
  /** Per system: by task ID, with "tutorial" as the default for tutorial steps. */
  attempts: Record<StudySystem, Record<string, AttemptProfile>>;
  /** Added to the ease rating (1-7) per system. */
  seqShift: Record<StudySystem, number>;
  /** Mean answers (1-7) to the two per-system questions. */
  sufficient: Record<StudySystem, number>;
  frustrating: Record<StudySystem, number>;
  pPreferPredicate: number;
  pNoPreference: number;
  /** Probability that a participant stops the study early. */
  pStop: number;
}

const TUTORIAL: AttemptProfile = { medianS: 10, sigma: 0.4, gestures: 3, pExact: 1 };
const WARMUP: AttemptProfile = { medianS: 6, sigma: 0.35, gestures: 3, pExact: 1 };

export const EXPECTED_EFFECTS: RobotProfile = {
  name: "expected effects",
  attempts: {
    predicate: {
      tutorial: TUTORIAL,
      "tutorial-warmup": WARMUP,
      "keep-what-you-have": { medianS: 20, sigma: 0.4, gestures: 4, pExact: 0.9, pKeepLost: 0.03, pClear: 0.1 },
      "context-switch": { medianS: 35, sigma: 0.4, gestures: 12, pExact: 0.85, pClear: 0.05, pSkip: 0.01 },
      "rule-with-exceptions": { medianS: 30, sigma: 0.45, gestures: 6, pExact: 0.8, pSkip: 0.02 },
      "keep-and-extend": { medianS: 18, sigma: 0.4, gestures: 4, pExact: 0.85, pKeepLost: 0.05, pClear: 0.05 },
    },
    traditional: {
      tutorial: TUTORIAL,
      "tutorial-warmup": WARMUP,
      // Task A is the baseline task (revision 18): no difference expected.
      "keep-what-you-have": { medianS: 20, sigma: 0.4, gestures: 4, pExact: 0.9, pKeepLost: 0.03, pClear: 0.1 },
      "context-switch": { medianS: 60, sigma: 0.45, gestures: 20, pExact: 0.6, pClear: 0.4, pSkip: 0.1 },
      "rule-with-exceptions": { medianS: 55, sigma: 0.45, gestures: 16, pExact: 0.45, pSkip: 0.05 },
      // Windows-like: a Shift-click after a Ctrl-click replaces the selection.
      "keep-and-extend": { medianS: 24, sigma: 0.45, gestures: 6, pExact: 0.55, pKeepLost: 0.35, pClear: 0.35 },
    },
  },
  seqShift: { predicate: 0.7, traditional: 0 },
  sufficient: { predicate: 5.8, traditional: 5.0 },
  frustrating: { predicate: 2.5, traditional: 3.8 },
  pPreferPredicate: 0.75,
  pNoPreference: 0.1,
  pStop: 0.03,
};

/** Both systems behave like the average of the two in EXPECTED_EFFECTS. */
export const NO_EFFECTS: RobotProfile = (() => {
  const mean = (a: AttemptProfile, b: AttemptProfile): AttemptProfile => ({
    medianS: Math.sqrt(a.medianS * b.medianS),
    sigma: (a.sigma + b.sigma) / 2,
    gestures: (a.gestures + b.gestures) / 2,
    pExact: (a.pExact + b.pExact) / 2,
    pKeepLost: ((a.pKeepLost ?? 0) + (b.pKeepLost ?? 0)) / 2,
    pClear: ((a.pClear ?? 0) + (b.pClear ?? 0)) / 2,
    pSkip: ((a.pSkip ?? 0) + (b.pSkip ?? 0)) / 2,
  });
  const p = EXPECTED_EFFECTS.attempts.predicate;
  const t = EXPECTED_EFFECTS.attempts.traditional;
  const same = Object.fromEntries(Object.keys(p).map((k) => [k, mean(p[k], t[k])]));
  return {
    name: "no effects",
    attempts: { predicate: same, traditional: same },
    seqShift: { predicate: 0.35, traditional: 0.35 },
    sufficient: { predicate: 5.4, traditional: 5.4 },
    frustrating: { predicate: 3.1, traditional: 3.1 },
    pPreferPredicate: 0.5,
    pNoPreference: 0.1,
    pStop: 0.03,
  };
})();

// ---------------------------------------------------------------------------
// Random numbers (seeded)
// ---------------------------------------------------------------------------

export class Rng {
  private a: number;
  constructor(seed: number) {
    this.a = seed >>> 0;
  }
  next(): number {
    this.a = (this.a + 0x6d2b79f5) | 0;
    let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  chance(p: number) {
    return this.next() < p;
  }
  normal() {
    const u = 1 - this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)];
  }
  /** `k` distinct elements. */
  sample<T>(xs: readonly T[], k: number): T[] {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, Math.max(0, Math.min(k, a.length)));
  }
}

// ---------------------------------------------------------------------------
// One attempt
// ---------------------------------------------------------------------------

/** What a robot did in one attempt (for tests of the extraction). */
export interface AttemptTruth {
  block: number;
  task: string;
  kind: "tutorial" | "task";
  reason: "done" | "skipped" | "abandoned";
  gestures: number;
  /** First input → end, ms. */
  activeMs: number;
  /** Required items cleared by accident and selected again. */
  reselected: number;
  final: string[];
}

interface AttemptInput {
  rng: Rng;
  dataset: Dataset;
  task: TaskSpec;
  block: BlockPlan;
  kind: "tutorial" | "task";
  profile: AttemptProfile;
  /** Participant speed factor × practice factor. */
  speed: number;
  skipAfterMs: number | null;
  /** Stop the study during this attempt. */
  abandon: boolean;
}

function attempt(input: AttemptInput, t0: number, emit: (t: number, e: TelemetryEventBody) => void): { end: number; truth: AttemptTruth } {
  const { rng, dataset, task, block, kind, profile } = input;
  const required = [...new Set([...(task.targets ?? []), ...(task.keep ?? [])])];
  const keep = task.keep ?? [];
  const files = dataset.flat.filter((n) => !n.children).map((n) => n.id);

  // Timing.
  const firstInput = t0 + 800 + rng.next() * (kind === "tutorial" ? 1500 : 3000);
  let active = Math.exp(Math.log(profile.medianS * 1000 * input.speed) + profile.sigma * rng.normal());
  let reason: AttemptTruth["reason"] = "done";
  if (kind === "task" && input.skipAfterMs !== null) {
    const giveUp = rng.chance(profile.pSkip ?? 0) || active > input.skipAfterMs + 60_000;
    if (giveUp) {
      reason = "skipped";
      active = Math.max(active, input.skipAfterMs + 2000 + rng.next() * 20_000) - (firstInput - t0);
    }
  }
  if (input.abandon) {
    reason = "abandoned";
    active *= rng.next();
  }
  const end = firstInput + active;

  // Final selection.
  let final = new Set(required);
  if (kind === "task") {
    if (reason !== "done") {
      final = new Set([...keep, ...rng.sample(required, Math.floor(required.length / 2))]);
    } else if (!rng.chance(profile.pExact)) {
      const targets = (task.targets ?? []).filter((id) => !keep.includes(id));
      for (const id of rng.sample(targets, 1 + Math.floor(rng.next() * 2))) final.delete(id);
      const others = files.filter((id) => !required.includes(id));
      for (const id of rng.sample(others, Math.floor(rng.next() * 3))) final.add(id);
    }
    if (keep.length > 0 && rng.chance(profile.pKeepLost ?? 0)) keep.forEach((id) => final.delete(id));
  }

  // Gestures: evenly spread between the first input and the end.
  const n = Math.max(1, Math.round(profile.gestures * (0.6 + 0.8 * rng.next())));
  const clearAt = kind === "task" && n >= 3 && rng.chance(profile.pClear ?? 0) ? 1 + Math.floor(rng.next() * (n - 2)) : -1;
  const predicateSearch =
    block.system === "predicate" && (task.id === "rule-with-exceptions" || task.id.endsWith("-matching"));
  const current = new Set(task.preselected ?? []);
  const cleared = new Set<string>();
  const queue = () => [...final].filter((id) => !current.has(id));
  let x = 200;
  let y = 100;

  if (block.system === "traditional" && task.id === "context-switch") {
    emit(firstInput - 1, { type: "navigate", folder: null, via: "breadcrumb" });
  }
  for (let i = 0; i < n; i++) {
    const t = firstInput + (active * i) / n;
    // Diff of this gesture.
    let added: string[] = [];
    let removed: string[] = [];
    if (i === clearAt) {
      removed = [...current].filter((id) => required.includes(id));
      removed.forEach((id) => cleared.add(id));
    } else if (i === n - 1) {
      added = queue();
      removed = [...current].filter((id) => !final.has(id));
    } else {
      const q = queue();
      added = q.slice(0, Math.ceil(q.length / (n - i)));
    }
    // The gesture itself.
    const item = added[0] ?? removed[0] ?? null;
    for (let m = 0; m < 3; m++) {
      x += (rng.next() - 0.5) * 80;
      y += (rng.next() - 0.5) * 60;
      emit(t - 300 + m * 100, { type: "move", x: Math.round(x), y: Math.round(y), dragging: false });
    }
    if (predicateSearch && i < 2) {
      const mode = i === 0 ? "select" : "deselect";
      emit(t - 200, { type: "searchMode", mode });
      emit(t - 100, { type: "searchInput", mode, query: "pdf" });
      emit(t, { type: "searchCommit", mode, query: "pdf", via: "enter" });
    } else if (rng.chance(0.08)) {
      emit(t, { type: "key", key: "ArrowDown", ctrl: false, shift: true, alt: false, command: "extend" });
    } else {
      const drag = rng.chance(0.15);
      const modifier = i === 0 && current.size === 0 ? "none" : rng.chance(0.15) ? "shift" : "ctrl";
      emit(t, { type: "press", x: Math.round(x), y: Math.round(y), item, modifier, clickCount: 1 });
      if (drag) emit(t + 150, { type: "move", x: Math.round(x), y: Math.round(y + 90), dragging: true });
      emit(t + (drag ? 300 : 90), { type: "release", x: Math.round(x), y: Math.round(y + (drag ? 90 : 0)), item, dragged: drag });
    }
    removed.forEach((id) => current.delete(id));
    added.forEach((id) => current.add(id));
    if (added.length + removed.length > 0)
      emit(t + 95, { type: "selection", added, removed, size: current.size, undo: 0, redo: 0 });
  }

  const reselected = [...cleared].filter((id) => current.has(id)).length;
  return {
    end,
    truth: { block: block.index, task: task.id, kind, reason, gestures: n, activeMs: end - firstInput, reselected, final: [...current].sort() },
  };
}

// ---------------------------------------------------------------------------
// One session
// ---------------------------------------------------------------------------

export interface RobotOptions {
  config: StudyConfig;
  /** Datasets by ID (at least the study's D1 and D2). */
  datasets: ReadonlyMap<string, Dataset>;
  profile: RobotProfile;
  seed: number;
}

export interface RobotSession {
  log: TelemetryLog;
  truth: AttemptTruth[];
}

const clamp7 = (v: number) => Math.min(7, Math.max(1, Math.round(v)));

export function robotSession(options: RobotOptions & { index: number; group: ReturnType<typeof nextGroup> }): RobotSession {
  const { config, datasets, profile, index, group } = options;
  const rng = new Rng(options.seed * 1000 + index);
  const os: MainOs = rng.chance(0.65) ? "windows" : rng.chance(0.85) ? "macos" : "linux";
  const plan = planSession(config, group, os);
  const steps = sessionSteps(plan);
  const events: TelemetryEvent[] = [];
  const emit = (t: number, e: TelemetryEventBody) => events.push({ t: Math.round(t * 10) / 10, ...e } as TelemetryEvent);
  const truth: AttemptTruth[] = [];
  const speed = Math.exp(0.25 * rng.normal());
  const stopAt = rng.chance(profile.pStop) ? 1 + Math.floor(rng.next() * (steps.length - 3)) : -1;
  const language = rng.chance(0.6) ? "nb" : "en";

  let t = 2000;
  emit(t, { type: "screen", screen: "language", block: null, task: null });
  t += 3000;
  emit(t, { type: "screen", screen: "consent", block: null, task: null });
  t += 30_000 + rng.next() * 30_000;

  let completed = true;
  let stoppedAt: string | undefined;
  const sufficientLost: Record<string, boolean> = {};
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stopping = i === stopAt;
    if (step.kind === "tutorial" || step.kind === "task") {
      const block = plan.blocks[step.block];
      const dataset = datasets.get(block.dataset);
      if (!dataset) throw new Error(`robots: dataset ${block.dataset} not loaded`);
      const task = dataset.tasks.get(step.task)!;
      const kind = step.kind;
      const attempts = profile.attempts[block.system];
      const p = attempts[step.task] ?? attempts.tutorial;
      if (kind === "task") {
        emit(t, { type: "screen", screen: "taskIntro", block: block.index, task: task.id });
        t += 5000 + rng.next() * 6000;
        emit(t, { type: "screen", screen: "task", block: block.index, task: task.id });
      } else emit(t, { type: "screen", screen: "tutorial", block: block.index, task: task.id });
      emit(t, { type: "context", ...contextOf(block), task: task.id });
      emit(t, {
        type: "taskStart",
        task: task.id,
        view: task.view ?? "tree",
        targets: [...(task.targets ?? [])],
        keep: [...(task.keep ?? [])],
        preselected: [...(task.preselected ?? [])],
        kind,
        block: block.index,
      });
      const r = attempt(
        {
          rng,
          dataset,
          task,
          block,
          kind,
          profile: p,
          speed: speed * (block.index === 1 ? 0.9 : 1),
          skipAfterMs: config.taskSkipAfterMs,
          abandon: stopping,
        },
        t,
        emit,
      );
      t = r.end;
      const selected = r.truth.final;
      emit(t, {
        type: "taskEnd",
        task: task.id,
        reason: r.truth.reason,
        duration: Math.round((t - events.findLast((e) => e.type === "taskStart")!.t) * 10) / 10,
        selected,
        score: evaluateTask(task, new Set(selected)),
      });
      truth.push(r.truth);
      if (kind === "task" && (task.keep ?? []).some((id) => !selected.includes(id))) sufficientLost[block.label] = true;
      if (stopping) {
        completed = false;
        stoppedAt = step.kind;
        break;
      }
      if (kind === "task") {
        emit(t + 100, { type: "screen", screen: "seq", block: block.index, task: task.id });
        t += 2500 + rng.next() * 2000;
        const slow = Math.log((r.truth.activeMs / 1000 + 1) / (p.medianS + 1));
        const seq = clamp7(5.2 - 1.5 * slow + profile.seqShift[block.system] + 0.8 * rng.normal() - (r.truth.reason === "skipped" ? 2 : 0));
        emit(t, { type: "answer", question: "seq", value: seq, block: block.index, task: task.id });
      } else t += 1200 + rng.next() * 1000; // "Correct!" → Next
      continue;
    }
    if (stopping) {
      completed = false;
      stoppedAt = step.kind;
      break;
    }
    switch (step.kind) {
      case "blockIntro":
        emit(t, { type: "screen", screen: "blockIntro", block: step.block, task: null });
        t += 8000 + rng.next() * 8000;
        break;
      case "blockQuestions": {
        const system = plan.blocks[step.block].system;
        emit(t, { type: "screen", screen: "blockQuestions", block: step.block, task: null });
        t += 6000 + rng.next() * 6000;
        emit(t, { type: "answer", question: "sufficient", value: clamp7(profile.sufficient[system] + rng.normal()), block: step.block, task: null });
        emit(t, { type: "answer", question: "frustrating", value: clamp7(profile.frustrating[system] + rng.normal()), block: step.block, task: null });
        break;
      }
      case "final": {
        emit(t, { type: "screen", screen: "final", block: null, task: null });
        t += 10_000 + rng.next() * 10_000;
        const predicateLabel = plan.blocks.find((b) => b.system === "predicate")!.label;
        const traditionalLabel = predicateLabel === "A" ? "B" : "A";
        const preference = rng.chance(profile.pNoPreference)
          ? "none"
          : rng.chance(profile.pPreferPredicate)
            ? predicateLabel
            : traditionalLabel;
        const lost = sufficientLost.A && sufficientLost.B ? "both" : sufficientLost.A ? "A" : sufficientLost.B ? "B" : "no";
        emit(t, { type: "answer", question: "preference", value: preference, block: null, task: null });
        emit(t, { type: "answer", question: "lostSelection", value: lost, block: null, task: null });
        if (rng.chance(0.3)) emit(t, { type: "answer", question: "comment", value: "robot comment", block: null, task: null });
        break;
      }
      case "debrief":
        emit(t, { type: "screen", screen: "debrief", block: null, task: null });
        break;
    }
  }
  if (!completed) emit(t + 500, { type: "screen", screen: "stopped", block: null, task: null });
  emit(t + 600, { type: "studyEnd", completed });

  const log: TelemetryLog = {
    schema: TELEMETRY_SCHEMA,
    sessionId: `R-${String(index + 1).padStart(4, "0")}`,
    startedAt: new Date(Date.UTC(2026, 9, 1, 9) + index * 15 * 60_000).toISOString(),
    app: { commit: "robots" },
    screen: { viewportWidth: config.viewport.width, viewportHeight: config.viewport.height, devicePixelRatio: 1 },
    meta: {
      robot: profile.name,
      study: {
        version: config.version,
        pilot: false,
        completed,
        ...(stoppedAt ? { stoppedAt } : {}),
        language,
        os,
        knowsExperimenter: rng.chance(0.4),
        ...planMeta(plan),
      },
    },
    events: events.sort((a, b) => a.t - b.t),
  };
  return { log, truth };
}

/** `count` robot sessions, assigned to groups the way the study server does (fewest completed first). */
export function robotSessions(options: RobotOptions & { count: number }): RobotSession[] {
  const completed: Record<string, number> = {};
  const out: RobotSession[] = [];
  for (let index = 0; index < options.count; index++) {
    const group = nextGroup(completed);
    const s = robotSession({ ...options, index, group });
    if ((s.log.meta.study as { completed: boolean }).completed) completed[group] = (completed[group] ?? 0) + 1;
    out.push(s);
  }
  return out;
}
