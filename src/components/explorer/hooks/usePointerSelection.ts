import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import type { Point, SelectionModel } from "../../../hooks/useSelection";
import type { HierarchicalTreeGeometry } from "../../../lib/HierarchicalTreeGeometry";
import type { TreeNode } from "../../../lib/TreeModels";
import type { InteractionSource, ViewMode } from "../layout";
import type { DragSession } from "./useDragSession";
import type { ExplorerVirtualizer } from "./useVirtualLayout";
import { useTelemetry } from "../../../telemetry/context";

interface Options {
  parentRef: RefObject<HTMLDivElement | null>;
  lastInteractionRef: RefObject<InteractionSource>;
  drag: DragSession;
  handlers: SelectionModel<string>["handlers"];
  viewMode: ViewMode;
  treeGeometry: HierarchicalTreeGeometry;
  /** Item under a point in the current view (for telemetry). */
  hitTest: (p: Point) => string | null;
  toggleExpand: (id: string) => void;
  virtualizer: ExplorerVirtualizer;
  /** Opens a folder in the grid view (double-click drill-down). */
  onEnterFolder: (folderId: string) => void;
}

/** Edge zone (px) in which a drag auto-scrolls the viewport, and max speed per frame. */
const AUTOSCROLL_HOTZONE = 40;
const AUTOSCROLL_MAX_STEP = 20;
/**
 * Pointer movement (px) after a press before edge auto-scroll may start. A
 * press that does not move is a click: before this, holding a click on the
 * last rows scrolled the list and extended the lasso over neighbouring items
 * (pilot 1). Same threshold as the "dragged" flag of release events.
 */
const AUTOSCROLL_ARM_DISTANCE = 4;

/**
 * Mouse interaction: click / cmd-click / shift-click on press, drag extension
 * with edge auto-scroll, chevron toggling in the tree, and double-click
 * drill-down in the grid.
 */
