"""From the tidy tables to results (methodology §10.2 and §14).

Units of analysis: one attempt = one participant × task × system. Each
participant contributes one attempt per system and task, so comparisons are
paired by participant. Pilot sessions are left out everywhere; incomplete
sessions contribute the pairs they finished.

Pre-registered rules implemented here:
  - Completion time = first input → Done (``activeMs``); a skipped attempt is
    ranked as the slowest (its time is set above every observed time of that
    task), so skipping never helps a system.
  - Attempts with more than 10 % wrong items (``excludedForErrors``) are left out
    of the time and gesture comparisons (NIK 2016), unless skipped (time only).
  - Gestures and errors are compared on completed (not skipped) attempts.
  - Directional hypotheses use one-sided tests ("predicate better"); Holm
    correction within each measure across the directional tasks (B, C, D).
  - Task A is the baseline task (revision 18): no difference expected, so it is
    tested two-sided, like the warm-up (H1), and is not part of the Holm family.
"""

from __future__ import annotations

import math
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd
from scipy import stats as sps

from . import stats as st

CORE_TASKS = ["keep-what-you-have", "context-switch", "rule-with-exceptions", "keep-and-extend"]
TASK_LABEL = {
    "keep-what-you-have": "A: Keep what you have",
    "context-switch": "B: Context switch",
    "rule-with-exceptions": "C: Rule with exceptions",
    "keep-and-extend": "D: Keep and extend",
}
# Baseline tasks (no difference expected): two-sided tests, outside the Holm family (methodology §2, H2).
BASELINE_TASKS = {"keep-what-you-have"}
# Tasks with kept (pre-selected) items: Task A (baseline, H2) and Task D (fragile selection, H6).
KEEP_TASKS = ["keep-what-you-have", "keep-and-extend"]


def task_alternative(task: str, alternative: str = "greater") -> str:
    """The test direction for ``task``: two-sided for baseline tasks, else ``alternative``."""
    return "two-sided" if task in BASELINE_TASKS else alternative


def _holm_directional(block: list[dict]) -> None:
    """Holm-adjust the directional tasks of one measure; baseline tasks keep their own p."""
    directional = [row for row in block if row["task"] not in BASELINE_TASKS]
    for row, p in zip(directional, st.holm([b["p"] for b in directional])):
        row["p_holm"] = p
    for row in block:
        if row["task"] in BASELINE_TASKS:
            row["p_holm"] = row["p"]
SYSTEMS = ("predicate", "traditional")
TUTORIAL_TARGET_S = 150.0  # H0 bound; raised from 90 s when the tutorial grew from 6 to 8 steps (2026-10-07)
SESSION_TARGET_MIN = 10.0
# The study laptop's viewport (STUDY.viewport in src/study/config.ts) and the setup screen's tolerance.
STUDY_VIEWPORT = (1365, 853)
VIEWPORT_SLACK = 2


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------


@dataclass
class Tables:
    sessions: pd.DataFrame
    tasks: pd.DataFrame
    blocks: pd.DataFrame
    answers: pd.DataFrame
    comments: pd.DataFrame
    issues: pd.DataFrame


def _read(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path, true_values=["true"], false_values=["false"], keep_default_na=True)


def load_tables(root: Path) -> Tables:
    d = Path(root) / "tables"
    return Tables(**{name: _read(d / f"{name}.csv") for name in Tables.__dataclass_fields__})


def _bool(s: pd.Series) -> pd.Series:
    return s.map(lambda v: v is True or v == "true" or v == 1 or v is np.True_).astype(bool)


def included(t: Tables) -> set[str]:
    """Participants in the analysis: every non-pilot study session."""
    if t.sessions.empty:
        return set()
    return set(t.sessions.loc[~_bool(t.sessions["pilot"]), "participant"])


# ---------------------------------------------------------------------------
# Attempts
# ---------------------------------------------------------------------------


