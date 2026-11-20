"""Paired tests, effect sizes and multiplicity correction (methodology §14).

Conventions: every comparison is oriented so that a *positive* difference or
effect size favours the predicate system ("better" = lower time, fewer
gestures or errors, higher ease rating ...).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from scipy import stats

BOOTSTRAP = 2000
SEED = 20260924


def rank_biserial(d: np.ndarray) -> float:
    """Matched-pairs rank-biserial correlation of differences ``d`` (zeros dropped).

    +1: every non-zero difference is positive; -1: every one is negative.
    """
    d = np.asarray(d, dtype=float)
    d = d[d != 0]
    if d.size == 0:
        return 0.0
    ranks = stats.rankdata(np.abs(d))
    total = ranks.sum()
    return float((ranks[d > 0].sum() - ranks[d < 0].sum()) / total)


def bootstrap_ci(d: np.ndarray, statistic, n: int = BOOTSTRAP, seed: int = SEED) -> tuple[float, float]:
    """Percentile bootstrap 95 % CI of ``statistic(d)`` over resampled participants."""
    d = np.asarray(d, dtype=float)
    if d.size < 3:
        return (math.nan, math.nan)
    rng = np.random.default_rng(seed)
    values = [statistic(d[rng.integers(0, d.size, d.size)]) for _ in range(n)]
    lo, hi = np.percentile(values, [2.5, 97.5])
    return (float(lo), float(hi))


@dataclass
class PairedResult:
    """Wilcoxon signed-rank comparison of paired values (one pair per participant)."""

    n: int
    median_predicate: float
    median_traditional: float
    iqr_predicate: tuple[float, float]
    iqr_traditional: tuple[float, float]
    #: Median of the differences, oriented so that positive favours the predicate system.
    median_difference: float
    statistic: float
    p: float
    #: Rank-biserial correlation (positive favours the predicate system) and its bootstrap 95 % CI.
    r: float
    r_ci: tuple[float, float]
    #: Standardised mean difference of the oriented differences (Cohen's d_z).
    dz: float
    alternative: str
    p_holm: float = math.nan
    note: str = ""

    def favours(self) -> str:
        if self.r > 0:
            return "predicate"
        if self.r < 0:
            return "traditional"
        return "neither"


def _quartiles(x: np.ndarray) -> tuple[float, float]:
    if x.size == 0:
        return (math.nan, math.nan)
    q1, q3 = np.percentile(x, [25, 75])
    return (float(q1), float(q3))


def wilcoxon_paired(predicate, traditional, better: str = "lower", alternative: str = "greater") -> PairedResult:
    """Paired comparison of the two systems.

    ``better``: "lower" (time, gestures, errors) or "higher" (ease ratings).
    ``alternative``: "greater" = directional (predicate better), or "two-sided".
    """
    p_ = np.asarray(predicate, dtype=float)
    t_ = np.asarray(traditional, dtype=float)
    if p_.shape != t_.shape:
        raise ValueError("paired samples must have the same length")
    d = (t_ - p_) if better == "lower" else (p_ - t_)
    n = int(d.size)
    base = dict(
        n=n,
        median_predicate=float(np.median(p_)) if n else math.nan,
        median_traditional=float(np.median(t_)) if n else math.nan,
        iqr_predicate=_quartiles(p_),
        iqr_traditional=_quartiles(t_),
        median_difference=float(np.median(d)) if n else math.nan,
        alternative=alternative,
    )
    if n < 2:
        return PairedResult(**base, statistic=math.nan, p=math.nan, r=math.nan, r_ci=(math.nan, math.nan), dz=math.nan, note="too few pairs")
    sd = float(np.std(d, ddof=1))
    dz = float(np.mean(d) / sd) if sd > 0 else 0.0
    if np.all(d == 0):
        return PairedResult(**base, statistic=math.nan, p=1.0, r=0.0, r_ci=(0.0, 0.0), dz=0.0, note="all differences zero")
    res = stats.wilcoxon(d, alternative=alternative, zero_method="wilcox")
    return PairedResult(
        **base,
        statistic=float(res.statistic),
        p=float(res.pvalue),
        r=rank_biserial(d),
        r_ci=bootstrap_ci(d, rank_biserial),
        dz=dz,
    )


@dataclass
class McNemarResult:
    """Exact McNemar test on paired success/failure (one pair per participant)."""

    n: int
    rate_predicate: float
    rate_traditional: float
    #: Discordant pairs: success only with the predicate system (b) / only with the traditional one (c).
    b: int
    c: int
    p: float
    alternative: str
    p_holm: float = math.nan

    def favours(self) -> str:
        return "predicate" if self.b > self.c else "traditional" if self.c > self.b else "neither"


def mcnemar_exact(predicate_success, traditional_success, alternative: str = "greater") -> McNemarResult:
    """Exact (binomial) McNemar test; "greater" = predicate succeeds more often."""
    p_ = np.asarray(predicate_success, dtype=bool)
    t_ = np.asarray(traditional_success, dtype=bool)
    b = int(np.sum(p_ & ~t_))
    c = int(np.sum(~p_ & t_))
    n = int(p_.size)
    p = float(stats.binomtest(b, b + c, 0.5, alternative=alternative).pvalue) if b + c > 0 else 1.0
    return McNemarResult(
        n=n,
        rate_predicate=float(p_.mean()) if n else math.nan,
        rate_traditional=float(t_.mean()) if n else math.nan,
        b=b,
        c=c,
        p=p if n else math.nan,
        alternative=alternative,
    )


@dataclass
class BinomialResult:
    k: int
    n: int
    share: float
    p: float
    ci: tuple[float, float] = field(default=(math.nan, math.nan))


def binomial_share(k: int, n: int, alternative: str = "greater") -> BinomialResult:
    """Share k/n against 50 % (e.g. participants preferring the predicate system)."""
    if n == 0:
        return BinomialResult(k=0, n=0, share=math.nan, p=math.nan)
    res = stats.binomtest(k, n, 0.5, alternative=alternative)
    ci = res.proportion_ci(confidence_level=0.95, method="exact")
    return BinomialResult(k=k, n=n, share=k / n, p=float(res.pvalue), ci=(float(ci.low), float(ci.high)))


def holm(pvalues) -> list[float]:
    """Holm-Bonferroni adjusted p-values (NaN entries are left out and stay NaN)."""
    p = [float(x) for x in pvalues]
    idx = [i for i, x in enumerate(p) if not math.isnan(x)]
    order = sorted(idx, key=lambda i: p[i])
    m = len(order)
    adjusted = [math.nan] * len(p)
    running = 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (m - rank) * p[i]))
        adjusted[i] = running
    return adjusted
