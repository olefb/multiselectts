// File: study/ExplorerSteps.tsx
//
// The two study steps that show the explorer:
//   - TutorialStep: instruction + automatic check; "Next" once the selection
//     is right (only checked when settled: not mid-drag, no live preview) and
//     the step's required view state holds (e.g. list view, "Show selected
//     only"); "Skip this step" after a while; "Start this step again" on
//     steps that start with a selection (a lost selection cannot be redone
//     there), logged as a restarted attempt plus a fresh one.
//     A step can outline the control it is about (task.highlight) and show a
//     note in place of the instructions once it is done (task.doneNote).
//   - TaskStep: instruction screen with Start → explorer with Done (and
//     "Skip this task" after a while) → one-click ease question (SEQ). The
//     system's tools stay listed under the instructions while the task runs
//     (pilot 1: participants forgot the search features after the practice).
// Both log through the telemetry recorder: enterContext opens the task,
// endTask closes and scores it.

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { VirtualizedExplorer } from "../components/VirtualizedExplorer";
import { EXPLORER_TEXT } from "../components/explorer/text";
import type { Dataset } from "../data/dataset";
import { evaluateTask, localize, meetsRequirements, type ExplorerViewState, type Lang, type TaskSpec } from "../data/tasks";
import { engineFactory } from "../lib/engines";
import type { TelemetryRecorder } from "../telemetry/recorder";
import { STUDY } from "./config";
import { contextOf, type BlockPlan } from "./protocol";
import type { StudyText } from "./text";
import { Card, Emphasis, Likert, PrimaryButton } from "./ui";
import { useDeadline } from "./uiHelpers";

interface Common {
  block: BlockPlan;
  dataset: Dataset;
  task: TaskSpec;
  lang: Lang;
  text: StudyText;
  recorder: TelemetryRecorder;
  /** Heading such as "Practice 2 of 6" or "Task 1 of 3". */
  heading: string;
}

function StudyExplorer({
  block,
  dataset,
  task,
  lang,
  onSelectionChange,
  onViewStateChange,
  height = STUDY.explorerHeight,
}: Pick<Common, "block" | "dataset" | "task" | "lang"> & {
  onSelectionChange?: (selected: ReadonlySet<string>, settled: boolean) => void;
  onViewStateChange?: (state: ExplorerViewState) => void;
  height?: number;
}) {
  const createEngine = useMemo(
    () => engineFactory<string, { x: number; y: number }>(block.model, { undo: block.undo }),
    [block.model, block.undo],
  );
  return (
    <VirtualizedExplorer
      variant="study"
      text={EXPLORER_TEXT[lang]}
      createEngine={createEngine}
      dataset={dataset}
      task={task}
      selectionAids={block.aids}
      onSelectionChange={onSelectionChange}
      onViewStateChange={onViewStateChange}
      viewportHeight={height}
    />
  );
}