def attempts(t: Tables) -> pd.DataFrame:
    """Core-task attempts (not tutorial steps, not abandoned) with derived measures."""
    keep = included(t)
    if t.tasks.empty:
        return pd.DataFrame()
    a = t.tasks[(t.tasks["kind"] == "task") & (t.tasks["reason"] != "abandoned") & t.tasks["participant"].isin(keep)].copy()
    a = a[a["task"].isin(CORE_TASKS)]
    for col in ["exact", "excludedForErrors"] + [c for c in a.columns if c.startswith("used")]:
        a[col] = _bool(a[col])
    a["skipped"] = a["reason"] == "skipped"
    a["completed"] = a["reason"] == "done"
    a["time_s"] = a["activeMs"].fillna(a["durationMs"]) / 1000.0
    # Skipped attempts rank as the slowest of their task.
    slowest = a.groupby("task")["time_s"].transform("max")
    a["time_rank_s"] = np.where(a["skipped"], slowest + 1.0, a["time_s"])
    a["errors"] = a["missing"] + a["extra"]
    a["keptAll"] = a["keepLost"] == 0
    if not t.answers.empty:
        seq = t.answers[t.answers["question"] == "seq"][["participant", "block", "task", "value"]].copy()
        seq["seq"] = pd.to_numeric(seq["value"], errors="coerce")
        a = a.merge(seq.drop(columns="value"), on=["participant", "block", "task"], how="left")
    else:
        a["seq"] = np.nan
    return a


def paired(a: pd.DataFrame, task: str, column: str, mask: Callable[[pd.DataFrame], pd.Series] | None = None) -> pd.DataFrame:
    """Participants with a value for both systems in ``task``: columns predicate, traditional."""
    d = a[a["task"] == task]
    if mask is not None:
        d = d[mask(d)]
    d = d.dropna(subset=[column])
    wide = d.pivot_table(index="participant", columns="system", values=column, aggfunc="first")
    for s in SYSTEMS:
        if s not in wide.columns:
            wide[s] = np.nan
    return wide[list(SYSTEMS)].dropna()


# ---------------------------------------------------------------------------
# Comparisons
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Measure:
    key: str
    column: str
    label: str
    better: str  # "lower" or "higher"
    mask: Callable[[pd.DataFrame], pd.Series] | None
    unit: str = ""


MEASURES = [
    Measure("time", "time_rank_s", "Completion time", "lower", lambda d: d["skipped"] | ~d["excludedForErrors"], "s"),
    Measure("gestures", "gestures", "Gestures", "lower", lambda d: d["completed"] & ~d["excludedForErrors"]),
    Measure("errors", "errors", "Selection errors (missing + extra)", "lower", lambda d: d["completed"]),
    Measure("seq", "seq", "Ease rating (SEQ 1-7)", "higher", None),
    Measure("reselected", "itemsReselected", "Accidental clears (items re-selected)", "lower", lambda d: d["completed"]),
]

BINARY = [
    ("completion", "completed", "Completed (not skipped)"),
    ("exact", "exact", "Exact match"),
]


def _row(measure: str, label: str, task: str, r: st.PairedResult, unit: str = "") -> dict:
    return {
        "measure": measure,
        "label": label,
        "task": task,
        "unit": unit,
        "n": r.n,
        "median_predicate": r.median_predicate,
        "iqr_predicate": r.iqr_predicate,
        "median_traditional": r.median_traditional,
        "iqr_traditional": r.iqr_traditional,
        "median_difference": r.median_difference,
        "r": r.r,
        "r_ci": r.r_ci,
        "dz": r.dz,
        "p": r.p,
        "p_holm": math.nan,
        "alternative": r.alternative,
        "favours": r.favours() if not math.isnan(r.r) else "",
        "note": r.note,
    }


def compare_measures(a: pd.DataFrame, measures=MEASURES, alternative: str = "greater") -> pd.DataFrame:
    rows = []
    for m in measures:
        block = []
        for task in CORE_TASKS:
            w = paired(a, task, m.column, m.mask) if not a.empty else pd.DataFrame(columns=SYSTEMS)
            r = st.wilcoxon_paired(w["predicate"], w["traditional"], better=m.better, alternative=task_alternative(task, alternative))
            block.append(_row(m.key, m.label, task, r, m.unit))
        _holm_directional(block)
        rows += block
    return pd.DataFrame(rows)


def compare_binary(a: pd.DataFrame, alternative: str = "greater") -> pd.DataFrame:
    rows = []
    for key, column, label in BINARY:
        block = []
        for task in CORE_TASKS:
            w = paired(a, task, column) if not a.empty else pd.DataFrame(columns=SYSTEMS)
            r = st.mcnemar_exact(w["predicate"].astype(bool), w["traditional"].astype(bool), alternative=task_alternative(task, alternative))
            block.append({"measure": key, "label": label, "task": task, **r.__dict__, "favours": r.favours()})
        _holm_directional(block)
        rows += block
    return pd.DataFrame(rows)


