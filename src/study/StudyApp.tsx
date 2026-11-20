// File: study/StudyApp.tsx
//
// Study mode (?study=1): a self-guided session. The experimenter checks the
// setup and hands over; the participant chooses a language, gives consent,
// then does two blocks (System A, System B: tutorial, tasks, questions), the
// final questions and the debrief. Every screen, answer and task is logged to
// one telemetry file named after the anonymous participant ID.
//
// URL parameters (experimenter):
//   ?study=1            study mode
//   &group=G1..G4       override the automatic group (this session only)
//   &pilot=1            pilot/test session (not counted, excluded from analysis)
//   &skipAfter=<s>      show the skip buttons after <s> seconds (tests, pilots; logged)
//   &guard=<s>          answer buttons inactive for <s> seconds per screen (default 1.5; tests use 0; logged)

import { useEffect, useMemo, useState } from "react";
import { DATASETS } from "../data/datasets";
import type { Dataset } from "../data/dataset";
import type { Lang } from "../data/tasks";
import { usePreloadedThumbnails } from "../hooks/usePreloadedThumbnails";
import { TelemetryContext } from "../telemetry/context";
import { TelemetryRecorder, newSessionId } from "../telemetry/recorder";
import { STUDY, type DatasetKey, type GroupId, type MainOs } from "./config";
import { TaskStep, TutorialStep } from "./ExplorerSteps";
import { contextOf, isGroupId, planMeta, planSession, sessionSteps, type SessionPlan, type StudyStep } from "./protocol";
import {
  BlockIntroScreen,
  BlockQuestionsScreen,
  ConsentScreen,
  DebriefScreen,
  FinalScreen,
  LanguageScreen,
  SetupScreen,
  StopControl,
  StoppedScreen,
} from "./screens";
import { STUDY_TEXT } from "./text";
import { pageStyle, ScreenGuardContext } from "./uiHelpers";

const params = new URLSearchParams(window.location.search);
const urlGroup = params.get("group");
const skipAfterParam = params.get("skipAfter");
const skipAfterOverrideMs = skipAfterParam !== null && !Number.isNaN(Number(skipAfterParam)) ? Number(skipAfterParam) * 1000 : null;
const TASK_SKIP_MS = skipAfterOverrideMs ?? STUDY.taskSkipAfterMs;
const TUTORIAL_SKIP_MS = skipAfterOverrideMs ?? STUDY.tutorialSkipAfterMs;
const guardParam = params.get("guard");
const guardOverrideMs = guardParam !== null && !Number.isNaN(Number(guardParam)) ? Number(guardParam) * 1000 : null;
const overrides = {
  ...(skipAfterOverrideMs !== null ? { skipAfterMs: skipAfterOverrideMs } : {}),
  ...(guardOverrideMs !== null ? { guardMs: guardOverrideMs } : {}),
};

const EMPTY_DATASET = DATASETS.get("mock")!;

/**
 * Study mode reacts to the left mouse button only: no context menu, no
 * right-click selection, no middle-click paste or autoscroll (Linux). The
 * events are stopped before React sees them. Returns the cleanup.
 */
function ignoreOtherMouseButtons(): () => void {
  const block = (e: MouseEvent) => {
    if (e.type === "contextmenu" || e.button !== 0) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const types = ["mousedown", "mouseup", "click", "auxclick", "contextmenu"] as const;
  for (const t of types) window.addEventListener(t, block, true);
  return () => {
    for (const t of types) window.removeEventListener(t, block, true);
  };
}

/**
 * Study mode blocks Ctrl+wheel (and touchpad pinch, which Chromium also sends
 * as a wheel event with ctrlKey) so a participant cannot change the browser
 * zoom by accident. The zoom the experimenter set stays as it is (Chromium
 * stores it per site). Keyboard zoom (Ctrl +/−/0) still works for the
 * experimenter. Returns the cleanup.
 */
function blockWheelZoom(): () => void {
  const block = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault();
  };
  // Non-passive, otherwise preventDefault is ignored.
  window.addEventListener("wheel", block, { passive: false, capture: true });
  return () => window.removeEventListener("wheel", block, { capture: true });
}

type Phase = "setup" | "language" | "consent" | "steps" | "stopped";

