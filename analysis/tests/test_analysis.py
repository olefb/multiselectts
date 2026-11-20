"""End-to-end tests of the analysis on small synthetic tables."""

import dataclasses
import math

import numpy as np
import pandas as pd

from msel_analysis.analysis import CORE_TASKS, Tables, analyse, attempts, hypotheses
from msel_analysis.report import render


def make_tables(n=12, effect=True, seed=1) -> Tables:
    rng = np.random.default_rng(seed)
    sessions, tasks, blocks, answers = [], [], [], []
    for i in range(n):
        p = f"P-{i:04d}"
        first = "predicate" if i % 2 == 0 else "traditional"
        order = [first, "traditional" if first == "predicate" else "predicate"]
        sessions.append(dict(participant=p, pilot=i == n - 1, completed=True, group=f"G{i % 4 + 1}", baseline="windows",
                             knowsExperimenter=i % 3 == 0, sessionMs=540000 + 1000 * i, preferredSystem="predicate" if effect or i % 2 else "traditional",
                             lostSelectionSystem="none", language="en", version="v", commit="c", viewportWidth=1280, viewportHeight=800,
                             stoppedAt=None))
        for block, system in enumerate(order):
            slow = 2.0 if (effect and system == "traditional") else 1.0
            blocks.append(dict(participant=p, block=block, label="AB"[block], system=system, model="algebraic" if system == "predicate" else "windows",
                               dataset=f"d{block}", tutorialMs=60000 if block == 0 else 10000, tutorialSteps=4, tutorialSkipped=False,
                               warmupMs=6000, warmupActiveMs=5000 + rng.normal(0, 300), warmupGestures=3,
                               sufficient=6 if system == "predicate" else 5, frustrating=2 if (effect and system == "predicate") else 4))
            for task in CORE_TASKS:
                t = 20000 * slow * rng.lognormal(0, 0.2)
                tasks.append(dict(participant=p, group="G1", block=block, label="AB"[block], system=system, model="x", dataset=f"d{block}",
                                  kind="task", task=task, reason="done", durationMs=t + 2000, activeMs=t, gestures=int(5 * slow),
                                  exact=True, missing=0, extra=0, keepLost=0, errorRate=0.0, excludedForErrors=False,
                                  itemsReselected=0, usedDrag=False))
                answers.append(dict(participant=p, question="seq", value=6 if slow == 1 else 4, block=block, label="AB"[block], system=system, task=task))
    empty = pd.DataFrame()
    return Tables(pd.DataFrame(sessions), pd.DataFrame(tasks), pd.DataFrame(blocks), pd.DataFrame(answers), empty, empty)


def test_detects_a_clear_effect_and_excludes_pilots():
    r = analyse(make_tables(n=13))
    assert r.attempts["participant"].nunique() == 12  # the pilot is left out
    time = r.measures[r.measures["measure"] == "time"]
    assert (time["p_holm"] < 0.05).all()
    assert (time["r"] > 0.8).all()
    verdicts = {h["id"]: h["verdict"] for h in hypotheses(r)}
    assert verdicts["H1"] == "no difference detected"
    assert verdicts["H3"] in ("partly", "supported")


def test_no_effect_is_not_significant():
    r = analyse(make_tables(n=13, effect=False, seed=5))
    time = r.measures[r.measures["measure"] == "time"]
    assert (time["p_holm"] > 0.05).all()


def test_skipped_attempts_rank_as_slowest_and_errors_exclude():
    t = make_tables()
    t.tasks.loc[0, ["reason", "activeMs"]] = ["skipped", 1000.0]
    t.tasks.loc[1, ["excludedForErrors", "missing"]] = [True, 3]
    a = attempts(t)
    skipped = a[a["skipped"]].iloc[0]
    others = a[(a["task"] == skipped["task"]) & ~a["skipped"]]
    assert skipped["time_rank_s"] > others["time_s"].max()
    r = analyse(t)
    n_time = r.measures.set_index(["measure", "task"]).loc[("time", t.tasks.loc[1, "task"]), "n"]
    assert n_time == 10  # 11 non-pilot participants; the excluded attempt's pair is dropped