def keep_lost(a: pd.DataFrame, baselines: pd.Series | None = None) -> dict:
    """Kept (pre-selected) items lost at Done, per task with kept items (A, D): count and any-loss.

    Task A is the baseline task (two-sided); Task D tests fragile selection (one-sided). One
    test per task and measure, so no Holm correction. ``by_baseline``: share of attempts that
    kept everything, per system and traditional preset (Task D differs only in the Windows-like one).
    """
    out: dict = {}
    for task in KEEP_TASKS:
        alt = task_alternative(task)
        w = paired(a, task, "keepLost") if not a.empty else pd.DataFrame(columns=SYSTEMS)
        count = st.wilcoxon_paired(w["predicate"], w["traditional"], better="lower", alternative=alt)
        kept = paired(a, task, "keptAll") if not a.empty else pd.DataFrame(columns=SYSTEMS)
        anyloss = st.mcnemar_exact(kept["predicate"].astype(bool), kept["traditional"].astype(bool), alternative=alt)
        rows = []
        if baselines is not None and not kept.empty:
            k = kept.join(baselines, how="left")
            for preset, g in k.groupby("baseline"):
                rows.append({"baseline": preset, "n": len(g),
                             "kept_all_predicate": float(g["predicate"].astype(bool).mean()),
                             "kept_all_traditional": float(g["traditional"].astype(bool).mean())})
        out[task] = {"count": count, "kept_all": anyloss, "alternative": alt, "by_baseline": pd.DataFrame(rows)}
    return out


# ---------------------------------------------------------------------------
# Tutorial (H0, H1) and questionnaires (H5)
# ---------------------------------------------------------------------------


def _mean_ci(x: np.ndarray) -> tuple[float, float, float]:
    x = np.asarray(x, dtype=float)
    if x.size < 2:
        return (float(x.mean()) if x.size else math.nan, math.nan, math.nan)
    m = float(x.mean())
    h = float(sps.t.ppf(0.975, x.size - 1) * x.std(ddof=1) / math.sqrt(x.size))
    return (m, m - h, m + h)


def tutorial(t: Tables) -> dict:
    keep = included(t)
    b = t.blocks[t.blocks["participant"].isin(keep)].copy() if not t.blocks.empty else pd.DataFrame()
    out: dict = {"by_system_position": pd.DataFrame(), "h0": {}, "h1": {}}
    if b.empty:
        return out
    b["tutorial_s"] = b["tutorialMs"] / 1000.0
    b["tutorialSkipped"] = _bool(b["tutorialSkipped"])
    out["by_system_position"] = (
        b.groupby(["system", "block"])
        .agg(n=("tutorial_s", "count"), mean_s=("tutorial_s", "mean"), median_s=("tutorial_s", "median"), skipped=("tutorialSkipped", "sum"), steps=("tutorialSteps", "median"))
        .reset_index()
    )
    first = b[b["block"] == 0].dropna(subset=["tutorial_s"])
    pred = first.loc[first["system"] == "predicate", "tutorial_s"].to_numpy()
    trad = first.loc[first["system"] == "traditional", "tutorial_s"].to_numpy()
    mean, lo, hi = _mean_ci(pred)
    below = sps.wilcoxon(pred - TUTORIAL_TARGET_S, alternative="less") if pred.size >= 2 and np.any(pred != TUTORIAL_TARGET_S) else None
    longer = sps.mannwhitneyu(pred, trad, alternative="greater") if pred.size and trad.size else None
    out["h0"] = {
        "n_predicate": int(pred.size),
        "n_traditional": int(trad.size),
        "mean_predicate": mean,
        "ci_predicate": (lo, hi),
        "median_traditional": float(np.median(trad)) if trad.size else math.nan,
        "p_below_target": float(below.pvalue) if below else math.nan,
        "p_longer": float(longer.pvalue) if longer else math.nan,
    }
    w = b.copy()
    w["warmup_s"] = w["warmupActiveMs"].fillna(w["warmupMs"]) / 1000.0
    h1 = {}
    for key, column in [("time", "warmup_s"), ("gestures", "warmupGestures")]:
        wide = w.pivot_table(index="participant", columns="system", values=column, aggfunc="first")
        wide = wide.reindex(columns=list(SYSTEMS)).dropna()
        h1[key] = st.wilcoxon_paired(wide["predicate"], wide["traditional"], better="lower", alternative="two-sided")
    out["h1"] = h1
    return out


