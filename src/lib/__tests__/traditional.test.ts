/**
 * Tests for the traditional baseline (TraditionalSelection) and its presets.
 *
 * Each semantic option is tested in both presets, and a parity property
 * checks that on the gestures where desktop file managers and the algebra
 * agree (click, cmd-click, arrows, plain drags, Select/Deselect All, view
 * re-projection), all three models produce identical selections.
 */
import { describe, expect, it } from "vitest";
import { SelectionState, ff, not, tt } from "../multiselect";
import type { SelectionEngine } from "../SelectionEngine";
import type { SelectionGeometry } from "../multiselect";
import { LogicalGridGeometry } from "../LogicalGridGeometry";
import {
  TRADITIONAL_PRESETS,
  TraditionalSelection,
  type TraditionalOptions,
  type TraditionalPreset,
} from "../TraditionalSelection";
import { ListGeometry, row, type P } from "./support/listGeometry";

const ABCDEF = ["A", "B", "C", "D", "E", "F"];

const make = (preset: TraditionalPreset | TraditionalOptions, geom: SelectionGeometry<string, P> = new ListGeometry(ABCDEF)) => {
  const opts = typeof preset === "string" ? TRADITIONAL_PRESETS[preset] : preset;
  return new TraditionalSelection<string, P>(geom, () => {}, { ...opts, scheduleFlush: () => {} });
};
const sel = (s: SelectionEngine<string, P>) => {
  s.flush();
  return [...s.selected].sort().join(",");
};

describe.each(["windows", "mac"] as const)("shared behaviour (%s)", (preset) => {
  it("click selects only the item under the pointer", () => {
    const s = make(preset);
    s.click(row(0));
    s.click(row(2));
    expect(sel(s)).toBe("C");
  });

  it("click in empty space clears but keeps the range anchor", () => {
    const s = make(preset);
    s.click(row(1));
    s.click(row(-1));
    expect(sel(s)).toBe("");
    s.shiftClick(row(3));
    expect(sel(s)).toBe("B,C,D");
  });

  it("cmd-click toggles", () => {
    const s = make(preset);
    s.click(row(0));
    s.cmdClick(row(2));
    s.cmdClick(row(0));
    expect(sel(s)).toBe("C");
  });

  it("a drag after a plain click replaces the selection with the range", () => {
    const s = make(preset);
    s.click(row(5));
    s.click(row(1));
    s.dragTo(row(3));
    expect(sel(s)).toBe("B,C,D");
    s.dragTo(row(2)); // retracting shrinks the range
    expect(sel(s)).toBe("B,C");
  });

  it("repeated shift-clicks adjust the range around the same anchor", () => {
    const s = make(preset);
    s.click(row(1));
    s.shiftClick(row(4));
    expect(sel(s)).toBe("B,C,D,E");
    s.shiftClick(row(2));
    expect(sel(s)).toBe("B,C");
  });

  it("shift+arrow grows a range from the anchor", () => {
    const s = make(preset);
    s.click(row(1));
    s.shiftArrow("DOWN");
    s.shiftArrow("DOWN");
    expect(sel(s)).toBe("B,C,D");
  });

  it("has no selection history", () => {
    const s = make(preset);
    s.click(row(0));
    s.click(row(1));
    s.undo();
    expect(sel(s)).toBe("B");
    expect(s.undoDepth).toBe(0);
    expect(s.capabilities).toEqual({ undo: false, predicate: false, clickScope: false });
  });

  it("switching views keeps the selection and the range anchor", () => {
    const s = make(preset);
    s.click(row(0));
    s.cmdClick(row(2));
    s.contextChanged("view");
    expect(sel(s)).toBe("A,C");
    s.shiftClick(row(3)); // range still anchored at C
    expect(sel(s)).toContain("C,D");
  });

  it("filtering and navigation each clear the selection", () => {
    for (const change of ["filter", "navigate"] as const) {
      const s = make(preset);
      s.click(row(0));
      s.cmdClick(row(2));
      s.contextChanged(change);
      expect(sel(s), change).toBe("");
      // The range anchor is gone too: shift-click starts a fresh range at the pointer.
      s.shiftClick(row(3));
      expect(sel(s), change).toBe("D");
    }
  });

  it("clearOn is configurable", () => {
    const s = make({ ...TRADITIONAL_PRESETS[preset], clearOn: ["view"] });
    s.click(row(0));
    s.contextChanged("filter");
    expect(sel(s)).toBe("A");
    s.contextChanged("view");
    expect(sel(s)).toBe("");
  });

  it("cancelSince restores the selection from before the click", () => {
    const s = make(preset);
    s.click(row(0));
    s.cmdClick(row(1));
    const token = s.click(row(4));
    s.click(row(4)); // second click of the double-click
    s.cancelSince(token);
    expect(sel(s)).toBe("A,B");
  });

  it("cancelSince is refused once another gesture has happened", () => {
    const s = make(preset);
    const token = s.click(row(0));
    s.cmdClick(row(1));
    s.cancelSince(token);
    expect(sel(s)).toBe("A,B");
  });

  it("a slow double-click (click, pause, double-click) retracts the earlier click too", () => {
    const s = make(preset);
    s.click(row(0));
    s.cmdClick(row(1));
    const token = s.click(row(4)); // the single click before the pause
    s.click(row(4)); // the double-click's two clicks
    s.click(row(4));
    s.cancelSince(token);
    expect(sel(s)).toBe("A,B");
  });

  it("a token from before the current run of clicks retracts that run only", () => {
    const s = make(preset);
    const token = s.click(row(0));
    s.cmdClick(row(1)); // ends the run
    s.click(row(3));
    s.click(row(3));
    s.cancelSince(token);
    expect(sel(s)).toBe("A,B");
  });

  it("Select All / Deselect All", () => {
    const s = make(preset);
    s.apply(tt, ABCDEF);
    expect(sel(s)).toBe("A,B,C,D,E,F");
    s.apply(ff, ["B", "C"]);
    expect(sel(s)).toBe("A,D,E,F");
  });

  it("anchor follows its item when rows are inserted above it", () => {
    const s = make(preset);
    s.click(row(2)); // C
    s.setGeometry(new ListGeometry(["A", "X1", "X2", "B", "C", "D", "E", "F"]));
    s.shiftClick(row(5)); // D in the new layout
    expect(sel(s)).toBe("C,D");
  });

  it("the active domain is the current gesture's domain", () => {
    const s = make(preset);
    s.click(row(1));
    s.dragTo(row(2));
    s.flush();
    expect([...s.activeIndices].sort()).toEqual(["B", "C"]);
    s.commit();
    expect(s.activeIndices.size).toBe(0);
  });
});