def test_report_renders_even_for_tiny_data():
    r = analyse(make_tables(n=2))
    md = render(r)
    assert "# Study analysis report" in md and "## Hypotheses" in md
    assert all(isinstance(h["verdict"], str) for h in hypotheses(r))


def test_empty_tables_do_not_crash():
    empty = pd.DataFrame()
    t = Tables(pd.DataFrame([dict(participant="P-1", pilot=False, completed=False, group="G1", baseline=None, knowsExperimenter=False,
                                  sessionMs=math.nan, preferredSystem=None, lostSelectionSystem=None, language="en", version="v",
                                  commit="c", viewportWidth=1280, viewportHeight=800, stoppedAt="consent")]), empty, empty, empty, empty, empty)
    r = analyse(t)
    assert "no data" in {h["verdict"] for h in hypotheses(r)}
    render(r)


def test_task_a_is_a_two_sided_baseline_outside_the_holm_family():
    r = analyse(make_tables(n=13))
    m = r.measures[r.measures["measure"] == "time"].set_index("task")
    assert m.loc[CORE_TASKS[0], "alternative"] == "two-sided"
    assert m.loc[CORE_TASKS[0], "p_holm"] == m.loc[CORE_TASKS[0], "p"]
    assert (m.loc[CORE_TASKS[1:], "alternative"] == "greater").all()
    assert set(r.keep_lost) == {"keep-what-you-have", "keep-and-extend"}
    assert r.keep_lost["keep-what-you-have"]["alternative"] == "two-sided"
    assert r.keep_lost["keep-and-extend"]["alternative"] == "greater"
    ids = [h["id"] for h in hypotheses(r)]
    assert "H6" in ids
    # The synthetic tables have a time effect in every task, so the no-difference hypothesis H2 fails.
    assert {h["id"]: h["verdict"] for h in hypotheses(r)}["H2"] == "difference detected"


def test_task_d_detects_lost_pre_selections():
    t = make_tables(n=13)
    d = (t.tasks["task"] == "keep-and-extend") & (t.tasks["system"] == "traditional")
    t.tasks.loc[d, "keepLost"] = 2
    r = analyse(t)
    kl = r.keep_lost["keep-and-extend"]["kept_all"]
    assert kl.rate_predicate == 1.0 and kl.rate_traditional == 0.0
    assert kl.p < 0.05
    assert not r.keep_lost["keep-and-extend"]["by_baseline"].empty
    assert {h["id"]: h["verdict"] for h in hypotheses(r)}["H6"] in ("partly", "supported")


def test_thesis_figures_render_for_data_and_for_empty_tables(tmp_path):
    from msel_analysis.figures import thesis_figures

    for name, tables in [("data", make_tables()), ("empty", Tables(*[pd.DataFrame()] * 6))]:
        out = tmp_path / name / "thesis"
        files = thesis_figures(analyse(tables), out)
        assert set(files) == {"thesis_time", "thesis_gestures", "thesis_strategies", "thesis_questionnaire"}
        for paths in files.values():
            assert all((tmp_path / name / p).stat().st_size > 0 for p in paths)
    svg = (tmp_path / "data" / "thesis" / "time_paired.svg").read_text(encoding="utf-8")
    assert "Unified" in svg and "Traditional" in svg  # labels stay text, so Typst sets them in the thesis font


def test_threshold_sensitivity_keeps_every_pair_without_a_rule():
    t = make_tables()
    tasks = t.tasks.copy()
    tasks.loc[0, ["missing", "excludedForErrors"]] = [2, True]  # one attempt with two errors
    t = dataclasses.replace(t, tasks=tasks)
    th = analyse(t).sensitivity["thresholds"]
    assert list(dict.fromkeys(th["rule"])) == ["registered: > 10 % wrong", "> 1 error", "> 2 errors", "> 3 errors", "no rule"]
    task0 = tasks.loc[0, "task"]
    n = th[(th["measure"] == "time") & (th["task"] == task0)].set_index("rule")["n"]
    assert n["registered: > 10 % wrong"] == n["> 1 error"] == 10 and n["> 2 errors"] == n["no rule"] == 11