def questionnaire(t: Tables) -> dict:
    keep = included(t)
    out: dict = {}
    b = t.blocks[t.blocks["participant"].isin(keep)] if not t.blocks.empty else pd.DataFrame()
    for key, better, alternative in [("sufficient", "higher", "two-sided"), ("frustrating", "lower", "greater")]:
        if b.empty:
            out[key] = st.wilcoxon_paired([], [], better=better, alternative=alternative)
            continue
        wide = b.pivot_table(index="participant", columns="system", values=key, aggfunc="first").reindex(columns=list(SYSTEMS)).dropna()
        out[key] = st.wilcoxon_paired(wide["predicate"], wide["traditional"], better=better, alternative=alternative)
    s = t.sessions[t.sessions["participant"].isin(keep)] if not t.sessions.empty else pd.DataFrame()
    prefs = s["preferredSystem"].value_counts().to_dict() if not s.empty else {}
    k = int(prefs.get("predicate", 0))
    n = k + int(prefs.get("traditional", 0))
    out["preference"] = st.binomial_share(k, n)
    out["preference_counts"] = {key: int(prefs.get(key, 0)) for key in ("predicate", "traditional", "none")}
    lost = s["lostSelectionSystem"].value_counts().to_dict() if not s.empty else {}
    out["lost_counts"] = {key: int(lost.get(key, 0)) for key in ("none", "predicate", "traditional", "both")}
    return out


# ---------------------------------------------------------------------------
# Order and dataset (mixed model), sensitivity, strategies, data quality
# ---------------------------------------------------------------------------


def mixed_models(a: pd.DataFrame) -> pd.DataFrame:
    """log(time) ~ system × position + dataset + (1 | participant), per task."""
    import statsmodels.formula.api as smf

    rows = []
    for task in CORE_TASKS:
        d = a[(a["task"] == task)] if not a.empty else pd.DataFrame()
        if not d.empty:
            d = d[d["skipped"] | ~d["excludedForErrors"]].copy()
        row = {"task": task, "n_participants": int(d["participant"].nunique()) if not d.empty else 0}
        if row["n_participants"] < 6:
            rows.append({**row, "note": "too few participants"})
            continue
        d["log_time"] = np.log(d["time_rank_s"].clip(lower=0.1))
        d["position"] = d["block"].astype(int)
        # Sum-coded position and dataset: the system coefficient is the effect averaged over both positions.
        formula = "log_time ~ C(system, Treatment('traditional')) * C(position, Sum) + C(dataset, Sum)"
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                fit = smf.mixedlm(formula, d, groups=d["participant"]).fit(reml=True)
            term = "C(system, Treatment('traditional'))[T.predicate]"
            pv = fit.pvalues
            pick = lambda pred: float(min((v for k, v in pv.items() if pred(k)), default=math.nan))  # noqa: E731
            ci = fit.conf_int().loc[term]
            rows.append(
                {
                    **row,
                    "time_ratio_predicate": float(np.exp(fit.params[term])),
                    "ratio_ci": (float(np.exp(ci[0])), float(np.exp(ci[1]))),
                    "p_system": float(pv[term]),
                    "p_position": pick(lambda k: k.startswith("C(position")),
                    "p_system_x_position": pick(lambda k: ":" in k),
                    "p_dataset": pick(lambda k: k.startswith("C(dataset")),
                    "note": "" if fit.converged else "did not converge",
                }
            )
        except Exception as e:  # noqa: BLE001 - report, don't crash
            rows.append({**row, "note": f"model failed: {e}"})
    return pd.DataFrame(rows)


# Exclusion thresholds for the threshold sensitivity analysis: the registered rule (more than 10 %
# of the required items wrong) and absolute error counts. With 8-12 required items, the registered
# rule keeps only exact attempts in Tasks A, B and D, so the results are repeated with looser rules.
ERROR_RULES: list[tuple[str, int | None]] = [
    ("registered: > 10 % wrong", None),
    ("> 1 error", 1),
    ("> 2 errors", 2),
    ("> 3 errors", 3),
    ("no rule", -1),
]


def _rule_ok(limit: int | None) -> Callable[[pd.DataFrame], pd.Series]:
    if limit is None:
        return lambda d: ~d["excludedForErrors"]
    if limit < 0:
        return lambda d: d["errors"] >= 0
    return lambda d: d["errors"] <= limit


