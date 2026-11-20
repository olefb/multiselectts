/**
 * Dataset loading: ID assignment, validation, and integrity of the bundled
 * task folders (every thumbnail file must exist, so a broken dataset fails
 * here instead of showing broken images in a study session).
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { breadcrumbTrail, datasetFromFile, type DatasetFile } from "../dataset";
import { DATASETS, MOCK_DATASET, datasetOrMock } from "../datasets";

const FILE: DatasetFile = {
  id: "t",
  tree: [
    {
      name: "Photos",
      children: [
        { name: "Trip", children: [{ name: "IMG_1.jpg", thumbnail: "datasets/t/1.webp", tags: ["cat"], size: "2.0 MB" }] },
        { name: "IMG_2.jpg", modified: "2025-06-01" },
      ],
    },
    { name: "notes.txt" },
  ],
};

describe("datasetFromFile", () => {
  const d = datasetFromFile(FILE);

  it("assigns path IDs and keeps metadata", () => {
    expect(d.ids).toEqual(["Photos", "Photos/Trip", "Photos/Trip/IMG_1.jpg", "Photos/IMG_2.jpg", "notes.txt"]);
    const img = d.byId.get("Photos/Trip/IMG_1.jpg")!;
    expect(img).toMatchObject({ name: "IMG_1.jpg", thumbnail: "datasets/t/1.webp", tags: ["cat"], size: "2.0 MB" });
    expect(img.children).toBeUndefined(); // a file
    expect(d.byId.get("Photos/Trip")!.children).toHaveLength(1); // a folder
    expect(d.flat).toHaveLength(d.byId.size);
  });

  it("builds breadcrumb trails", () => {
    expect(breadcrumbTrail(d, "Photos/Trip").map((n) => n.name)).toEqual(["Photos", "Trip"]);
    expect(breadcrumbTrail(d, null)).toEqual([]);
  });

  it("rejects duplicate names in a folder, missing names and slashes", () => {
    const dup: DatasetFile = { id: "x", tree: [{ name: "a" }, { name: "a" }] };
    expect(() => datasetFromFile(dup)).toThrow(/duplicate name "a"/);
    expect(() => datasetFromFile({ id: "x", tree: [{ name: "" }] })).toThrow(/without a name/);
    expect(() => datasetFromFile({ id: "x", tree: [{ name: "a/b" }] })).toThrow(/not allowed/);
    // Same name in different folders is fine (different paths).
    expect(() => datasetFromFile({ id: "x", tree: [{ name: "a", children: [{ name: "a" }] }] })).not.toThrow();
  });
});

describe("bundled datasets", () => {
  it("include the mock tree and fall back to it for unknown IDs", () => {
    expect(DATASETS.get("mock")).toBe(MOCK_DATASET);
    expect(datasetOrMock("no-such-dataset")).toBe(MOCK_DATASET);
    expect(datasetOrMock(null)).toBe(MOCK_DATASET);
  });

  it.each([...DATASETS.values()].filter((d) => d.id !== "mock").map((d) => [d.id, d] as const))(
    "%s: every thumbnail exists in public/",
    (_id, d) => {
      const missing = d.flat.filter((n) => n.thumbnail && !existsSync(join(process.cwd(), "public", n.thumbnail)));
      expect(missing.map((n) => n.thumbnail)).toEqual([]);
    },
  );

  it("pets-demo has the shape the tasks rely on", () => {
    const d = datasetOrMock("pets-demo");
    expect(d.id).toBe("pets-demo");
    const tagged = (tag: string, under: string) =>
      d.flat.filter((n) => n.id.startsWith(under + "/") && n.tags?.includes(tag)).length;
    expect(tagged("cat", "Photos")).toBe(8);
    expect(tagged("dog", "Photos")).toBe(28);
    expect(tagged("cat", "Photos/Summer 2025")).toBe(0); // only dogs (revision 17)
    expect(tagged("pdf", "Research")).toBe(14);
    expect(tagged("draft", "Research")).toBe(4);
    expect(tagged("readme", "Research")).toBe(2);
    expect(d.byId.get("Research")!.children).toHaveLength(30);
    // Camera-style names: the file name never gives the content away.
    expect(d.flat.filter((n) => n.tags?.some((t) => t === "cat" || t === "dog")).every((n) => /^IMG_\d+\.jpg$/.test(n.name))).toBe(true);
  });
});