/** Instruction bar above the explorer; `footer` is a smaller line across the whole bar. */
function InstructionBar({
  heading,
  instructions,
  footer,
  children,
}: {
  heading: string;
  instructions: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-testid="study-instructions"
      style={{
        maxWidth: "960px",
        margin: "8px auto 0",
        padding: "8px 16px",
        textAlign: "left",
        background: "#fff8e1",
        border: "1px solid #f0d58c",
        borderRadius: "8px",
        fontSize: "16px",
        lineHeight: 1.4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#8a6d1f" }}>
            {heading}
          </div>
          {/* Numbered task steps are separate lines. */}
          <div style={{ whiteSpace: "pre-line" }}>
            <Emphasis text={instructions} />
          </div>
        </div>
        {children}
      </div>
      {footer && (
        <div data-testid="task-tools-reminder" style={{ marginTop: "4px", fontSize: "13px", lineHeight: 1.35, color: "#6b5516" }}>
          {footer}
        </div>
      )}
    </div>
  );
}

const smallButton = {
  fontSize: "14px",
  padding: "6px 12px",
  borderRadius: "6px",
  border: "1px solid #b0b7c3",
  background: "#fff",
  color: "#333",
  cursor: "pointer",
} as const;

export function TutorialStep({
  block,
  dataset,
  task,
  lang,
  text,
  recorder,
  heading,
  skipAvailableAt,
  onNext,
  onSkip,
}: Common & {
  /** Date.now() time from which "Skip this step" is offered (null: never). */
  skipAvailableAt: number | null;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [passed, setPassed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const canSkip = useDeadline(skipAvailableAt);
  const canRestart = (task.preselected?.length ?? 0) > 0;
  // Latest reports from the explorer; the step passes once both are right.
  const latest = useRef<{ selected: ReadonlySet<string> | null; settled: boolean; view: ExplorerViewState | null }>({
    selected: null,
    settled: false,
    view: null,
  });
  const passedRef = useRef(false);
  const check = useCallback(() => {
    const { selected, settled, view } = latest.current;
    if (passedRef.current || !selected || !settled || !view) return;
    if (!evaluateTask(task, selected).exact || !meetsRequirements(task, view)) return;
    passedRef.current = true;
    setPassed(true);
    recorder.endTask("done");
  }, [task, recorder]);
  const onSelectionChange = useCallback(
    (selected: ReadonlySet<string>, settled: boolean) => {
      latest.current.selected = selected;
      latest.current.settled = settled;
      check();
    },
    [check],
  );
  const onViewStateChange = useCallback(
    (view: ExplorerViewState) => {
      latest.current.view = view;
      check();
    },
    [check],
  );
  const restart = () => {
    recorder.endTask("restarted");
    recorder.enterContext(contextOf(block), task, { kind: "tutorial", block: block.index });
    latest.current = { selected: null, settled: false, view: null };
    setAttempt((a) => a + 1);
  };
  return (
    <>
      <InstructionBar
        heading={heading}
        instructions={(passed ? localize(task.doneNote, lang) : undefined) ?? localize(task.instructions, lang) ?? ""}
      >
        {passed ? (
          <>
            <span data-testid="tutorial-correct" style={{ color: "#2e7d32", fontWeight: 600 }}>
              {text.correct}
            </span>
            <PrimaryButton testId="tutorial-next" onClick={onNext}>
              {text.next}
            </PrimaryButton>
          </>
        ) : (
          <>
            {canRestart && (
              <button data-testid="restart-step" style={smallButton} onClick={restart}>
                {text.restartStep}
              </button>
            )}
            {canSkip && (
              <button data-testid="skip-practice" style={smallButton} onClick={onSkip}>
                {text.skipPractice}
              </button>
            )}
          </>
        )}
      </InstructionBar>
      <StudyExplorer
        key={attempt}
        block={block}
        dataset={dataset}
        task={task}
        lang={lang}
        onSelectionChange={onSelectionChange}
        onViewStateChange={onViewStateChange}
      />
    </>
  );
}

export function TaskStep({
  block,
  dataset,
  task,
  lang,
  text,
  recorder,
  heading,
  skipAfterMs,
  onFinished,
}: Common & { skipAfterMs: number | null; onFinished: () => void }) {
  const [phase, setPhase] = useState<"intro" | "running" | "seq">("intro");
  const [skipAt, setSkipAt] = useState<number | null>(null);
  const canSkip = useDeadline(skipAt);
  const instructions = localize(task.instructions, lang) ?? "";
  const tools = text.tools({ predicate: block.system === "predicate", aids: block.aids });
  const screen = (name: string) => recorder.record({ type: "screen", screen: name, block: block.index, task: task.id });

  const start = () => {
    screen("task");
    recorder.enterContext(contextOf(block), task, { kind: "task", block: block.index });
    setSkipAt(skipAfterMs === null ? null : Date.now() + skipAfterMs);
    setPhase("running");
  };
  const end = (reason: "done" | "skipped") => {
    recorder.endTask(reason);
    screen("seq");
    setPhase("seq");
  };

  if (phase === "intro")
    return (
      <Card testId="task-intro">
        <div style={{ fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>
          {text.system(block.label)} · {heading}
        </div>
        <p style={{ fontSize: "20px", margin: "12px 0 16px", whiteSpace: "pre-line" }}>
          <Emphasis text={instructions} />
        </p>
        <p data-testid="task-tools" style={{ color: "#555", fontSize: "15px", margin: "0 0 12px" }}>
          {tools}
        </p>
        <p style={{ color: "#555" }}>{text.taskIntro}</p>
        <PrimaryButton testId="task-start" onClick={start}>
          {text.start}
        </PrimaryButton>
      </Card>
    );

  if (phase === "seq")
    return (
      <Card testId="seq">
        <Likert
          id="seq"
          question={text.seq.question}
          low={text.seq.low}
          high={text.seq.high}
          value={null}
          onChange={(value) => {
            recorder.record({ type: "answer", question: "seq", value, block: block.index, task: task.id });
            onFinished();
          }}
        />
      </Card>
    );

  return (
    <>
      <InstructionBar heading={`${text.system(block.label)} · ${heading}`} instructions={instructions} footer={tools}>
        {canSkip && (
          <button data-testid="task-skip" style={smallButton} onClick={() => end("skipped")}>
            {text.skipTask}
          </button>
        )}
        <PrimaryButton testId="task-done" onClick={() => end("done")}>
          {text.done}
        </PrimaryButton>
      </InstructionBar>
      <StudyExplorer block={block} dataset={dataset} task={task} lang={lang} height={STUDY.taskExplorerHeight} />
    </>
  );
}