def threshold_sensitivity(a: pd.DataFrame) -> pd.DataFrame:
    """Time and gestures under each exclusion rule (Holm across Tasks B-D within each rule and measure)."""
    rows = []
    if a.empty:
        return pd.DataFrame()
    for name, limit in ERROR_RULES:
        ok = _rule_ok(limit)
        measures = [
            Measure("time", "time_rank_s", "Completion time", "lower", lambda d, ok=ok: d["skipped"] | ok(d), "s"),
            Measure("gestures", "gestures", "Gestures", "lower", lambda d, ok=ok: d["completed"] & ok(d)),
        ]
        res = compare_measures(a, measures)
        for x in res.itertuples():
            d = a[(a["task"] == x.task) & a["completed"]]
            excluded = {sys_: int((~ok(d[d["system"] == sys_])).sum()) for sys_ in SYSTEMS}
            rows.append(
                {
                    "rule": name,
                    "measure": x.measure,
                    "task": x.task,
                    "excluded_predicate": excluded["predicate"],
                    "excluded_traditional": excluded["traditional"],
                    "n": x.n,
                    "median_predicate": x.median_predicate,
                    "median_traditional": x.median_traditional,
                    "r": x.r,
                    "p_holm": x.p_holm,
                }
            )
    return pd.DataFrame(rows)


def sensitivity(t: Tables, a: pd.DataFrame) -> dict:
    """Time comparisons without participants who know the experimenter; results per baseline preset."""
    s = t.sessions
    out: dict = {}
    if a.empty or s.empty:
        return {"strangers": pd.DataFrame(), "all_attempts": pd.DataFrame(), "by_baseline": pd.DataFrame(), "thresholds": pd.DataFrame()}
    knows = set(s.loc[_bool(s["knowsExperimenter"].fillna(False)), "participant"])
    strangers = a[~a["participant"].isin(knows)]
    out["strangers"] = compare_measures(strangers, [MEASURES[0]])
    # Without the 10 % exclusion rule: in Task A the traditional system's typical failure (orange items
    # lost = 3 of 9 required items wrong) is exactly what the rule excludes from the time comparison.
    no_rule = Measure("time", "time_rank_s", "Completion time, all attempts", "lower", None, "s")
    out["all_attempts"] = compare_measures(a, [no_rule])
    out["n_knows"] = len(knows & included(t))
    base = s.set_index("participant")["baseline"]
    rows = []
    for task in CORE_TASKS:
        w = paired(a, task, "time_rank_s", MEASURES[0].mask)
        w = w.join(base, how="left")
        for preset, g in w.groupby("baseline"):
            rows.append(
                {
                    "task": task,
                    "baseline": preset,
                    "n": len(g),
                    "median_predicate": float(g["predicate"].median()),
                    "median_traditional": float(g["traditional"].median()),
                }
            )
    out["by_baseline"] = pd.DataFrame(rows)
    out["thresholds"] = threshold_sensitivity(a)
    return out


STRATEGIES = {
    "usedFilter": "search (filter)",
    "usedPredicateSelect": "select matching",
    "usedPredicateDeselect": "deselect matching",
    "usedNavigate": "folder navigation",
    "usedViewSwitch": "view switch",
    "usedDrag": "drag",
    "usedShiftClick": "Shift-click",
    "usedCtrlClick": "Ctrl/⌘-click",
    "usedKeyboard": "keyboard",
    "usedSelectAll": "select all",
    "usedShowSelectedOnly": "show selected only",
}


def strategies(a: pd.DataFrame) -> pd.DataFrame:
    """Share of attempts that used each feature, per task and system."""
    if a.empty:
        return pd.DataFrame()
    cols = [c for c in STRATEGIES if c in a.columns]
    g = a.groupby(["task", "system"])[cols].mean().reset_index()
    g["n"] = a.groupby(["task", "system"]).size().to_numpy()
    g = g.sort_values(["task", "system"], key=_task_order).reset_index(drop=True)
    return g.rename(columns=STRATEGIES)


def _task_order(col: pd.Series) -> pd.Series:
    return col.map({t: i for i, t in enumerate(CORE_TASKS)}) if col.name == "task" else col


