"""Markdown report of a Results object."""

from __future__ import annotations

import math
from datetime import datetime, timezone

import pandas as pd

from .analysis import CORE_TASKS, MEASURES, STUDY_VIEWPORT, TASK_LABEL, TUTORIAL_TARGET_S, Results, hypotheses


def _f(x, digits: int = 1) -> str:
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "–"
    if isinstance(x, (int,)) and not isinstance(x, bool):
        return str(x)
    return f"{x:.{digits}f}"


def _p(p) -> str:
    if p is None or (isinstance(p, float) and math.isnan(p)):
        return "–"
    return "< .001" if p < 0.001 else f"{p:.3f}".replace("0.", ".", 1)


def _range(t, digits: int = 1) -> str:
    if not isinstance(t, (tuple, list)):  # a missing interval (NaN), e.g. a task whose model was not fitted
        return "[–, –]"
    return f"[{_f(t[0], digits)}, {_f(t[1], digits)}]"


def _table(headers: list[str], rows: list[list[str]]) -> str:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    out += ["| " + " | ".join(str(c) for c in row) + " |" for row in rows]
    return "\n".join(out) + "\n"


def _mark(p, alpha) -> str:
    return " *" if p is not None and not (isinstance(p, float) and math.isnan(p)) and p < alpha else ""


