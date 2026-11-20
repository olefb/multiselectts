import { describe, expect, it } from "vitest";
import { fileType } from "../fileTypes";
import { DATASETS } from "../../../data/datasets";
import { STUDY } from "../../../study/config";

describe("fileType", () => {
  it("maps extensions to labels, ignoring case", () => {
    expect(fileType("results_2024_v1.pdf").label).toBe("PDF");
    expect(fileType("NOTES.TXT").label).toBe("TXT");
    expect(fileType("report_march (copy).docx").label).toBe("DOC");
    expect(fileType("budget_2025.xlsx").label).toBe("XLS");
    expect(fileType("README.md").label).toBe("MD");
  });

  it("falls back to the extension, or FILE without one", () => {
    expect(fileType("archive.zip")).toEqual({ label: "ZIP", color: "#9ca3af" });
    expect(fileType("Makefile").label).toBe("FILE");
    expect(fileType(".hidden").label).toBe("FILE");
  });

  it("gives every file type in the study datasets its own icon (no grey fallback)", () => {
    for (const key of ["D1", "D2"] as const) {
      const d = DATASETS.get(STUDY.datasets[key])!;
      for (const n of d.flat) if (!n.children && !n.thumbnail) expect(fileType(n.name).color, n.id).not.toBe("#9ca3af");
    }
  });
});
