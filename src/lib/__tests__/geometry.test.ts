/**
 * Tests for the geometry layer: coordinate → identity translation,
 * range/lasso domain computation, and hierarchical navigation.
 * These verify that spatial input resolves to the correct stable IDs —
 * the seam where mouse events meet algebra.
 */
import { describe, it, expect } from "vitest";
import { HierarchicalTreeGeometry, type TreeConfig } from "../HierarchicalTreeGeometry";
import { LogicalGridGeometry } from "../LogicalGridGeometry";
import type { VisibleNode, TreeNode } from "../TreeModels";

// ---------------------------------------------------------------------------
// Tree geometry fixtures
// ---------------------------------------------------------------------------

const mkNode = (id: string, name: string, children?: TreeNode[]): TreeNode => ({
  id,
  name,
  children,
});

// Root-0 (folder)
//   Root-0-0 (folder)
//     leaf-a (file)
//     leaf-b (file)
//   file-0 (file)
// Root-1 (folder)
//   leaf-c (file)
const TREE: TreeNode[] = [
  mkNode("Root-0", "Root-0", [
    mkNode("Root-0-0", "Root-0-0", [
      mkNode("leaf-a", "leaf-a.txt"),
      mkNode("leaf-b", "leaf-b.txt"),
    ]),
    mkNode("file-0", "file-0.txt"),
  ]),
  mkNode("Root-1", "Root-1", [mkNode("leaf-c", "leaf-c.txt")]),
];

function flatten(
  nodes: TreeNode[],
  expandedIds: Set<string>,
): VisibleNode[] {
  const out: VisibleNode[] = [];
  let idx = 0;
  const walk = (ns: TreeNode[], depth: number, parentId: string | null) => {
    for (const n of ns) {
      out.push({ id: n.id, node: n, depth, index: idx++, parentId });
      if (n.children && expandedIds.has(n.id)) walk(n.children, depth + 1, n.id);
    }
  };
  walk(nodes, 0, null);
  return out;
}

const TREE_CFG: TreeConfig = { itemHeight: 32, indentWidth: 24, chevronWidth: 28 };

const EXPANDED = new Set(["Root-0", "Root-0-0"]);
// Visible order: Root-0, Root-0-0, leaf-a, leaf-b, file-0, Root-1
const VISIBLE = flatten(TREE, EXPANDED);

// Depth-aware point helper: places x safely inside the CONTENT zone
// (past indent + chevron) of whatever node occupies that row.
const rowCenter = (row: number) => {
  const depth = VISIBLE[row].depth;
  return { x: depth * 24 + 28 + 10, y: row * 32 + 16 };
};