export function StudyApp() {
  const [recorder] = useState(
    () =>
      new TelemetryRecorder({
        sessionId: newSessionId("P"),
        meta: {
          study: {
            version: STUDY.version,
            ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
          },
        },
      }),
  );
  useEffect(() => recorder.attach(), [recorder]);
  useEffect(() => ignoreOtherMouseButtons(), []);
  useEffect(() => blockWheelZoom(), []);

  const [phase, setPhase] = useState<Phase>("setup");
  // After hand-over, log viewport changes (leaving full screen, zoom), settled for 300 ms.
  const handedOver = phase !== "setup";
  useEffect(() => {
    if (!handedOver) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () =>
          recorder.record({
            type: "viewport",
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
          }),
        300,
      );
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [handedOver, recorder]);
  const [lang, setLang] = useState<Lang>("en");
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [steps, setSteps] = useState<StudyStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [tutorialSkipAt, setTutorialSkipAt] = useState<number | null>(null);
  const text = STUDY_TEXT[lang];

  // While a session runs (hand-over to debrief), a reload, Back (also a touchpad
  // swipe or a mouse back button) or closing the tab asks first: a participant's
  // session ended that way (revision 22). The prompt is the browser's own. A
  // note marks every attempt in the log, whatever the participant then chose.
  const guarded = phase === "language" || phase === "consent" || (phase === "steps" && steps[stepIndex]?.kind !== "debrief");
  useEffect(() => {
    if (!guarded) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      recorder.record({ type: "note", text: "leave-page prompt" });
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [guarded, recorder]);

  // Both datasets are loaded (and their thumbnails decoded) before hand-over.
  const datasets: Record<DatasetKey, Dataset | undefined> = useMemo(
    () => ({ D1: DATASETS.get(STUDY.datasets.D1), D2: DATASETS.get(STUDY.datasets.D2) }),
    [],
  );
  const ready1 = usePreloadedThumbnails(datasets.D1 ?? EMPTY_DATASET);
  const ready2 = usePreloadedThumbnails(datasets.D2 ?? EMPTY_DATASET);
  const problems = useMemo(() => {
    const out: string[] = [];
    for (const key of ["D1", "D2"] as const) {
      const d = datasets[key];
      if (!d) {
        out.push(`Dataset ${key} ("${STUDY.datasets[key]}") not found in src/data/datasets/.`);
        continue;
      }
      for (const t of [...STUDY.tutorial.map((s) => s.task), ...STUDY.tasks])
        if (!d.tasks.has(t)) out.push(`Dataset ${d.id} has no task "${t}".`);
    }
    return out;
  }, [datasets]);

  const setStudyMeta = (patch: Record<string, unknown>) =>
    recorder.setMeta({ study: { ...(recorder.meta.study as Record<string, unknown>), ...patch } });
  const screen = (name: string, block: number | null = null, task: string | null = null) =>
    recorder.record({ type: "screen", screen: name, block, task });

  /** Shows step `index` and logs it; a tutorial step opens its task at once. */
  const enterStep = (index: number, s: StudyStep[] = steps, p: SessionPlan | null = plan) => {
    const step = s[index];
    if (!step || !p) return;
    switch (step.kind) {
      case "tutorial": {
        const block = p.blocks[step.block];
        screen("tutorial", step.block, step.task);
        recorder.enterContext(contextOf(block), datasets[block.datasetKey]!.tasks.get(step.task), {
          kind: "tutorial",
          block: step.block,
        });
        setTutorialSkipAt(TUTORIAL_SKIP_MS === null ? null : Date.now() + TUTORIAL_SKIP_MS); // per step
        break;
      }
      case "task":
        screen("taskIntro", step.block, step.task);
        break;
      case "blockIntro":
      case "blockQuestions":
        screen(step.kind, step.block);
        break;
      case "final":
        screen("final");
        break;
      case "debrief":
        screen("debrief");
        recorder.record({ type: "studyEnd", completed: true });
        setStudyMeta({ completed: true });
        void recorder.save();
        break;
    }
    setStepIndex(index);
  };
  const next = () => enterStep(stepIndex + 1);

  const stop = () => {
    if (recorder.openTask) recorder.endTask("abandoned");
    const step = steps[stepIndex];
    setStudyMeta({ completed: false, stoppedAt: phase === "steps" && step ? step.kind : phase });
    recorder.record({ type: "studyEnd", completed: false });
    screen("stopped");
    void recorder.save();
    setPhase("stopped");
  };

  const body = (() => {
    switch (phase) {
      case "setup":
        return (
          <SetupScreen
            recorder={recorder}
            initialGroup={isGroupId(urlGroup) ? urlGroup : null}
            initialPilot={params.get("pilot") === "1"}
            datasetsReady={ready1 && ready2}
            problems={problems}
            onStart={(group: GroupId, pilot: boolean) => {
              recorder.refreshScreen(); // the size the participant gets, not the size at page load
              setStudyMeta({ group, pilot, completed: false });
              screen("language");
              setPhase("language");
            }}
          />
        );
      case "language":
        return (
          <LanguageScreen
            onChoose={(l) => {
              setLang(l);
              setStudyMeta({ language: l });
              screen("consent");
              setPhase("consent");
            }}
          />
        );
      case "consent":
        return (
          <ConsentScreen
            text={text}
            lang={lang}
            onContinue={(os: MainOs, knowsExperimenter: boolean) => {
              const group = (recorder.meta.study as { group: GroupId }).group;
              const p = planSession(STUDY, group, os);
              const s = sessionSteps(p);
              setStudyMeta({ os, knowsExperimenter, consentedAt: new Date().toISOString(), ...planMeta(p) });
              setPlan(p);
              setSteps(s);
              setPhase("steps");
              enterStep(0, s, p);
            }}
          />
        );
      case "stopped":
        return <StoppedScreen text={text} recorder={recorder} />;
      case "steps":
        return plan ? renderStep(plan, steps[stepIndex]) : null;
    }
  })();

  function renderStep(p: SessionPlan, step: StudyStep | undefined) {
    if (!step) return null;
    switch (step.kind) {
      case "blockIntro":
        return (
          <BlockIntroScreen
            key={stepIndex}
            text={text}
            label={p.blocks[step.block].label}
            first={step.block === 0}
            onStart={next}
          />
        );
      case "tutorial":
      case "task": {
        const block = p.blocks[step.block];
        const dataset = datasets[block.datasetKey]!;
        const task = dataset.tasks.get(step.task)!;
        const common = { block, dataset, task, lang, text, recorder };
        return step.kind === "tutorial" ? (
          <TutorialStep
            key={stepIndex}
            {...common}
            heading={text.practice(step.index + 1, step.count)}
            skipAvailableAt={tutorialSkipAt}
            onNext={next}
            onSkip={() => {
              recorder.endTask("skipped");
              next();
            }}
          />
        ) : (
          <TaskStep
            key={stepIndex}
            {...common}
            heading={text.task(step.index + 1, step.count)}
            skipAfterMs={TASK_SKIP_MS}
            onFinished={next}
          />
        );
      }
      case "blockQuestions":
        return (
          <BlockQuestionsScreen
            key={stepIndex}
            text={text}
            label={p.blocks[step.block].label}
            onDone={(answers) => {
              for (const [question, value] of Object.entries(answers))
                recorder.record({ type: "answer", question, value, block: step.block, task: null });
              next();
            }}
          />
        );
      case "final":
        return (
          <FinalScreen
            text={text}
            onDone={(answers) => {
              for (const [question, value] of Object.entries(answers))
                recorder.record({ type: "answer", question, value, block: null, task: null });
              next();
            }}
          />
        );
      case "debrief":
        return <DebriefScreen text={text} plan={p} recorder={recorder} />;
    }
  }

  const participantScreen = phase === "consent" || (phase === "steps" && steps[stepIndex]?.kind !== "debrief");
  return (
    <TelemetryContext.Provider value={recorder}>
      <ScreenGuardContext.Provider value={guardOverrideMs ?? STUDY.screenGuardMs}>
        <div style={pageStyle} data-testid="study" data-phase={phase}>
          {body}
          {participantScreen && <StopControl text={text} onStop={stop} />}
        </div>
      </ScreenGuardContext.Provider>
    </TelemetryContext.Provider>
  );
}
