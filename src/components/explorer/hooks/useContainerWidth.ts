import { useEffect, useState, type RefObject } from "react";

/** Width of an element, kept current with a ResizeObserver. */
export function useContainerWidth(ref: RefObject<HTMLElement | null>, initial = 800): number {
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    if (ref.current) setWidth(ref.current.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setWidth(entries[0].contentRect.width);
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
