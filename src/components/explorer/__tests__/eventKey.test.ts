import { describe, expect, it } from "vitest";
import { eventKey } from "../hooks/useKeyboardSelection";

describe("eventKey", () => {
  it("returns the reported key when there is one", () => {
    expect(eventKey({ key: " ", code: "Space" })).toBe(" ");
    expect(eventKey({ key: "a", code: "KeyQ" })).toBe("a"); // layout, not position
    expect(eventKey({ key: "ArrowDown", code: "ArrowDown" })).toBe("ArrowDown");
  });

  it("falls back to the physical key for \"Unidentified\" (Chromium on Linux)", () => {
    expect(eventKey({ key: "Unidentified", code: "Space" })).toBe(" ");
    expect(eventKey({ key: "Unidentified", code: "KeyA" })).toBe("a");
    expect(eventKey({ key: "Unidentified", code: "F13" })).toBe("Unidentified");
  });
});