describe("where the presets differ", () => {
  it("shift-click: Windows replaces, Finder extends", () => {
    for (const [preset, expected] of [
      ["windows", "C,D,E"],
      ["mac", "A,C,D,E"],
    ] as const) {
      const s = make(preset);
      s.click(row(0));
      s.cmdClick(row(2)); // anchor moves to C
      s.shiftClick(row(4));
      expect(sel(s), preset).toBe(expected);
    }
  });

  it("Finder: a run of shift-clicks extends the selection from before the run", () => {
    const s = make("mac");
    s.click(row(0));
    s.cmdClick(row(2));
    s.shiftClick(row(4));
    s.shiftClick(row(3));
    expect(sel(s)).toBe("A,C,D"); // not A,C,D,E
  });

  // Finder, 2026-10-16 (verification test 4): Cmd-drag over a mix toggles, and pulling
  // the rectangle back restores the selection, as in Explorer.
  it("ctrl/cmd-drag: both presets toggle; the \"add\" option adds", () => {
    for (const [preset, expected, pulledBack] of [
      ["windows", "A,C,D", "A"],
      ["mac", "A,C,D", "A"],
      [{ ...TRADITIONAL_PRESETS.mac, modifierDrag: "add" } as TraditionalOptions, "A,B,C,D", "A,B"],
    ] as const) {
      const s = make(preset);
      s.click(row(0));
      s.cmdClick(row(1)); // A, B
      s.cmdClick(row(1)); // press on B again (deselects it) ...
      s.dragTo(row(3)); // ... and drag over B..D
      const label = typeof preset === "string" ? preset : "add";
      expect(sel(s), label).toBe(expected);
      s.dragTo(row(1)); // pulled back to B
      expect(sel(s), `${label}, pulled back`).toBe(pulledBack);
    }
  });

  // Explorer on Windows 11, 2026-10-11 (verification tests S7 and S7b): Ctrl+Shift-click
  // adds the range, or removes it if the last Ctrl-click deselected. Finder (list view,
  // 2026-10-16, verification test 5): Cmd+Shift-click is a Cmd-click.
  it("ctrl+shift-click: Windows adds or removes the range by the last Ctrl-click's mode", () => {
    const w = make("windows");
    w.click(row(0));
    w.cmdClick(row(2)); // A, C; anchor C, mode select
    w.cmdShiftClick(row(4));
    expect(sel(w), "select mode").toBe("A,C,D,E");
    w.cmdShiftClick(row(3)); // moves the range's end
    expect(sel(w), "second ctrl+shift-click").toBe("A,C,D");

    const d = make("windows");
    d.click(row(0));
    d.shiftClick(row(4)); // A..E
    d.cmdClick(row(2)); // deselects C; anchor C, mode deselect
    d.cmdShiftClick(row(3));
    expect(sel(d), "deselect mode").toBe("A,B,E");

    const m = make("mac"); // same as a Cmd-click
    m.click(row(0));
    m.shiftClick(row(4)); // A..E
    m.cmdClick(row(2)); // deselects C
    m.cmdShiftClick(row(3)); // deselects D
    expect(sel(m), "mac").toBe("A,B,E");
    m.cmdShiftClick(row(5));
    expect(sel(m), "mac, toggles on").toBe("A,B,E,F");

    const sh = make({ ...TRADITIONAL_PRESETS.mac, ctrlShiftClick: "shift" }); // same as a Shift-click
    sh.click(row(0));
    sh.shiftClick(row(4));
    sh.cmdClick(row(2));
    sh.cmdShiftClick(row(3));
    expect(sel(sh), "shift").toBe("A,B,C,D,E");
  });

  // Verification tests R5 and R5b: Shift + drag from empty space adds a rectangle, and
  // pulling it back restores the selection. Finder the same (2026-10-16, test 6).
  // Grid of 6 columns: A..F in one row.
  it("shift-drag from empty space: both presets add a rectangle; \"range\" makes a range", () => {
    const grid = new LogicalGridGeometry(
      { itemWidth: 100, itemHeight: 100, containerWidth: 600, totalItems: 6 },
      ABCDEF.map((id) => ({ id })),
      ABCDEF.map((id) => ({ id })),
    );
    const at = (i: number) => ({ x: i * 100 + 50, y: 50 });
    const gapLeftOf = (i: number) => ({ x: i * 100 + 4, y: 50 });
    const w = make("windows", grid);
    w.click(at(0));
    w.shiftClick(gapLeftOf(3)); // nothing changes on the press
    expect(sel(w), "press").toBe("A");
    w.dragTo(at(5));
    expect(sel(w), "drag").toBe("A,D,E,F");
    w.dragTo(gapLeftOf(3));
    expect(sel(w), "pulled back").toBe("A");

    const f = make("mac", grid);
    f.click(at(0));
    f.shiftClick(gapLeftOf(3));
    f.dragTo(at(5));
    expect(sel(f), "mac").toBe("A,D,E,F");

    const m = make({ ...TRADITIONAL_PRESETS.mac, shiftDragInSpace: "range" }, grid);
    m.click(at(0));
    m.shiftClick(gapLeftOf(3));
    m.dragTo(at(5));
    expect(sel(m), "range").toBe("A,B,C,D,E,F");
  });

  // Finder, 2026-10-16 (verification tests 1, 2 and 10): in icon view a Shift-click
  // toggles the item, in list view it adds the range. Grid of 3 columns, 2 rows.
  describe("shift-click in the grid", () => {
    const grid = () =>
      new LogicalGridGeometry(
        { itemWidth: 100, itemHeight: 100, containerWidth: 300, totalItems: 6 },
        ABCDEF.map((id) => ({ id })),
        ABCDEF.map((id) => ({ id })),
      );
    const at = (i: number) => ({ x: (i % 3) * 100 + 50, y: Math.floor(i / 3) * 100 + 50 });

    it("Finder toggles the item; Windows makes a range", () => {
      const m = make("mac", grid());
      m.click(at(0));
      m.shiftClick(at(4));
      expect(sel(m), "mac").toBe("A,E");
      m.shiftClick(at(4));
      expect(sel(m), "mac, again").toBe("A");

      const w = make("windows", grid());
      w.click(at(0));
      w.shiftClick(at(4));
      expect(sel(w), "windows").toBe("A,B,C,D,E");
    });

    it("Finder: the toggled item becomes the anchor (assumed, as for a Cmd-click)", () => {
      const m = make("mac", grid());
      m.click(at(0));
      m.shiftClick(at(4)); // A, E; anchor E
      m.setGeometry(new ListGeometry(ABCDEF)); // to the list
      m.shiftClick(row(5)); // range E..F added
      expect(sel(m)).toBe("A,E,F");
    });

    it("Finder: Shift+arrow keys still extend a range", () => {
      const m = make("mac", grid());
      m.click(at(0));
      m.shiftArrow("RIGHT");
      m.shiftArrow("RIGHT");
      expect(sel(m)).toBe("A,B,C");
    });

    it("Finder: a Shift-click in the list (not the grid) still adds the range", () => {
      const m = make("mac", new ListGeometry(ABCDEF, ABCDEF, "tree"));
      m.click(row(0));
      m.shiftClick(row(3));
      expect(sel(m)).toBe("A,B,C,D");
    });
  });
});

