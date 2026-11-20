import { useSyncExternalStore } from "react";
import type { TelemetryRecorder } from "../telemetry/recorder";

/** Experimenter view of the telemetry session: event count, last save, manual download. */
export function RecordingStatus({ recorder }: { recorder: TelemetryRecorder }) {
  const status = useSyncExternalStore(
    (listener) => recorder.subscribe(listener),
    () => recorder.getStatus(),
  );
  const saved = status.savedAt ? `saved ${status.savedAt.toLocaleTimeString()}` : "not saved yet";
  return (
    <span data-testid="recording-status" style={{ color: status.error ? "#c62828" : "#666" }}>
      ● {recorder.sessionId} · {status.events} events · {status.error ? `save failed (${status.error})` : saved}{" "}
      <button onClick={() => recorder.download()} style={{ fontSize: "12px" }}>
        Save JSON
      </button>
    </span>
  );
}
