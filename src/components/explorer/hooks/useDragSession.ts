import { useCallback, useMemo, useState } from "react";
import type { Point } from "../../../hooks/useSelection";

/** Pointer-drag state in virtual (scroll-independent) coordinates. */
export interface DragSession {
  isDragging: boolean;
  start: Point;
  end: Point;
  begin(p: Point): void;
  moveTo(p: Point): void;
  finish(): void;
}

export function useDragSession(): DragSession {
  const [isDragging, setIsDragging] = useState(false);
  const [start, setStart] = useState<Point>({ x: 0, y: 0 });
  const [end, setEnd] = useState<Point>({ x: 0, y: 0 });

  const begin = useCallback((p: Point) => {
    setStart(p);
    setEnd(p);
    setIsDragging(true);
  }, []);
  const moveTo = useCallback((p: Point) => setEnd(p), []);
  const finish = useCallback(() => setIsDragging(false), []);

  return useMemo(
    () => ({ isDragging, start, end, begin, moveTo, finish }),
    [isDragging, start, end, begin, moveTo, finish],
  );
}