def quality(t: Tables, a: pd.DataFrame) -> dict:
    s = t.sessions
    if s.empty:
        return {"sessions": 0}
    pilot = _bool(s["pilot"])
    real = s[~pilot]
    completed = _bool(real["completed"])
    minutes = real.loc[completed, "sessionMs"] / 60000.0
    q = {
        "sessions": int(len(s)),
        "pilot": int(pilot.sum()),
        "included": int(len(real)),
        "completed": int(completed.sum()),
        "stopped": real.loc[~completed, ["participant", "stoppedAt"]].to_dict("records"),
        "groups": real.loc[completed, "group"].value_counts().sort_index().to_dict(),
        "baselines": real["baseline"].value_counts().to_dict(),
        "languages": real["language"].value_counts().to_dict(),
        "session_minutes_median": float(minutes.median()) if len(minutes) else math.nan,
        "session_minutes_max": float(minutes.max()) if len(minutes) else math.nan,
        "share_within_target": float((minutes <= SESSION_TARGET_MIN).mean()) if len(minutes) else math.nan,
        "versions": real["version"].value_counts().to_dict(),
        "commits": real["commit"].value_counts().to_dict(),
        "other_viewports": int(
            (((real["viewportWidth"] - STUDY_VIEWPORT[0]).abs() > VIEWPORT_SLACK) | ((real["viewportHeight"] - STUDY_VIEWPORT[1]).abs() > VIEWPORT_SLACK)).sum()
        ),
        "issues_error": [],
        "issues_warning": 0,
    }
    if not t.issues.empty:
        iss = t.issues[t.issues["participant"].isin(set(real["participant"])) | ~t.issues["participant"].isin(set(s["participant"]))]
        q["issues_error"] = iss[iss["severity"] == "error"][["participant", "message"]].to_dict("records")
        q["issues_warning"] = int((iss["severity"] == "warning").sum())
    if not a.empty:
        g = a.groupby(["task", "system"])
        q["per_task"] = pd.DataFrame(
            {
                "attempts": g.size(),
                "skipped": g["skipped"].sum(),
                "excluded_for_errors": g.apply(lambda d: int((d["excludedForErrors"] & ~d["skipped"]).sum()), include_groups=False),
            }
        ).reset_index().sort_values(["task", "system"], key=_task_order)
    return q


# ---------------------------------------------------------------------------
# Everything
# ---------------------------------------------------------------------------


@dataclass
class Results:
    tables: Tables
    attempts: pd.DataFrame
    measures: pd.DataFrame
    binary: pd.DataFrame
    keep_lost: dict
    tutorial: dict
    questionnaire: dict
    mixed: pd.DataFrame
    sensitivity: dict
    strategies: pd.DataFrame
    quality: dict
    alpha: float


def analyse(t: Tables, alpha: float = 0.05) -> Results:
    a = attempts(t)
    return Results(
        tables=t,
        attempts=a,
        measures=compare_measures(a),
        binary=compare_binary(a),
        keep_lost=keep_lost(a, t.sessions.set_index("participant")["baseline"] if not t.sessions.empty and "baseline" in t.sessions else None),
        tutorial=tutorial(t),
        questionnaire=questionnaire(t),
        mixed=mixed_models(a),
        sensitivity=sensitivity(t, a),
        strategies=strategies(a),
        quality=quality(t, a),
        alpha=alpha,
    )