// ---------------------------------------------------------------------------
// Parity: where the models agree, they must produce identical selections.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ITEMS = Array.from({ length: 24 }, (_, i) => `i${String(i).padStart(2, "0")}`);

describe("Property: all models agree on shared gestures", () => {
  for (let seed = 1; seed <= 40; seed++) {
    it(`seed ${seed}`, () => {
      const rand = mulberry32(seed * 7717);
      let geom = new ListGeometry(ITEMS, ITEMS);
      const engines: Array<[string, SelectionEngine<string, P>]> = [
        ["algebraic", new SelectionState<string, P>(geom, () => {}, { scheduleFlush: () => {} })],
        ["windows", make("windows", geom)],
        ["mac", make("mac", geom)],
      ];
      const trace: string[] = [];
      for (let step = 0; step < 120; step++) {
        const r = rand();
        const y = Math.floor(rand() * (geom.items.length + 2)) - 1;
        let act: (e: SelectionEngine<string, P>) => void;
        if (r < 0.3) {
          act = (e) => e.click(row(y));
          trace.push(`click ${y}`);
        } else if (r < 0.5) {
          act = (e) => e.cmdClick(row(y));
          trace.push(`cmd ${y}`);
        } else if (r < 0.65) {
          const y2 = Math.floor(rand() * geom.items.length);
          act = (e) => {
            e.click(row(y));
            e.dragTo(row(y2));
            e.flush();
          };
          trace.push(`drag ${y}->${y2}`);
        } else if (r < 0.75) {
          const dir = rand() < 0.5 ? "UP" : "DOWN";
          act = (e) => e.arrow(dir);
          trace.push(`arrow ${dir}`);
        } else if (r < 0.85) {
          const f = rand() < 0.5 ? tt : ff;
          const dom = ITEMS.filter(() => rand() < 0.3);
          act = (e) => e.apply(f, dom);
          trace.push(`apply ${f === tt ? "tt" : "ff"}`);
        } else {
          // Re-projection (e.g. expand/collapse); not a filter, so no model clears.
          geom = new ListGeometry(ITEMS.filter(() => rand() < 0.8), ITEMS);
          const g = geom;
          act = (e) => e.setGeometry(g);
          trace.push("setGeometry");
        }
        const results = engines.map(([name, e]) => {
          act(e);
          return [name, sel(e)] as const;
        });
        const [, reference] = results[0];
        for (const [name, value] of results.slice(1)) {
          expect(value, `${name} vs algebraic after: ${trace.slice(-6).join(" | ")}`).toBe(reference);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Keyboard commands on every model
// ---------------------------------------------------------------------------

describe.each(["algebraic", "windows", "mac"] as const)("keyboard commands (%s)", (model) => {
  const create = (geom: SelectionGeometry<string, P> = new ListGeometry(ABCDEF)): SelectionEngine<string, P> =>
    model === "algebraic"
      ? new SelectionState<string, P>(geom, () => {}, { scheduleFlush: () => {} })
      : make(model, geom);

  it("invert (apply not) flips exactly the given domain", () => {
    const s = create();
    s.click(row(0));
    s.cmdClick(row(5)); // A, F
    s.apply(not, ["A", "B", "C"]); // visible part only
    expect(sel(s)).toBe("B,C,F");
  });

  it("with no cursor, a navigation key steps from the first item, as in Explorer", () => {
    // Explorer on Windows 11 (2026-10-11, icon view): Down selects the item below the
    // first, Right the one after it; Up and Left do nothing. Grid of 3 columns: A B C / D E F.
    const grid = () =>
      new LogicalGridGeometry(
        { itemWidth: 100, itemHeight: 100, containerWidth: 300, totalItems: 6 },
        ABCDEF.map((id) => ({ id })),
        ABCDEF.map((id) => ({ id })),
      );
    for (const [key, expected] of [["DOWN", "D"], ["RIGHT", "B"], ["UP", ""], ["LEFT", ""], ["HOME", "A"], ["END", "F"]]) {
      const s = create(grid());
      s.arrow(key);
      expect(sel(s), key).toBe(expected);
      expect(s.cursorId, key).toBe(expected === "" ? null : expected);
    }
    const s = create(grid());
    s.shiftArrow("DOWN");
    expect(sel(s), "first Shift+Down").toBe("D");
    const c = create(grid());
    c.cmdArrow("DOWN"); // moves the cursor only
    expect(c.cursorId).toBe("D");
    expect(sel(c)).toBe("");
  });

  it("navigation keys in an empty grid do nothing (the hidden selection survives)", () => {
    // Regression: in a grid with no items (a filter with no matches) an arrow key
    // clicked "nothing" and cleared the whole selection.
    const grid = (ids: string[]) =>
      new LogicalGridGeometry(
        { itemWidth: 100, itemHeight: 100, containerWidth: 400, totalItems: ids.length },
        ids.map((id) => ({ id })),
        ABCDEF.map((id) => ({ id })),
      );
    const full = grid(ABCDEF);
    const s = create(full);
    s.click(full.locate("A")!);
    s.cmdClick(full.locate("B")!);
    s.setGeometry(grid([]));
    const keys = () => {
      for (const key of ["DOWN", "UP", "END", "PAGEDOWN"]) {
        s.arrow(key);
        s.shiftArrow(key);
        s.cmdArrow(key);
      }
    };
    keys(); // no cursor
    expect(sel(s)).toBe("A,B");
    s.cmdClick({ x: 50, y: 50 }); // cursor in the empty grid's space
    keys();
    expect(sel(s)).toBe("A,B");
  });

  it("Shift+End / Shift+Home extend to the last / first item", () => {
    const s = create();
    s.click(row(2));
    s.shiftArrow("END");
    expect(sel(s)).toBe("C,D,E,F");
    s.shiftArrow("HOME");
    expect(sel(s)).toBe("A,B,C");
  });
});

describe("invert is undoable in the algebraic model", () => {
  it("one Ctrl+Z restores the selection before the inversion", () => {
    const s = new SelectionState<string, P>(new ListGeometry(ABCDEF), () => {}, { scheduleFlush: () => {} });
    s.click(row(1));
    s.apply(not, ABCDEF);
    expect(sel(s)).toBe("A,C,D,E,F");
    s.undo();
    expect(sel(s)).toBe("B");
  });
});

// ---------------------------------------------------------------------------
// Pre-selection (load) and the undo option
// ---------------------------------------------------------------------------

describe.each(["algebraic", "windows", "mac"] as const)("load() (%s)", (model) => {
  const create = (): SelectionEngine<string, P> =>
    model === "algebraic"
      ? new SelectionState<string, P>(new ListGeometry(ABCDEF), () => {}, { scheduleFlush: () => {} })
      : make(model);

  it("sets a selection that is not part of the history", () => {
    const s = create();
    s.load(["B", "C"]);
    expect(sel(s)).toBe("B,C");
    expect(s.undoDepth).toBe(0);
    s.undo(); // nothing to undo: the pre-selection stays
    expect(sel(s)).toBe("B,C");
  });

  it("later gestures build on it", () => {
    const s = create();
    s.load(["B", "C"]);
    s.cmdClick(row(4));
    expect(sel(s)).toBe("B,C,E");
    s.click(row(0)); // a plain click clears it, as any selection
    expect(sel(s)).toBe("A");
  });

  it("resets gestures, anchor and cursor", () => {
    const s = create();
    s.click(row(1));
    s.load(["F"]);
    expect(s.cursor).toBeUndefined();
    s.shiftClick(row(3)); // no anchor from before load()
    expect(sel(s)).toContain("D");
    expect(sel(s)).not.toContain("B");
  });

  // Task A: anchor on the first and active end on the last pre-selected item,
  // as after a click on B and a Shift-click on C.
  it("with anchor B and focus C, a Shift-click on E selects B–E in every model", () => {
    const s = create();
    s.load(["B", "C"], "B", "C");
    expect(s.cursor).toEqual(row(2));
    s.shiftClick(row(4));
    expect(sel(s)).toBe("B,C,D,E");
  });

  // As after Ctrl-clicks on B and C: anchor and focus both on C.
  it("with anchor and focus on C, Windows replaces the selection with C–E", () => {
    const s = create();
    s.load(["B", "C"], "C");
    s.shiftClick(row(4));
    expect(sel(s)).toBe(model === "windows" ? "C,D,E" : "B,C,D,E");
  });

  it("locates anchor and focus by ID when the geometry changes (e.g. set after load)", () => {
    const s = create();
    s.load(["B", "C"], "B", "C");
    s.setGeometry(new ListGeometry(["F", "E", "D", "C", "B", "A"]));
    s.shiftClick(row(1)); // E, in the new order above C and B
    expect(sel(s)).toBe("B,C,D,E");
  });
});

// Task D (revision 18): two kept items K1, K2 with an unflagged item U between
// them, directly followed by the targets T1-T4. Starts as after a click on K1 and
// a Ctrl-click on K2 (anchor and focus on K2), as in Explorer.
describe.each(["algebraic", "windows", "mac"] as const)("Task D: keep and extend (%s)", (model) => {
  const ITEMS = ["X", "K1", "U", "K2", "T1", "T2", "T3", "T4", "Y"];
  const at = (id: string) => row(ITEMS.indexOf(id));
  const ALL = "K1,K2,T1,T2,T3,T4";
  const create = (): SelectionEngine<string, P> => {
    const geom = new ListGeometry(ITEMS);
    const s =
      model === "algebraic"
        ? new SelectionState<string, P>(geom, () => {}, { scheduleFlush: () => {}, undo: false })
        : make(model, geom);
    s.load(["K1", "K2"], "K2", "K2");
    return s;
  };

  it("Shift-click T4 (extend from K2): only the Windows-like preset drops K1", () => {
    const s = create();
    s.shiftClick(at("T4"));
    expect(sel(s)).toBe(model === "windows" ? "K2,T1,T2,T3,T4" : ALL);
  });

  it("Ctrl-click T1, Shift-click T4: only the Windows-like preset drops K1 and K2", () => {
    const s = create();
    s.cmdClick(at("T1"));
    s.shiftClick(at("T4"));
    expect(sel(s)).toBe(model === "windows" ? "T1,T2,T3,T4" : ALL);
  });

  it("Ctrl-click every target: the same in every model", () => {
    const s = create();
    for (const id of ["T1", "T2", "T3", "T4"]) s.cmdClick(at(id));
    expect(sel(s)).toBe(ALL);
  });

  it("Ctrl-click T1, Ctrl+Shift-click T4: the range is added except in the Finder-like preset", () => {
    const s = create();
    s.cmdClick(at("T1"));
    (s.cmdShiftClick ?? s.shiftClick).call(s, at("T4"));
    // Finder: Cmd+Shift-click is a Cmd-click (2026-10-16); the kept files stay either way.
    expect(sel(s)).toBe(model === "mac" ? "K1,K2,T1,T4" : ALL);
  });

  it("click K1, Shift-click T4: one range over everything also selects U in every model", () => {
    const s = create();
    s.click(at("K1"));
    s.shiftClick(at("T4"));
    expect(sel(s)).toBe("K1,K2,T1,T2,T3,T4,U");
  });
});

describe("algebraic model with undo turned off", () => {
  it("reports no undo capability and ignores undo/redo", () => {
    const s = new SelectionState<string, P>(new ListGeometry(ABCDEF), () => {}, { scheduleFlush: () => {}, undo: false });
    expect(s.capabilities.undo).toBe(false);
    s.click(row(0));
    s.cmdClick(row(1));
    s.undo();
    expect(sel(s)).toBe("A,B");
    s.redo();
    expect(sel(s)).toBe("A,B");
  });
});
