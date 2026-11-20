import { useEffect, type RefObject } from "react";
import type { Point, SelectionModel } from "../../../hooks/useSelection";
import type { SelectionGeometry } from "../../../lib/multiselect";
import type { TreeNode } from "../../../lib/TreeModels";
import type { InteractionSource, ViewMode } from "../layout";
import type { ExplorerVirtualizer } from "./useVirtualLayout";
import { useTelemetry } from "../../../telemetry/context";
import type { KeyCommand } from "../../../telemetry/schema";

/** Explorer-level commands the keyboard can trigger (same code paths as the buttons). */
export interface KeyboardCommands {
  /** Ctrl+A — like the Select All button. */
  selectAll(): void;
  /** Ctrl+I — invert the selection of the visible items. */
  invertVisible(): void;
  /** Esc — discard a live search preview, otherwise deselect all. */
  escape(): void;
  /** Ctrl+F — focus the search box. */
  focusSearch(): void;
  /** Enter in the grid — open a folder (like double-click). */
  openFolder(id: string): void;
  /** Backspace / Alt+↑ in the grid — go to the parent folder. */
  goUp(): void;
}

interface Options {
  parentRef: RefObject<HTMLDivElement | null>;
  lastInteractionRef: RefObject<InteractionSource>;
  handlers: SelectionModel<string>["handlers"];
  commands: KeyboardCommands;
  /** Node lookup of the current dataset (folder checks for Enter / tree arrows). */
  nodeById: ReadonlyMap<string, TreeNode>;
  cursorId: string | null;
  viewMode: ViewMode;
  expandedIds: ReadonlySet<string>;
  toggleExpand: (id: string) => void;
  activeGeometry: SelectionGeometry<string, Point>;
  virtualizer: ExplorerVirtualizer;
  isDragging: boolean;
}

const isFormField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Cursor-moving keys and the direction name the geometries understand. */
const NAVIGATION_KEYS: Record<string, string> = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  Home: "HOME",
  End: "END",
  PageUp: "PAGEUP",
  PageDown: "PAGEDOWN",
};

/**
 * The key of a keydown event. Chromium on Linux can report Ctrl+Space (and other
 * Ctrl combinations, depending on the keyboard layout and input method) as
 * key "Unidentified" (Helium, 2026-10-16); the physical key (code) is then used.
 */
export function eventKey(e: Pick<KeyboardEvent, "key" | "code">): string {
  if (e.key !== "Unidentified") return e.key;
  if (e.code === "Space") return " ";
  const letter = /^Key([A-Z])$/.exec(e.code);
  return letter ? letter[1].toLowerCase() : e.key;
}

/**
 * Keyboard interaction. Navigation keys (arrows, Home/End, PageUp/PageDown)
 * move and select; Shift extends the range; Ctrl/Cmd moves the cursor only.
 * See ShortcutHelp for the full list.
 */
export function useKeyboardSelection({
  parentRef,
  lastInteractionRef,
  handlers,
  commands,
  nodeById,
  cursorId,
  viewMode,
  expandedIds,
  toggleExpand,
  activeGeometry,
  virtualizer,
  isDragging,
}: Options) {
  const telemetry = useTelemetry();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;
      const pressed = eventKey(e);
      const key = pressed.length === 1 ? pressed.toLowerCase() : pressed;
      const log = (command: KeyCommand) =>
        telemetry.record({ type: "key", key: pressed, ctrl, shift, alt: e.altKey, command });

      // Ctrl+F works from anywhere, including the search box itself.
      if (ctrl && !shift && key === "f") {
        e.preventDefault();
        log("search");
        commands.focusSearch();
        return;
      }
      // Leave other keys typed into form fields alone (search box, dropdowns):
      // arrows move the caret / option there, Ctrl+A selects text, Ctrl+Z undoes typing.
      if (isFormField(e.target)) return;

      if (ctrl && key === "z") {
        e.preventDefault();
        log(shift ? "redo" : "undo");
        if (shift) handlers.redo();
        else handlers.undo();
        return;
      }
      if (ctrl && !shift && key === "a") {
        e.preventDefault();
        log("selectAll");
        commands.selectAll();
        return;
      }
      if (ctrl && !shift && key === "i") {
        e.preventDefault();
        log("invert");
        commands.invertVisible();
        return;
      }
      if (key === "Escape") {
        log("escape");
        commands.escape();
        return;
      }
      if (viewMode === "grid" && (key === "Backspace" || (e.altKey && key === "ArrowUp"))) {
        e.preventDefault();
        log("up");
        commands.goUp();
        return;
      }
      if (key === "Enter" && cursorId !== null && nodeById.get(cursorId)?.children) {
        e.preventDefault();
        log(viewMode === "grid" ? "open" : "expand");
        if (viewMode === "grid") commands.openFolder(cursorId);
        else toggleExpand(cursorId);
        return;
      }

      const direction = NAVIGATION_KEYS[key];
      if (direction) {
        e.preventDefault();
        lastInteractionRef.current = "keyboard";

        // Tree: Right expands / Left collapses a folder before moving.
        if (viewMode === "tree" && (direction === "RIGHT" || direction === "LEFT") && cursorId !== null) {
          const node = nodeById.get(cursorId);
          if (node?.children) {
            const isExp = expandedIds.has(cursorId);
            if ((direction === "RIGHT" && !isExp) || (direction === "LEFT" && isExp)) {
              log("expand");
              toggleExpand(cursorId);
              return;
            }
          }
        }

        log(shift ? "extend" : ctrl ? "moveCursor" : "move");
        if (shift) handlers.onShiftArrow(direction);
        else if (ctrl) handlers.onCmdArrow(direction);
        else handlers.onArrow(direction);
        return;
      }

      if (key === " ") {
        e.preventDefault();
        lastInteractionRef.current = "keyboard";
        log(ctrl ? "toggle" : "select");
        handlers.onSpace(ctrl);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers, commands, nodeById, cursorId, viewMode, expandedIds, toggleExpand, lastInteractionRef, telemetry]);

  // Keep the cursor in view, but only for keyboard navigation: programmatic
  // scrolling during mouse use (manual scroll, lasso) would snap the view.
  useEffect(() => {
    if (cursorId === null || !parentRef.current || isDragging || lastInteractionRef.current === "mouse") {
      return;
    }
    const targetRow = activeGeometry.rowOf(cursorId);
    if (targetRow !== null) virtualizer.scrollToIndex(targetRow, { align: "auto" });
  }, [cursorId, virtualizer, activeGeometry, isDragging, parentRef, lastInteractionRef]);
}
