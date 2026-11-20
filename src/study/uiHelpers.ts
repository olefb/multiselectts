// File: study/uiHelpers.ts
// Non-component helpers of the study screens.

import { createContext, useContext, useEffect, useState, type CSSProperties } from "react";
import { STUDY } from "./config";

/**
 * How long a screen's answer buttons stay inactive after they appear
 * (STUDY.screenGuardMs; `&guard=0` in tests). Stops a fast double-click from
 * carrying over to the next screen (pilot 1), without a visible countdown.
 */
export const ScreenGuardContext = createContext<number>(STUDY.screenGuardMs);

/** False for the first `ScreenGuardContext` ms after mount. */
export function useArmed(): boolean {
  const ms = useContext(ScreenGuardContext);
  const [armed, setArmed] = useState(ms <= 0);
  useEffect(() => {
    if (ms <= 0) return;
    const timer = setTimeout(() => setArmed(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return armed;
}

export const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#f4f5f7",
  color: "#1d1d1f",
  fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
  colorScheme: "light",
  textAlign: "left",
};

/** True once `deadline` (Date.now() ms) has passed; false while it is null. */
export function useDeadline(deadline: number | null): boolean {
  const [reachedFor, setReachedFor] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === null) return;
    const timer = setTimeout(() => setReachedFor(deadline), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [deadline]);
  return deadline !== null && reachedFor === deadline;
}
