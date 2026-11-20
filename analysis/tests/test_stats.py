import math

import numpy as np
import pytest
from scipy import stats as sps

from msel_analysis import stats as st


def test_holm_matches_textbook_example():
    # p = .01, .04, .03 → sorted .01 (×3), .03 (×2), .04 (×1), made monotone
    assert st.holm([0.01, 0.04, 0.03]) == pytest.approx([0.03, 0.06, 0.06])
    assert st.holm([0.5, math.nan, 0.01])[1] != st.holm([0.5, math.nan, 0.01])[1]  # NaN stays NaN
    assert st.holm([0.6, 0.7]) == [1.0, 1.0]


def test_rank_biserial_extremes_and_zeros():
    assert st.rank_biserial(np.array([1, 2, 3])) == 1.0
    assert st.rank_biserial(np.array([-1, -2, 0])) == -1.0
    assert st.rank_biserial(np.array([0, 0])) == 0.0
    # ranks of |d| = 1, 2, 3; positive: 2 + 3, negative: 1 → (5 - 1) / 6
    assert st.rank_biserial(np.array([-1, 2, 3])) == pytest.approx(4 / 6)


def test_wilcoxon_is_oriented_towards_the_predicate_system():
    pred = [10, 12, 9, 11, 10, 8, 9, 10]
    trad = [15, 18, 14, 13, 16, 12, 17, 15]
    r = st.wilcoxon_paired(pred, trad, better="lower")
    assert r.r == 1.0 and r.favours() == "predicate"
    assert r.p < 0.01
    assert r.median_difference > 0
    # Same data where higher is better: now the traditional system is better.
    r2 = st.wilcoxon_paired(pred, trad, better="higher")
    assert r2.r == -1.0 and r2.p > 0.99
    # Two-sided p equals scipy's on the raw differences.
    r3 = st.wilcoxon_paired(pred, trad, alternative="two-sided")
    assert r3.p == pytest.approx(sps.wilcoxon(np.subtract(trad, pred)).pvalue)


def test_wilcoxon_edge_cases():
    assert math.isnan(st.wilcoxon_paired([1], [2]).p)
    same = st.wilcoxon_paired([3, 3, 3], [3, 3, 3])
    assert same.p == 1.0 and same.note == "all differences zero"


def test_mcnemar_uses_discordant_pairs_only():
    pred = [True] * 8 + [False] * 2
    trad = [False] * 7 + [True] * 3
    r = st.mcnemar_exact(pred, trad)
    assert (r.b, r.c) == (7, 2)
    assert r.p == pytest.approx(sps.binomtest(7, 9, 0.5, alternative="greater").pvalue)
    assert st.mcnemar_exact([True, True], [True, True]).p == 1.0


def test_binomial_share():
    r = st.binomial_share(20, 26)
    assert r.share == pytest.approx(20 / 26)
    assert r.p < 0.01 and r.ci[0] < r.share < r.ci[1]
    assert math.isnan(st.binomial_share(0, 0).p)
