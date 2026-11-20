import { useEffect, type RefObject } from "react";
import { useTelemetry } from "./context";
import { throttle } from "./recorder";

/** Pointer samples per second while the pointer is over the list (or dragging). */
const MOVE_HZ = 20;
/** Scroll samples per second. */
const SCROLL_HZ = 10;

/**
 * Samples the pointer position (over the list, or anywhere while dragging) and
 * the list's scroll offset, in content coordinates. For path length and idle
 * time in the analysis; gestures are logged separately.
 */
export function usePointerTrace(viewportRef: RefObject<HTMLElement | null>, dragging: boolean) {
  const telemetry = useTelemetry();

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onMove = throttle((e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside && !dragging) return;
      telemetry.record({
        type: "move",
        x: Math.round(e.clientX - rect.left),
        y: Math.round(e.clientY - rect.top + el.scrollTop),
        dragging,
      });
    }, 1000 / MOVE_HZ);
    const onScroll = throttle(() => telemetry.record({ type: "scroll", top: Math.round(el.scrollTop) }), 1000 / SCROLL_HZ);
    window.addEventListener("mousemove", onMove);
    el.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("mousemove", onMove);
      el.removeEventListener("scroll", onScroll);
    };
  }, [viewportRef, dragging, telemetry]);
}
