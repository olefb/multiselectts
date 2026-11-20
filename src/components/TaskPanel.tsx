import { localize, type TaskScore, type TaskSpec } from "../data/tasks";

interface Props {
  task: TaskSpec;
  /** Score after Done (experimenter view); null while the task runs. */
  score: TaskScore | null;
  onDone: () => void;
  onRestart: () => void;
}

/** Task instructions with Done (experimenter/pilot view; the study harness replaces it). */
export function TaskPanel({ task, score, onDone, onRestart }: Props) {
  return (
    <div
      data-testid="task-panel"
      style={{
        maxWidth: "960px",
        margin: "12px auto 0",
        padding: "8px 12px",
        border: "1px solid #b3d7ff",
        background: "#eef6ff",
        borderRadius: "4px",
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <span data-testid="task-instructions" style={{ flex: 1, whiteSpace: "pre-line" }}>
        {localize(task.instructions, "en")?.replaceAll("**", "") ?? task.title ?? task.id}
      </span>
      {score === null ? (
        <button onClick={onDone}>Done</button>
      ) : (
        <>
          <span data-testid="task-score" style={{ color: score.exact ? "#2e7d32" : "#c62828" }}>
            {score.exact
              ? "Exact ✓"
              : `missing ${score.missing.length}, extra ${score.extra.length}` +
                (score.keepLost.length ? `, kept lost ${score.keepLost.length}` : "")}
          </span>
          <button onClick={onRestart}>Restart task</button>
        </>
      )}
    </div>
  );
}