export function usePointerSelection({
  parentRef,
  lastInteractionRef,
  drag,
  handlers,
  viewMode,
  treeGeometry,
  hitTest,
  toggleExpand,
  virtualizer,
  onEnterFolder,
}: Options) {
  /** Last pointer position relative to the viewport (not scrolled). */
  const lastMousePosRef = useRef<Point | null>(null);
  /**
   * The item and token of the first of the latest plain clicks on one item,
   * retracted when that item turns out to be double-clicked. This includes a
   * slow double-click (click, pause, double-click on the same folder): the
   * first click selected the folder and cleared everything else, and in a
   * study session that selection was lost for good (no undo).
   */
  const clickRunRef = useRef<{ item: string | null; token: number } | null>(null);
  /** Where the current press started (virtual coordinates), to tell clicks from drags. */
  const pressRef = useRef<Point | null>(null);
  /** True once the pointer has moved far enough from the press to count as a drag. */
  const autoScrollArmedRef = useRef(false);
  const telemetry = useTelemetry();
  const round = (p: Point) => ({ x: Math.round(p.x), y: Math.round(p.y) });
  const { isDragging, begin, moveTo, finish } = drag;

  const onMouseDown = (e: ReactMouseEvent) => {
    if (!parentRef.current) return;
    lastInteractionRef.current = "mouse";

    const rect = parentRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + parentRef.current.scrollTop;
    const p: Point = { x, y };

    if (viewMode === "tree") {
      const meta = treeGeometry.getPointMetadata(p);
      if (meta.isChevron && meta.node?.node.children) {
        e.stopPropagation();
        toggleExpand(meta.node.id);
        return;
      }
    }

    lastMousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    pressRef.current = p;
    autoScrollArmedRef.current = false;
    const item = hitTest(p);
    telemetry.record({
      type: "press",
      ...round(p),
      item,
      modifier: e.shiftKey ? (e.metaKey || e.ctrlKey ? "ctrlShift" : "shift") : e.metaKey || e.ctrlKey ? "ctrl" : "none",
      clickCount: e.detail,
    });
    begin(p);

    if (e.shiftKey || e.metaKey || e.ctrlKey) clickRunRef.current = null;
    if (e.shiftKey && (e.metaKey || e.ctrlKey)) handlers.onCmdShiftClick(p);
    else if (e.shiftKey) handlers.onShiftClick(p);
    else if (e.metaKey || e.ctrlKey) handlers.onCmdClick(p);
    else {
      const token = handlers.onClick(p);
      const run = clickRunRef.current;
      // Further clicks on the same item keep the first one's token.
      if (e.detail <= 1 && (run === null || run.item === null || run.item !== item)) clickRunRef.current = { item, token };
    }
  };

  const onDoubleClickItem = useCallback(
    (node: TreeNode) => {
      telemetry.record({ type: "doubleClick", item: node.id });
      if (!node.children) return;
      // Retract the plain clicks on this folder (the engine never retracts more
      // than its current run of plain clicks, so no other history).
      const run = clickRunRef.current;
      if (run !== null) handlers.onCancelSince(run.token);
      clickRunRef.current = null;
      onEnterFolder(node.id);
      handlers.onCommit();
      virtualizer.scrollToOffset(0);
    },
    [handlers, onEnterFolder, virtualizer, telemetry],
  );

  // Auto-scroll while dragging near the top/bottom edge (both views).
  useEffect(() => {
    if (!isDragging) return;
    let frameId: number;

    const loop = () => {
      const el = parentRef.current;
      if (autoScrollArmedRef.current && lastMousePosRef.current && el) {
        const rect = el.getBoundingClientRect();
        const { x, y } = lastMousePosRef.current;
        let delta = 0;
        if (y > rect.height - AUTOSCROLL_HOTZONE)
          delta = Math.min(AUTOSCROLL_MAX_STEP, y - (rect.height - AUTOSCROLL_HOTZONE));
        else if (y < AUTOSCROLL_HOTZONE) delta = -Math.min(AUTOSCROLL_MAX_STEP, AUTOSCROLL_HOTZONE - y);

        if (delta !== 0) {
          const maxScroll = Math.max(0, virtualizer.getTotalSize() - rect.height);
          const isAtBottom = delta > 0 && el.scrollTop >= maxScroll - 1.5;
          const isAtTop = delta < 0 && el.scrollTop <= 1.5;
          if (!isAtBottom && !isAtTop) el.scrollTop += delta;

          const virtualPoint = { x, y: y + el.scrollTop };
          moveTo(virtualPoint);
          handlers.onDragTo(virtualPoint);
        }
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isDragging, handlers, virtualizer, parentRef, moveTo]);

  // Track the pointer outside the viewport until release.
  useEffect(() => {
    if (!isDragging) return;
    const onGlobalMouseMove = (e: MouseEvent) => {
      const el = parentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportY = e.clientY - rect.top;
      const virtualPoint = { x: e.clientX - rect.left, y: viewportY + el.scrollTop };
      lastMousePosRef.current = { x: e.clientX - rect.left, y: viewportY };
      const start = pressRef.current;
      if (!autoScrollArmedRef.current && start)
        autoScrollArmedRef.current = Math.hypot(virtualPoint.x - start.x, virtualPoint.y - start.y) > AUTOSCROLL_ARM_DISTANCE;
      moveTo(virtualPoint);
      handlers.onDragTo(virtualPoint);
    };
    const onGlobalMouseUp = (e: MouseEvent) => {
      const el = parentRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const p = { x: e.clientX - rect.left, y: e.clientY - rect.top + el.scrollTop };
        const start = pressRef.current ?? p;
        telemetry.record({
          type: "release",
          x: Math.round(p.x),
          y: Math.round(p.y),
          item: hitTest(p),
          dragged: Math.hypot(p.x - start.x, p.y - start.y) > 4,
        });
      }
      pressRef.current = null;
      autoScrollArmedRef.current = false;
      finish();
      lastMousePosRef.current = null;
      handlers.onFlush();
    };

    window.addEventListener("mousemove", onGlobalMouseMove);
    window.addEventListener("mouseup", onGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", onGlobalMouseMove);
      window.removeEventListener("mouseup", onGlobalMouseUp);
    };
  }, [isDragging, handlers, parentRef, moveTo, finish, telemetry, hitTest]);

  return { onMouseDown, onDoubleClickItem };
}