describe("HierarchicalTreeGeometry", () => {
  const g = new HierarchicalTreeGeometry(TREE_CFG, VISIBLE, []);

  it("m2v maps row coordinates to stable string IDs", () => {
    expect(g.m2v(rowCenter(0))).toBe("Root-0");
    expect(g.m2v({ x: 2 * 24 + 30, y: 2 * 32 + 16 })).toBe("leaf-a");
    expect(g.m2v(rowCenter(4))).toBe("file-0");
  });

  it("m2v returns null for chevron hits and out-of-bounds points", () => {
    // Chevron zone of row 0: x in [depth*indent, depth*indent+chevronWidth]
    expect(g.m2v({ x: 14, y: 16 })).toBeNull();
    expect(g.m2v({ x: -5, y: 16 })).toBeNull();
    expect(g.m2v({ x: 34, y: 99999 })).toBeNull();
  });

  it("getPointMetadata flags chevrons only on folder rows", () => {
    const folderRow = g.getPointMetadata({ x: 14, y: 16 });
    expect(folderRow.isChevron).toBe(true);

    // Row 3 (leaf-b): no children, but still inside indent zone
    const leafMeta = g.getPointMetadata({
      x: 2 * 24 + 5,
      y: 3 * 32 + 16,
    });
    expect(leafMeta.node?.id).toBe("leaf-b");
  });

  it("selectionDomain spans anchor→end rows regardless of direction", () => {
    const down = g.selectionDomain([rowCenter(1), rowCenter(3)]);
    expect([...down].sort()).toEqual(["Root-0-0", "leaf-a", "leaf-b"].sort());

    const up = g.selectionDomain([rowCenter(3), rowCenter(1)]);
    expect([...up].sort()).toEqual(["Root-0-0", "leaf-a", "leaf-b"].sort());
  });

  it("step navigates hierarchically: LEFT to parent, DOWN linearly", () => {
    // From leaf-a (row 2), LEFT should land on parent Root-0-0 (row 1)
    const parentPt = g.step("LEFT", { x: 58, y: 2 * 32 + 16 });
    const meta = g.getPointMetadata(parentPt);
    expect(meta.node?.id).toBe("Root-0-0");

    // DOWN from Root-0 goes to Root-0-0
    const downPt = g.step("DOWN", rowCenter(0));
    expect(g.getPointMetadata(downPt).node?.id).toBe("Root-0-0");
  });

  it("a path anchored below the last row starts at the last row (revision 22)", () => {
    const below = { x: 200, y: VISIBLE.length * 32 + 20 };
    expect(g.m2v(below)).toBeNull(); // a click there is still a click in blank space
    expect(g.selectionDomain([below, rowCenter(2)]).size).toBe(0); // and spans nothing by itself
    const path = g.extendPath([below], rowCenter(2))!;
    expect(g.m2v(path[0])).toBe(VISIBLE.at(-1)!.id);
    const ids = VISIBLE.slice(2).map((n) => n.id);
    expect([...g.selectionDomain(path)].sort()).toEqual([...ids].sort());
    // A blank anchor elsewhere (left of the rows) is unchanged
    expect(g.extendPath([{ x: -1, y: 40 }], rowCenter(2))![0]).toEqual({ x: -1, y: 40 });
  });

  it("selectionDomain returns empty for invalid anchors", () => {
    expect(g.selectionDomain([]).size).toBe(0);
    expect(g.selectionDomain([{ x: -1, y: -1 }, rowCenter(1)]).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Grid geometry fixtures
// ---------------------------------------------------------------------------

const GRID_ITEMS = Array.from({ length: 25 }, (_, i) => ({ id: `g-${i}` }));
const gridCfg = {
  itemWidth: 120,
  itemHeight: 100,
  containerWidth: 480, // exactly 4 columns
  totalItems: 25,
};

describe("LogicalGridGeometry", () => {
  const rect = new LogicalGridGeometry(gridCfg, GRID_ITEMS, GRID_ITEMS, "rectangular");
  const roww = new LogicalGridGeometry(gridCfg, GRID_ITEMS, GRID_ITEMS, "rowwise");

  it("maps 2D points to IDs across column boundaries", () => {
    // Column count = 4. Item 6 is at col 2, row 1.
    expect(rect.getPointMetadata({ x: 2 * 120 + 60, y: 100 + 50 }).id).toBe("g-6");
    // Last item (24) is at col 0, row 6.
    expect(rect.getPointMetadata({ x: 60, y: 6 * 100 + 50 }).id).toBe("g-24");
  });

  it("padding gutters resolve to null (no accidental selection)", () => {
    const meta = rect.getPointMetadata({ x: 2, y: 102 }); // inside padding margin
    expect(meta.id).toBeNull();
  });

  it("rectangular strategy selects a full box of cells", () => {
    // Anchor center of g-0 (col 0,row 0), drag to center of g-5 (col 1,row 1)
    const dom = rect.selectionDomain([{ x: 60, y: 50 }, { x: 180, y: 150 }], undefined, {});
    expect(dom.size).toBe(4); // g-0,g-1,g-4,g-5
    expect(dom.has("g-0")).toBe(true);
    expect(dom.has("g-5")).toBe(true);
    expect(dom.has("g-2")).toBe(false);
  });

  it("rowwise strategy projects to 1D index ranges", () => {
    // Anchor g-0, end g-6 → indices 0..6
    const dom = roww.selectionDomain([{ x: 60, y: 50 }, { x: 300, y: 150 }], undefined, {});
    expect(dom.size).toBe(7);
    expect(dom.has("g-6")).toBe(true);
    expect(dom.has("g-7")).toBe(false);
  });

  it("mixed mode picks rowwise when anchor lands on an item", () => {
    const mixed = new LogicalGridGeometry(gridCfg, GRID_ITEMS, GRID_ITEMS, "mixed");
    const cache: any = {};
    const dom = mixed.selectionDomain(
      [{ x: 60, y: 50 }, { x: 300, y: 250 }],
      undefined,
      cache,
    );
    expect(cache.activeStrategyName).toBe("rowwise");
    // 1D range from index 0 → anchor row 2 end ⇒ indices 0..10
    expect(dom.size).toBe(11);
  });

  it("mixed mode picks rectangular when anchor lands in empty space", () => {
    const mixed = new LogicalGridGeometry(gridCfg, GRID_ITEMS, GRID_ITEMS, "mixed");
    const cache: any = {};
    // Anchor below all items (empty space past the last row)
    mixed.selectionDomain(
      [{ x: 60, y: 900 }, { x: 300, y: 950 }],
      undefined,
      cache,
    );
    expect(cache.activeStrategyName).toBe("rectangular");
  });

  it("keyboard step moves by columns and clamps at bounds", () => {
    // From center of g-0: RIGHT → g-1, DOWN → g-4
    expect(
      rect.getPointMetadata(rect.step("RIGHT", { x: 60, y: 50 })).id,
    ).toBe("g-1");
    expect(
      rect.getPointMetadata(rect.step("DOWN", { x: 60, y: 50 })).id,
    ).toBe("g-4");
    // Clamp: UP from g-0 stays at g-0
    expect(
      rect.getPointMetadata(rect.step("UP", { x: 60, y: 50 })).id,
    ).toBe("g-0");
  });

  it("filter searches the global pool, not just visible items", () => {
    // Pass a subset as 'items' but full set as allNodesFlat:
    const partial = new LogicalGridGeometry(
      { ...gridCfg, totalItems: 2 },
      GRID_ITEMS.slice(0, 2),
      GRID_ITEMS,
    );
    const res = partial.filter((n: any) => n.id === "g-20");
    expect(res.has("g-20")).toBe(true); // found outside visible window
  });
});

// ---------------------------------------------------------------------------
// Keyboard jumps: Home / End / PageUp / PageDown
// ---------------------------------------------------------------------------

describe("jump steps", () => {
  it("tree: HOME/END go to the first/last visible row; PAGE moves by pageRows", () => {
    const g = new HierarchicalTreeGeometry({ ...TREE_CFG, pageRows: 2 }, VISIBLE, []);
    const id = (p: { x: number; y: number }) => g.getPointMetadata(p).node?.id;
    // Visible order: Root-0, Root-0-0, leaf-a, leaf-b, file-0, Root-1
    expect(id(g.step("HOME", rowCenter(3)))).toBe("Root-0");
    expect(id(g.step("END", rowCenter(1)))).toBe("Root-1");
    expect(id(g.step("PAGEDOWN", rowCenter(1)))).toBe("leaf-b");
    expect(id(g.step("PAGEUP", rowCenter(1)))).toBe("Root-0"); // clamped
    expect(id(g.step("PAGEDOWN", rowCenter(5)))).toBe("Root-1"); // clamped
  });

  it("grid: HOME/END go to the first/last item; PAGE moves by pageRows × columns", () => {
    const g = new LogicalGridGeometry({ ...gridCfg, pageRows: 2 }, GRID_ITEMS, GRID_ITEMS);
    const at = (i: number) => ({ x: (i % 4) * 120 + 60, y: Math.floor(i / 4) * 100 + 50 });
    const id = (p: { x: number; y: number }) => g.getPointMetadata(p).id;
    expect(id(g.step("HOME", at(9)))).toBe("g-0");
    expect(id(g.step("END", at(9)))).toBe("g-24");
    expect(id(g.step("PAGEDOWN", at(1)))).toBe("g-9"); // 1 + 2 rows × 4 cols
    expect(id(g.step("PAGEUP", at(9)))).toBe("g-1");
    expect(id(g.step("PAGEDOWN", at(22)))).toBe("g-24"); // clamped
  });
});

// ---------------------------------------------------------------------------
// Default keyboard cursor (used when a navigation key is pressed with no cursor)
// ---------------------------------------------------------------------------

describe("default keyboard cursor", () => {
  it("tree: the last row for Up and End, else the first; none when the list is empty", () => {
    const g = new HierarchicalTreeGeometry(TREE_CFG, VISIBLE, []);
    const id = (dir: string) => g.getPointMetadata(g.defaultCursor(dir)!).node?.id;
    expect(["DOWN", "RIGHT", "HOME", "PAGEDOWN"].map(id)).toEqual(["Root-0", "Root-0", "Root-0", "Root-0"]);
    expect(["UP", "END"].map(id)).toEqual(["Root-1", "Root-1"]);
    expect(new HierarchicalTreeGeometry(TREE_CFG, [], []).defaultCursor("DOWN")).toBeUndefined();
  });

  it("grid: the last item for Up and End, else the first; none when the grid is empty", () => {
    const g = new LogicalGridGeometry(gridCfg, GRID_ITEMS, GRID_ITEMS);
    const id = (dir: string) => g.m2v(g.defaultCursor(dir)!);
    expect(["DOWN", "RIGHT", "HOME", "PAGEDOWN"].map(id)).toEqual(["g-0", "g-0", "g-0", "g-0"]);
    expect(["UP", "END"].map(id)).toEqual(["g-24", "g-24"]);
    // Regression: an empty grid (filter with no matches) had a default cursor, so an
    // arrow key clicked "nothing" and cleared the selection, hidden items included.
    const empty = new LogicalGridGeometry({ ...gridCfg, totalItems: 0 }, [], GRID_ITEMS);
    expect(["DOWN", "UP", "END"].map((d) => empty.defaultCursor(d))).toEqual([undefined, undefined, undefined]);
  });
});
