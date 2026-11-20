import { MODEL_LABELS, SELECTION_MODELS, type SelectionModelName } from "../lib/engines";
import type { Dataset } from "../data/dataset";
import type { TelemetryRecorder } from "../telemetry/recorder";
import { RecordingStatus } from "./RecordingStatus";

interface Props {
  model: SelectionModelName;
  onModelChange: (model: SelectionModelName) => void;
  datasets: readonly Dataset[];
  dataset: Dataset;
  onDatasetChange: (id: string) => void;
  /** Selected task ID, or null for free exploration. */
  taskId: string | null;
  onTaskChange: (id: string | null) => void;
  undo: boolean;
  onUndoChange: (on: boolean) => void;
  aids: boolean;
  onAidsChange: (on: boolean) => void;
  recorder: TelemetryRecorder;
}

/** Experimenter controls (hidden for participants with ?locked=1). */
export function ExperimenterBar(p: Props) {
  const tasks = [...p.dataset.tasks.values()];
  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "12px 20px 0",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px 12px",
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
      }}
    >
      <span>
        <label htmlFor="selection-model">Selection model:</label>{" "}
        <select
          id="selection-model"
          value={p.model}
          onChange={(e) => p.onModelChange(e.target.value as SelectionModelName)}
        >
          {SELECTION_MODELS.map((m) => (
            <option key={m} value={m}>
              {MODEL_LABELS[m]}
            </option>
          ))}
        </select>
      </span>
      <span>
        <label htmlFor="dataset">Dataset:</label>{" "}
        <select id="dataset" value={p.dataset.id} onChange={(e) => p.onDatasetChange(e.target.value)}>
          {p.datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.id === "mock" ? `mock (${d.label})` : d.id}
            </option>
          ))}
        </select>
      </span>
      <span>
        <label htmlFor="task">Task:</label>{" "}
        <select
          id="task"
          value={p.taskId ?? ""}
          disabled={tasks.length === 0}
          onChange={(e) => p.onTaskChange(e.target.value || null)}
        >
          <option value="">(free exploration)</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title ?? t.id}
            </option>
          ))}
        </select>
      </span>
      <label title="Undo/redo in the algebraic model (the traditional models have none)">
        <input type="checkbox" checked={p.undo} onChange={(e) => p.onUndoChange(e.target.checked)} /> Undo
      </label>
      <label title='"Show Selected Only", the "(N not visible)" count and folder badges'>
        <input type="checkbox" checked={p.aids} onChange={(e) => p.onAidsChange(e.target.checked)} /> Selection aids
      </label>
      <span style={{ color: "#999" }}>Changes start with a fresh selection.</span>
      <RecordingStatus recorder={p.recorder} />
    </div>
  );
}