def hypotheses(r: Results) -> list[dict]:
    """Verdict per pre-registered hypothesis (methodology §2)."""
    alpha = r.alpha

    def m(measure: str, task: str) -> dict:
        rows = r.measures[(r.measures["measure"] == measure) & (r.measures["task"] == task)]
        return rows.iloc[0].to_dict() if len(rows) else {"p_holm": math.nan, "n": 0}

    def b(measure: str, task: str) -> dict:
        rows = r.binary[(r.binary["measure"] == measure) & (r.binary["task"] == task)]
        return rows.iloc[0].to_dict() if len(rows) else {"p_holm": math.nan, "n": 0}

    def sig(p: float) -> bool:
        return not math.isnan(p) and p < alpha

    def verdict(ps: list[float]) -> str:
        if all(math.isnan(p) for p in ps):
            return "no data"
        return "supported" if all(sig(p) for p in ps) else ("partly" if any(sig(p) for p in ps) else "not supported")

    fmt = lambda p: "n/a" if p is None or (isinstance(p, float) and math.isnan(p)) else f"{p:.3f}"  # noqa: E731
    h0 = r.tutorial.get("h0", {})
    h1 = r.tutorial.get("h1", {})
    q = r.questionnaire
    kl_a = r.keep_lost[CORE_TASKS[0]]
    kl_d = r.keep_lost[CORE_TASKS[3]]

    def same(ps: list[float]) -> str:
        """Verdict for a no-difference hypothesis (two-sided tests): H1, H2."""
        if all(math.isnan(p) for p in ps):
            return "no data"
        return "difference detected" if any(sig(p) for p in ps) else "no difference detected"
    rows = [
        {
            "id": "H0",
            "hypothesis": f"Predicate tutorial takes longer, but < {TUTORIAL_TARGET_S:.0f} s on average",
            "evidence": f"mean {h0.get('mean_predicate', math.nan):.0f} s; p(<{TUTORIAL_TARGET_S:.0f} s) = {fmt(h0.get('p_below_target'))}; p(longer) = {fmt(h0.get('p_longer'))}",
            "verdict": verdict([h0.get("p_below_target", math.nan), h0.get("p_longer", math.nan)]),
        },
        {
            "id": "H1",
            "hypothesis": "Warm-up: no meaningful difference in time or gestures",
            "evidence": "; ".join(f"{k}: p = {fmt(v.p)}, r = {v.r:+.2f}" for k, v in h1.items()) if h1 else "no data",
            "verdict": "no data"
            if not h1 or all(math.isnan(v.p) for v in h1.values())
            else ("difference detected" if any(sig(v.p) for v in h1.values()) else "no difference detected"),
        },
        {
            "id": "H2",
            "hypothesis": "Task A (baseline): no meaningful difference in lost pre-selections or time",
            "evidence": f"kept lost p (two-sided) = {fmt(kl_a['count'].p)}; any lost p = {fmt(kl_a['kept_all'].p)}; time p (two-sided) = {fmt(m('time', CORE_TASKS[0])['p'])}",
            "verdict": same([kl_a["count"].p, kl_a["kept_all"].p, m("time", CORE_TASKS[0])["p"]]),
        },
        {
            "id": "H3",
            "hypothesis": "Task B: lower time and gestures, higher completion",
            "evidence": f"time p(Holm) = {fmt(m('time', CORE_TASKS[1])['p_holm'])}; gestures p(Holm) = {fmt(m('gestures', CORE_TASKS[1])['p_holm'])}; completion p(Holm) = {fmt(b('completion', CORE_TASKS[1])['p_holm'])}",
            "verdict": verdict([m("time", CORE_TASKS[1])["p_holm"], m("gestures", CORE_TASKS[1])["p_holm"], b("completion", CORE_TASKS[1])["p_holm"]]),
        },
        {
            "id": "H4",
            "hypothesis": "Task C: higher exact-match rate and lower time",
            "evidence": f"exact p(Holm) = {fmt(b('exact', CORE_TASKS[2])['p_holm'])}; time p(Holm) = {fmt(m('time', CORE_TASKS[2])['p_holm'])}",
            "verdict": verdict([b("exact", CORE_TASKS[2])["p_holm"], m("time", CORE_TASKS[2])["p_holm"]]),
        },
        {
            "id": "H5",
            "hypothesis": "Predicate less frustrating, at least as adequate, preferred by the majority",
            "evidence": f"frustrating p = {fmt(q['frustrating'].p)}; sufficient p (two-sided) = {fmt(q['sufficient'].p)}, favours {q['sufficient'].favours()}; preference {q['preference'].k}/{q['preference'].n}, p = {fmt(q['preference'].p)}",
            "verdict": verdict([q["frustrating"].p, q["preference"].p])
            if not (sig(q["sufficient"].p) and q["sufficient"].r < 0)
            else "not supported (less adequate)",
        },
        {
            "id": "H6",
            "hypothesis": "Task D: fewer attempts that lose a pre-selected file, higher exact-match rate",
            "evidence": f"any kept lost p = {fmt(kl_d['kept_all'].p)} (kept all: {kl_d['kept_all'].rate_predicate:.0%} vs {kl_d['kept_all'].rate_traditional:.0%}, n = {kl_d['kept_all'].n}); exact p(Holm) = {fmt(b('exact', CORE_TASKS[3])['p_holm'])}"
            if kl_d["kept_all"].n
            else "no data",
            "verdict": verdict([kl_d["kept_all"].p, b("exact", CORE_TASKS[3])["p_holm"]]),
        },
    ]
    return rows
