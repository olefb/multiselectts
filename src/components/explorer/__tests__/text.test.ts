import { describe, expect, it } from "vitest";
import { EXPLORER_TEXT } from "../text";

describe("hidden-by-search note", () => {
  it("counts the selected files a search hides, singular and plural", () => {
    expect(EXPLORER_TEXT.en.hiddenBySearch(8)).toBe("8 selected files are hidden by the search but still selected.");
    expect(EXPLORER_TEXT.en.hiddenBySearch(1)).toBe("1 selected file is hidden by the search but still selected.");
    expect(EXPLORER_TEXT.nb.hiddenBySearch(8)).toBe("8 merkede filer er skjult av søket, men fortsatt merket.");
    expect(EXPLORER_TEXT.nb.hiddenBySearch(1)).toBe("1 merket fil er skjult av søket, men fortsatt merket.");
  });
});

describe("match note (Select / Deselect matching)", () => {
  it("gives the count when every changed file is on screen", () => {
    expect(EXPLORER_TEXT.en.matchNote("select", 4, [], 0)).toBe("4 selected");
    expect(EXPLORER_TEXT.nb.matchNote("deselect", 4, [], 0)).toBe("4 fjernet fra merkingen");
  });

  it("names the first file that is not on screen, after the count", () => {
    expect(EXPLORER_TEXT.en.matchNote("select", 7, ["old_report.docx (Archive)"], 1)).toBe("7 selected, 1 not visible: old_report.docx (Archive)");
    expect(EXPLORER_TEXT.nb.matchNote("deselect", 4, ["a.pdf (Research)"], 1)).toBe("4 fjernet fra merkingen, 1 ikke synlig: a.pdf (Research)");
    expect(EXPLORER_TEXT.nb.matchNote("deselect", 4, ["a.pdf (Research)"], 3)).toBe("4 fjernet fra merkingen, 3 ikke synlige: a.pdf (Research) …");
  });

  it("says to press Enter while the preview is live, without file names (revision 23)", () => {
    expect(EXPLORER_TEXT.en.matchNote("select", 14, [], 0, "live")).toBe("14 selected – press Enter to keep");
    expect(EXPLORER_TEXT.nb.matchNote("select", 7, ["old_report.docx (Archive)"], 1, "live")).toBe("7 merket – trykk Enter for å beholde");
    expect(EXPLORER_TEXT.nb.matchNote("deselect", 4, [], 0, "live")).toBe("4 fjernet fra merkingen – trykk Enter for å beholde");
    // After Enter: the note as before
    expect(EXPLORER_TEXT.en.matchNote("select", 7, ["old_report.docx (Archive)"], 1, "kept")).toBe("7 selected, 1 not visible: old_report.docx (Archive)");
  });
});
