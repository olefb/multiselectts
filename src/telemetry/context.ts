import { createContext, useContext } from "react";
import { NO_TELEMETRY, type TelemetryRecorder } from "./recorder";

/** The session's recorder; explorer components record through it. */
export const TelemetryContext = createContext<TelemetryRecorder>(NO_TELEMETRY);

export const useTelemetry = () => useContext(TelemetryContext);
