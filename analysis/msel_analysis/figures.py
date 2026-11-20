"""Figures for the report and the thesis (PNG and SVG).

Colours: predicate = blue, traditional = orange (categorical slots 1 and 2 of
the reference palette; validated for colour-vision deficiencies). Identity is
never colour alone: x-axis labels and legends name the systems.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402
from matplotlib.ticker import FuncFormatter, LogLocator, MaxNLocator, NullFormatter  # noqa: E402

from .analysis import CORE_TASKS, MEASURES, SESSION_TARGET_MIN, SYSTEMS, TASK_LABEL, Results, included, paired  # noqa: E402

COLOR = {"predicate": "#2a78d6", "traditional": "#eb6834", "none": "#8a8984"}
NAME = {"predicate": "Predicate", "traditional": "Traditional", "none": "No preference"}
SURFACE = "#fcfcfb"
TEXT = "#0b0b0b"
TEXT_2 = "#52514e"
GRID = "#e4e3df"

plt.rcParams.update(
    {
        "figure.facecolor": SURFACE,
        "axes.facecolor": SURFACE,
        "savefig.facecolor": SURFACE,
        "font.size": 10,
        "text.color": TEXT,
        "axes.labelcolor": TEXT_2,
        "axes.edgecolor": GRID,
        "xtick.color": TEXT_2,
        "ytick.color": TEXT_2,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "axes.grid.axis": "y",
        "grid.color": GRID,
        "grid.linewidth": 0.8,
        "svg.fonttype": "none",
        "axes.axisbelow": True,
    }
)

ORDER = ("traditional", "predicate")  # baseline on the left


def _save(fig, out: Path, name: str) -> list[str]:
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for ext in ("png", "svg"):
        path = out / f"{name}.{ext}"
        fig.savefig(path, dpi=200, bbox_inches="tight")
        files.append(path.name)
    plt.close(fig)
    return files


def _paired_panel(
    ax,
    wide: pd.DataFrame,
    jitter: float = 0.0,
    log: bool = False,
    seed: int = 1,
    names: dict[str, str] = NAME,
    line: str = GRID,
    ring: str = SURFACE,
    hollow: pd.DataFrame | None = None,
) -> None:
    """One line per participant and a median bar per system. ``hollow`` (same index as
    ``wide``, boolean) draws those points as rings, e.g. skipped attempts ranked slowest."""
    rng = np.random.default_rng(seed)
    n = len(wide)
    if n == 0:
        ax.text(0.5, 0.5, "no pairs", transform=ax.transAxes, ha="center", va="center", color=TEXT_2)
    else:
        dx = rng.uniform(-0.06, 0.06, n)
        dy = rng.uniform(-jitter, jitter, n) if jitter else np.zeros(n)
        xs = {s: i + dx for i, s in enumerate(ORDER)}
        ys = {s: wide[s].to_numpy(dtype=float) + dy for s in ORDER}
        for i in range(n):
            ax.plot([xs[ORDER[0]][i], xs[ORDER[1]][i]], [ys[ORDER[0]][i], ys[ORDER[1]][i]], color=line, lw=1, zorder=1)
        for i, s in enumerate(ORDER):
            empty = hollow[s].to_numpy(dtype=bool) if hollow is not None else np.zeros(n, dtype=bool)
            ax.scatter(xs[s][~empty], ys[s][~empty], s=26, color=COLOR[s], edgecolor=ring, linewidth=1, zorder=3, label=names[s])
            if empty.any():
                ax.scatter(xs[s][empty], ys[s][empty], s=22, facecolor=ring, edgecolor=COLOR[s], linewidth=1.2, zorder=3)
            med = float(np.median(wide[s]))
            ax.plot([i - 0.22, i + 0.22], [med, med], color=TEXT, lw=2, solid_capstyle="round", zorder=4)
    ax.set_xticks(range(len(ORDER)), [names[s] for s in ORDER])
    ax.set_xlim(-0.5, len(ORDER) - 0.5)
    if log:
        ax.set_yscale("log")
        ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}"))


def paired_measures(r: Results, out: Path) -> dict[str, list[str]]:
    files = {}
    for m in MEASURES:
        fig, axes = plt.subplots(1, len(CORE_TASKS), figsize=(3.3 * len(CORE_TASKS), 3.6), sharey=True)
        for ax, task in zip(axes, CORE_TASKS):
            w = paired(r.attempts, task, m.column, m.mask) if not r.attempts.empty else pd.DataFrame(columns=ORDER)
            _paired_panel(ax, w, jitter=0.12 if m.key in ("seq", "errors", "reselected") else 0.0, log=m.key == "time")
            ax.set_title(f"{TASK_LABEL[task]}  (n = {len(w)})", fontsize=10, loc="left", color=TEXT)
        axes[0].set_ylabel(f"{m.label}" + (f" ({m.unit}, log scale)" if m.key == "time" else ""))
        fig.suptitle(f"{m.label}: one line per participant, bar = median", x=0.01, ha="left", fontsize=11, color=TEXT)
        _legend(fig)
        fig.tight_layout(rect=(0, 0, 1, 0.92))
        files[m.key] = _save(fig, out, f"paired_{m.key}")
    return files


def _legend(fig) -> None:
    handles = [plt.Line2D([], [], marker="o", ls="", color=COLOR[s], label=NAME[s]) for s in ("predicate", "traditional")]
    fig.legend(handles=handles, loc="upper right", ncols=2, frameon=False, fontsize=9)


def questionnaire(r: Results, out: Path) -> list[str]:
    b = r.tables.blocks
    fig, axes = plt.subplots(1, 2, figsize=(7, 3.4), sharey=True)
    labels = {"sufficient": "“The method was sufficient”", "frustrating": "“The method was frustrating”"}
    for ax, key in zip(axes, labels):
        wide = (
            b.pivot_table(index="participant", columns="system", values=key, aggfunc="first").reindex(columns=list(ORDER)).dropna()
            if not b.empty
            else pd.DataFrame(columns=ORDER)
        )
        _paired_panel(ax, wide, jitter=0.15)
        ax.set_title(f"{labels[key]}  (n = {len(wide)})", fontsize=10, loc="left")
        ax.set_ylim(0.5, 7.5)
        ax.set_yticks(range(1, 8))
    axes[0].set_ylabel("agreement (1 = strongly disagree, 7 = strongly agree)", fontsize=8)
    _legend(fig)
    fig.tight_layout(rect=(0, 0, 1, 0.9))
    return _save(fig, out, "questionnaire")


def preference(r: Results, out: Path) -> list[str]:
    counts = r.questionnaire["preference_counts"]
    keys = ["predicate", "traditional", "none"]
    fig, ax = plt.subplots(figsize=(6, 2.2))
    y = np.arange(len(keys))[::-1]
    vals = [counts[k] for k in keys]
    ax.barh(y, vals, height=0.55, color=[COLOR[k] for k in keys], edgecolor=SURFACE, linewidth=2)
    for yi, v in zip(y, vals):
        ax.text(v + 0.2, yi, str(v), va="center", color=TEXT, fontsize=10)
    ax.set_yticks(y, [NAME[k] for k in keys])
    ax.grid(axis="y", visible=False)
    ax.grid(axis="x", visible=True)
    ax.set_xlabel("participants")
    ax.xaxis.set_major_locator(MaxNLocator(integer=True))
    ax.set_title("Which system did you prefer?", loc="left", fontsize=11)
    fig.tight_layout()
    return _save(fig, out, "preference")


def session_length(r: Results, out: Path) -> list[str]:
    s = r.tables.sessions
    fig, ax = plt.subplots(figsize=(6, 2.6))
    if not s.empty:
        real = s[~s["pilot"].astype(bool) & s["completed"].astype(bool)]
        minutes = (real["sessionMs"] / 60000).dropna()
        if len(minutes):
            ax.hist(minutes, bins=np.arange(0, max(16, minutes.max() + 1), 1), color="#8a8984", edgecolor=SURFACE, linewidth=2)
    ax.axvline(SESSION_TARGET_MIN, color=TEXT, lw=1.5, ls="--")
    ax.text(SESSION_TARGET_MIN + 0.2, ax.get_ylim()[1] * 0.9, "10-minute target", color=TEXT_2, fontsize=9)
    ax.set_xlabel("session length, consent → end (minutes)")
    ax.set_ylabel("participants")
    ax.yaxis.set_major_locator(MaxNLocator(integer=True))
    ax.set_title("Session length (completed sessions)", loc="left", fontsize=11)
    fig.tight_layout()
    return _save(fig, out, "session_length")


# ---------------------------------------------------------------------------
# Thesis figures
# ---------------------------------------------------------------------------
# The same pairs and attempts as the tests, styled for the Typst thesis: Libertinus
# Serif (the body font), a white page, the 12.5 cm text width and no titles (the
# captions are in Typst). Insert the SVGs at `width: 100%` so that 9 pt here is 9 pt
# in the thesis. The system names follow the thesis: "Unified" and "Traditional".

THESIS_WIDTH_IN = 12.5 / 2.54
THESIS_FONT = "Libertinus Serif"
FONT_DIR = Path(__file__).resolve().parents[1] / "fonts"
THESIS_NAME = {"predicate": "Unified", "traditional": "Traditional", "none": "No preference"}
PAIR_LINE = "#c3c2b7"
HATCH = {"predicate": None, "traditional": "////"}  # a second channel for greyscale print
THESIS_TASKS = ("keep-what-you-have", "context-switch", "rule-with-exceptions")
THESIS_STRATEGIES: list[tuple[str, str] | None] = [  # None = a gap between groups
    ("usedFilter", "Search (filter)"),
    ("usedPredicateSelect", "Select matching"),
    ("usedPredicateDeselect", "Deselect matching"),
    ("usedShowSelectedOnly", "Show selected only"),
    None,
    ("usedNavigate", "Open another folder"),
    ("usedViewSwitch", "Switch view"),
    ("usedSelectAll", "Select all"),
    None,
    ("usedCtrlClick", "Ctrl/Cmd-click"),
    ("usedShiftClick", "Shift-click"),
    ("usedDrag", "Drag"),
    ("usedKeyboard", "Keyboard"),
]
UNIFIED_ONLY = {"usedPredicateSelect", "usedPredicateDeselect", "usedShowSelectedOnly"}


def _thesis_font() -> str:
    """Libertinus Serif from analysis/fonts/ (or the system); a generic serif otherwise."""
    from matplotlib import font_manager as fm

    for f in sorted(FONT_DIR.glob("*.otf")):
        fm.fontManager.addfont(str(f))
    try:
        fm.findfont(fm.FontProperties(family=THESIS_FONT), fallback_to_default=False)
        return THESIS_FONT
    except ValueError:
        return "serif"


def _thesis_rc() -> dict:
    return {
        "font.family": [_thesis_font()],
        "font.size": 9,
        "axes.titlesize": 9,
        "axes.labelsize": 9,
        "xtick.labelsize": 8.5,
        "ytick.labelsize": 8.5,
        "legend.fontsize": 8.5,
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        "savefig.facecolor": "white",
        "hatch.linewidth": 0.6,
        "svg.hashsalt": "msel-thesis",
    }


def _save_thesis(fig, out: Path, name: str) -> list[str]:
    """SVG for the thesis (text stays text, set in the thesis font by Typst) and a PNG preview.
    No tight bounding box: the figure keeps the text width."""
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for ext, kw in (("svg", {"metadata": {"Date": None}}), ("png", {"dpi": 300})):
        fig.savefig(out / f"{name}.{ext}", **kw)
        files.append(f"{out.name}/{name}.{ext}")
    plt.close(fig)
    return files


def _titles(ax, left: str, right: str = "") -> None:
    ax.set_title(left, loc="left", fontweight="bold")
    if right:
        ax.set_title(right, loc="right", color=TEXT_2)


def _system_legend(fig, extra: list | None = None) -> None:
    handles = [Patch(facecolor=COLOR[s], edgecolor="white", hatch=HATCH[s], label=THESIS_NAME[s]) for s in ORDER]
    fig.legend(handles=handles + (extra or []), loc="outside upper right", ncols=len(handles) + len(extra or []), frameon=False)


def thesis_paired(r: Results, out: Path, key: str, tasks: tuple[str, ...] = THESIS_TASKS) -> list[str]:
    """Time or gestures for Tasks A-C: the pairs the tests use (exclusion rule applied)."""
    m = next(x for x in MEASURES if x.key == key)
    a = r.attempts
    log = key == "time"
    with plt.rc_context(_thesis_rc()):
        fig, axes = plt.subplots(1, len(tasks), figsize=(THESIS_WIDTH_IN, 2.6), sharey=True, layout="constrained")
        any_skipped = False
        for ax, task in zip(axes, tasks):
            w, hollow = pd.DataFrame(columns=list(ORDER)), None
            if not a.empty:
                w = paired(a, task, m.column, m.mask)
                if log:
                    sk = paired(a.assign(_skipped=a["skipped"].astype(float)), task, "_skipped", m.mask)
                    hollow = sk.reindex(w.index).fillna(0.0) > 0
                    any_skipped |= bool(hollow.to_numpy().any())
            _paired_panel(ax, w, log=log, names=THESIS_NAME, line=PAIR_LINE, ring="white", hollow=hollow)
            _titles(ax, f"Task {TASK_LABEL[task][0]}", f"n = {len(w)}")
            ax.tick_params(axis="x", length=0)
        if log:
            axes[0].yaxis.set_major_locator(LogLocator(subs=(1.0, 2.0, 5.0)))
            axes[0].yaxis.set_minor_formatter(NullFormatter())
            axes[0].set_ylabel("time (s, log scale)")
        else:
            axes[0].set_ylabel(m.label.lower())
            axes[0].yaxis.set_major_locator(MaxNLocator(integer=True))
        if any_skipped:
            ring = plt.Line2D([], [], marker="o", ls="", markerfacecolor="white", markeredgecolor=TEXT_2, label="skipped (ranked slowest)")
            fig.legend(handles=[ring], loc="outside lower right", frameon=False)
        return _save_thesis(fig, out, f"{key}_paired")


def thesis_strategies(r: Results, out: Path, tasks: tuple[str, ...] = ("context-switch", "rule-with-exceptions")) -> list[str]:
    """Share of attempts (all attempts, as in the report's strategy table) that used each feature."""
    a = r.attempts
    items = [x for x in THESIS_STRATEGIES if x is not None]
    ys, y = [], 0.0
    for x in THESIS_STRATEGIES:
        if x is None:
            y += 0.5
            continue
        ys.append(y)
        y += 1.0
    ys = np.array(ys)
    h = 0.38
    with plt.rc_context(_thesis_rc()):
        fig, axes = plt.subplots(1, len(tasks), figsize=(THESIS_WIDTH_IN, 3.4), sharey=True, layout="constrained")
        for ax, task in zip(axes, tasks):
            d = a[a["task"] == task] if not a.empty else pd.DataFrame(columns=["system"])
            n = {s: int((d["system"] == s).sum()) for s in SYSTEMS}
            for s in ORDER:
                off = -h / 2 if s == "traditional" else h / 2  # the y axis is inverted: traditional on top
                ds = d[d["system"] == s]
                for yi, (col, _) in zip(ys, items):
                    if s == "traditional" and col in UNIFIED_ONLY:
                        continue
                    share = 100 * float(ds[col].astype(float).mean()) if (col in ds.columns and len(ds)) else 0.0
                    ax.barh(yi + off, share, height=h, color=COLOR[s], edgecolor="white", linewidth=0.8, hatch=HATCH[s])
            ax.set_xlim(0, 100)
            ax.set_xticks([0, 25, 50, 75, 100])
            ax.grid(axis="y", visible=False)
            ax.grid(axis="x", visible=True)
            ax.tick_params(axis="y", length=0)
            right = f"n = {n['predicate']}" if n["predicate"] == n["traditional"] else f"n = {n['predicate']} / {n['traditional']}"
            _titles(ax, f"Task {TASK_LABEL[task][0]}", right)
        axes[0].set_yticks(ys, [label + ("†" if col in UNIFIED_ONLY else "") for col, label in items])
        axes[0].invert_yaxis()
        fig.supxlabel("attempts that used the feature (%)", fontsize=9, color=TEXT_2)
        _system_legend(fig, [Patch(visible=False, label="† unified system only")])
        return _save_thesis(fig, out, "strategies")


def thesis_questionnaire(r: Results, out: Path) -> list[str]:
    """Answers to the two block questions, counted per scale point (participants with both answers)."""
    b = r.tables.blocks
    if not b.empty:
        b = b[b["participant"].isin(included(r.tables))]
    items = [("sufficient", "Sufficient for the tasks"), ("frustrating", "Frustrating to use")]
    levels = np.arange(1, 8)
    w = 0.38
    with plt.rc_context(_thesis_rc()):
        fig, axes = plt.subplots(1, 2, figsize=(THESIS_WIDTH_IN, 2.4), sharey=True, layout="constrained")
        for ax, (key, title) in zip(axes, items):
            wide = (
                b.pivot_table(index="participant", columns="system", values=key, aggfunc="first").reindex(columns=list(ORDER)).dropna()
                if not b.empty and key in b.columns
                else pd.DataFrame(columns=list(ORDER))
            )
            for s in ORDER:
                off = -w / 2 if s == "traditional" else w / 2
                counts = [int((wide[s] == lv).sum()) for lv in levels]
                ax.bar(levels + off, counts, width=w, color=COLOR[s], edgecolor="white", linewidth=0.8, hatch=HATCH[s])
            ax.set_xticks(levels)
            ax.set_xlim(0.4, 7.6)
            ax.tick_params(axis="x", length=0)
            ax.yaxis.set_major_locator(MaxNLocator(integer=True))
            _titles(ax, title, f"n = {len(wide)}")
        axes[0].set_ylabel("participants")
        fig.supxlabel("1 = strongly disagree, 7 = strongly agree", fontsize=8.5, color=TEXT_2)
        _system_legend(fig)
        return _save_thesis(fig, out, "questionnaire")


def thesis_figures(r: Results, out: Path) -> dict[str, list[str]]:
    return {
        "thesis_time": thesis_paired(r, out, "time"),
        "thesis_gestures": thesis_paired(r, out, "gestures"),
        "thesis_strategies": thesis_strategies(r, out),
        "thesis_questionnaire": thesis_questionnaire(r, out),
    }


def all_figures(r: Results, out: Path) -> dict[str, list[str]]:
    files = paired_measures(r, out)
    files["questionnaire"] = questionnaire(r, out)
    files["preference"] = preference(r, out)
    files["session_length"] = session_length(r, out)
    files.update(thesis_figures(r, out / "thesis"))
    return files