def render(r: Results, figures: dict[str, list[str]] | None = None, source: str = "") -> str:
    a = r.alpha
    q = r.quality
    lines: list[str] = []
    add = lines.append
    fig = lambda key: f"\n![{key}](figures/{key}.png)\n" if figures and key in figures else ""  # noqa: E731
    pfig = lambda key: f"\n![{key}](figures/paired_{key}.png)\n" if figures and key in figures else ""  # noqa: E731

    add("# Study analysis report\n")
    add(
        f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
        + (f" from `{source}`" if source else "")
        + f". α = {a}. {q.get('included', 0)} participants ({q.get('completed', 0)} completed sessions), "
        f"pilot sessions excluded ({q.get('pilot', 0)}).\n"
    )
    add("Directional tests are one-sided in the pre-registered direction (predicate system better); "
        "Task A is the baseline task (no difference expected) and is tested two-sided, like the warm-up. "
        "Effect sizes r (matched-pairs rank-biserial) are positive when they favour the predicate system. "
        "`*` marks p < α after Holm correction where applicable.\n")

    # --- Hypotheses
    add("## Hypotheses\n")
    add(_table(["", "Hypothesis", "Evidence", "Verdict"], [[h["id"], h["hypothesis"], h["evidence"], f"**{h['verdict']}**"] for h in hypotheses(r)]))

    # --- Participants and data quality
    add("## Participants and data quality\n")
    if q.get("sessions", 0) == 0:
        add("No study sessions found.\n")
    else:
        add(f"- Sessions: {q['sessions']} ({q['pilot']} pilot, {q['included']} included, {q['completed']} completed).")
        for s in q["stopped"]:
            add(f"  - {s['participant']} stopped at {s['stoppedAt']}.")
        add(f"- Completed sessions per group: {', '.join(f'{g} {n}' for g, n in q['groups'].items()) or '–'}.")
        add(f"- Baseline presets: {', '.join(f'{k} {v}' for k, v in q['baselines'].items()) or '–'}; languages: {', '.join(f'{k} {v}' for k, v in q['languages'].items()) or '–'}.")
        add(f"- Session length (completed): median {_f(q['session_minutes_median'])} min, max {_f(q['session_minutes_max'])} min; "
            f"{_f(100 * q['share_within_target'], 0)} % within 10 min.")
        add(f"- Protocol versions: {q['versions']}; builds: {q['commits']}.")
        if q["other_viewports"]:
            add(f"- **{q['other_viewports']} sessions had a viewport other than {STUDY_VIEWPORT[0]}×{STUDY_VIEWPORT[1]}** "
                "(logs before `study-2.8` stored the viewport at page load, before full screen).")
        add(f"- Data issues: {len(q['issues_error'])} errors, {q['issues_warning']} warnings (see `tables/issues.csv`).")
        for i in q["issues_error"][:20]:
            add(f"  - **{i['participant']}**: {i['message']}")
        add("")
        if "per_task" in q:
            pt = q["per_task"]
            add(_table(["Task", "System", "Attempts", "Skipped", "Excluded (> 10 % wrong)"],
                       [[TASK_LABEL[x.task], x.system, x.attempts, int(x.skipped), x.excluded_for_errors] for x in pt.itertuples()]))
        add(fig("session_length"))

    # --- Paired comparisons
    add("## Core tasks: paired comparisons\n")
    add("Wilcoxon signed-rank per task. Tasks B–D: one-sided, Holm-corrected across these three within each measure; "
        "Task A (baseline): two-sided, uncorrected (the Holm column repeats its p). "
        "Medians with [IQR]; Δ = median of the per-participant differences, oriented so that positive favours the predicate system.\n")
    for m in MEASURES:
        rows = r.measures[r.measures["measure"] == m.key]
        add(f"### {m.label}" + (f" ({m.unit})" if m.unit else "") + "\n")
        add(_table(
            ["Task", "n", "Predicate", "Traditional", "Δ", "r [95 % CI]", "d_z", "p", "p (Holm)"],
            [[TASK_LABEL[x.task], x.n, f"{_f(x.median_predicate)} {_range(x.iqr_predicate)}", f"{_f(x.median_traditional)} {_range(x.iqr_traditional)}",
              _f(x.median_difference), f"{_f(x.r, 2)} {_range(x.r_ci, 2)}", _f(x.dz, 2), _p(x.p), _p(x.p_holm) + _mark(x.p_holm, a)]
             for x in rows.itertuples()],
        ))
        add(pfig(m.key))

    add("### Completion and exact match\n")
    add("Exact McNemar tests (b = success only with the predicate system, c = only with the traditional one).\n")
    add(_table(
        ["Measure", "Task", "n", "Predicate", "Traditional", "b", "c", "p", "p (Holm)"],
        [[x.label, TASK_LABEL[x.task], x.n, f"{_f(100 * x.rate_predicate, 0)} %", f"{_f(100 * x.rate_traditional, 0)} %", x.b, x.c, _p(x.p), _p(x.p_holm) + _mark(x.p_holm, a)]
         for x in r.binary.itertuples()],
    ))

    for task, kl in r.keep_lost.items():
        side = "two-sided" if kl["alternative"] == "two-sided" else "one-sided"
        add(f"### {TASK_LABEL[task]}: pre-selected (kept) items lost at Done ({side})\n")
        add(_table(
            ["Test", "n", "Predicate", "Traditional", "Result", "p"],
            [
                ["Items lost (Wilcoxon)", kl["count"].n, _f(kl["count"].median_predicate), _f(kl["count"].median_traditional), f"r = {_f(kl['count'].r, 2)}", _p(kl["count"].p) + _mark(kl["count"].p, a)],
                ["All kept (McNemar)", kl["kept_all"].n, f"{_f(100 * kl['kept_all'].rate_predicate, 0)} %", f"{_f(100 * kl['kept_all'].rate_traditional, 0)} %",
                 f"b = {kl['kept_all'].b}, c = {kl['kept_all'].c}", _p(kl["kept_all"].p) + _mark(kl["kept_all"].p, a)],
            ],
        ))
        if not kl["by_baseline"].empty:
            add("All kept, per traditional preset (descriptive):\n")
            add(_table(["Preset", "n", "Predicate", "Traditional"],
                       [[x.baseline, x.n, f"{_f(100 * x.kept_all_predicate, 0)} %", f"{_f(100 * x.kept_all_traditional, 0)} %"] for x in kl["by_baseline"].itertuples()]))

    # --- Tutorial
    add("## Tutorial (H0) and warm-up (H1)\n")
    t = r.tutorial
    if t["by_system_position"].empty:
        add("No tutorial data.\n")
    else:
        add(_table(["System", "Block", "n", "Mean (s)", "Median (s)", "Steps", "Skipped"],
                   [[x.system, "A (first)" if x.block == 0 else "B (second)", x.n, _f(x.mean_s), _f(x.median_s), _f(x.steps, 0), int(x.skipped)] for x in t["by_system_position"].itertuples()]))
        h0 = t["h0"]
        add(f"First block (full tutorial): predicate mean {_f(h0['mean_predicate'])} s, 95 % CI {_range(h0['ci_predicate'])} "
            f"(n = {h0['n_predicate']}); below {TUTORIAL_TARGET_S:.0f} s: one-sample Wilcoxon p = {_p(h0['p_below_target'])}. "
            f"Longer than traditional (median {_f(h0['median_traditional'])} s, n = {h0['n_traditional']}): Mann-Whitney p = {_p(h0['p_longer'])}. "
            "The second block's tutorial is shorter by design and not compared.\n")
        add(_table(["Warm-up", "n", "Predicate", "Traditional", "r [95 % CI]", "p (two-sided)"],
                   [[k, v.n, _f(v.median_predicate), _f(v.median_traditional), f"{_f(v.r, 2)} {_range(v.r_ci, 2)}", _p(v.p)] for k, v in t["h1"].items()]))
        add("A non-significant H1 result means *no difference detected*, not equivalence.\n")

    # --- Questionnaires
    add("## Questionnaires (H5)\n")
    qq = r.questionnaire
    add(_table(["Item", "n", "Predicate median", "Traditional median", "r", "p", "Test"],
               [[k, qq[k].n, _f(qq[k].median_predicate), _f(qq[k].median_traditional), _f(qq[k].r, 2), _p(qq[k].p) + _mark(qq[k].p, a), qq[k].alternative]
                for k in ("sufficient", "frustrating")]))
    pc = qq["preference_counts"]
    pr = qq["preference"]
    add(f"Preference: predicate {pc['predicate']}, traditional {pc['traditional']}, no preference {pc['none']}. "
        f"Share preferring the predicate system (excluding no preference): {_f(100 * pr.share, 0)} %, 95 % CI {_range(tuple(100 * x for x in pr.ci), 0)} %, "
        f"binomial p = {_p(pr.p)}{_mark(pr.p, a)}.\n")
    lc = qq["lost_counts"]
    add(f"Self-reported accidental loss of a selection: none {lc['none']}, only predicate {lc['predicate']}, only traditional {lc['traditional']}, both {lc['both']}.\n")
    add(fig("questionnaire"))
    add(fig("preference"))

    # --- Mixed models
    add("## Order and dataset\n")
    add("Linear mixed model per task: log(time) ~ system × position + dataset + (1 | participant). "
        "Time ratio < 1 means the predicate system is faster.\n")
    if r.mixed.empty:
        add("No data.\n")
    else:
        add(_table(["Task", "Participants", "Time ratio [95 % CI]", "p (system)", "p (position)", "p (system × position)", "p (dataset)", "Note"],
                   [[TASK_LABEL[x["task"]], x.get("n_participants", 0), f"{_f(x.get('time_ratio_predicate'), 2)} {_range(x.get('ratio_ci', (math.nan, math.nan)), 2)}",
                     _p(x.get("p_system")), _p(x.get("p_position")), _p(x.get("p_system_x_position")), _p(x.get("p_dataset")), x.get("note", "") if isinstance(x.get("note"), str) else ""]
                    for x in r.mixed.to_dict("records")]))

    # --- Sensitivity
    add("## Sensitivity\n")
    sens = r.sensitivity
    if isinstance(sens.get("strangers"), pd.DataFrame) and not sens["strangers"].empty:
        add(f"Completion time without the {sens.get('n_knows', 0)} participants who know the experimenter:\n")
        add(_table(["Task", "n", "Predicate", "Traditional", "r", "p (Holm)"],
                   [[TASK_LABEL[x.task], x.n, _f(x.median_predicate), _f(x.median_traditional), _f(x.r, 2), _p(x.p_holm) + _mark(x.p_holm, a)] for x in sens["strangers"].itertuples()]))
    if isinstance(sens.get("all_attempts"), pd.DataFrame) and not sens["all_attempts"].empty:
        add("Completion time including attempts with more than 10 % wrong items (no exclusion rule):\n")
        add(_table(["Task", "n", "Predicate", "Traditional", "r", "p (Holm)"],
                   [[TASK_LABEL[x.task], x.n, _f(x.median_predicate), _f(x.median_traditional), _f(x.r, 2), _p(x.p_holm) + _mark(x.p_holm, a)] for x in sens["all_attempts"].itertuples()]))
    th = sens.get("thresholds")
    if isinstance(th, pd.DataFrame) and not th.empty:
        for key, label in (("time", "Completion time (s)"), ("gestures", "Gestures")):
            sub = th[(th["measure"] == key) & th["task"].isin(["context-switch", "rule-with-exceptions"])]
            add(f"{label} in Tasks B and C under different exclusion rules (registered rule first; Holm across Tasks B–D within each rule):\n")
            add(_table(["Rule", "Task", "Excluded (pred./trad.)", "n", "Predicate", "Traditional", "r", "p (Holm)"],
                       [[x.rule, TASK_LABEL[x.task], f"{x.excluded_predicate}/{x.excluded_traditional}", x.n, _f(x.median_predicate), _f(x.median_traditional), _f(x.r, 2), _p(x.p_holm) + _mark(x.p_holm, a)] for x in sub.itertuples()]))
    if isinstance(sens.get("by_baseline"), pd.DataFrame) and not sens["by_baseline"].empty:
        add("Completion time (s) by baseline preset (descriptive):\n")
        add(_table(["Task", "Baseline", "n", "Predicate median", "Traditional median"],
                   [[TASK_LABEL[x.task], x.baseline, x.n, _f(x.median_predicate), _f(x.median_traditional)] for x in sens["by_baseline"].itertuples()]))

    # --- Strategies
    add("## Strategies\n")
    add("Share of attempts that used each feature.\n")
    s = r.strategies
    if s.empty:
        add("No data.\n")
    else:
        feats = [c for c in s.columns if c not in ("task", "system", "n")]
        add(_table(["Task", "System", "n"] + feats,
                   [[TASK_LABEL[row["task"]], row["system"], row["n"]] + [f"{100 * row[f]:.0f} %" for f in feats] for row in s.to_dict("records")]))

    add("## Method notes\n")
    add("- Completion time = first input after Start → Done. Skipped attempts rank as the slowest of their task. "
        "Attempts with > 10 % wrong items are excluded from time (unless skipped) and gesture comparisons.\n"
        "- Gestures = clicks, Ctrl/⌘-clicks, Shift-clicks and drags (one each), selection-changing keys, committed predicate searches, "
        "Select all / Select none buttons.\n"
        "- Accidental clears = required items (targets or orange) that became unselected and were selected again.\n"
        "- Tables: `tables/*.csv` (extracted by `scripts/analysis/extract.ts`); test results: `results/*.csv`.\n")
    return "\n".join(lines) + "\n"
