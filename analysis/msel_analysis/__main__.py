"""python -m msel_analysis <root> [--alpha 0.05] [--no-figures]

Reads <root>/tables/*.csv and writes <root>/report.md, <root>/results/*.csv
and <root>/figures/.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from .analysis import analyse, hypotheses, load_tables


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="msel_analysis", description=__doc__.splitlines()[0])
    ap.add_argument("root", type=Path, help="folder with tables/ (written by scripts/analysis/extract.ts)")
    ap.add_argument("--alpha", type=float, default=0.05)
    ap.add_argument("--no-figures", action="store_true")
    args = ap.parse_args(argv)

    tables = load_tables(args.root)
    if tables.sessions.empty:
        print(f"No study sessions in {args.root / 'tables'}; nothing to analyse.")
        return 1
    results = analyse(tables, alpha=args.alpha)

    res_dir = args.root / "results"
    res_dir.mkdir(parents=True, exist_ok=True)
    results.measures.to_csv(res_dir / "paired_measures.csv", index=False)
    results.binary.to_csv(res_dir / "binary_measures.csv", index=False)
    results.mixed.to_csv(res_dir / "mixed_models.csv", index=False)
    results.strategies.to_csv(res_dir / "strategies.csv", index=False)
    if isinstance(results.sensitivity.get("thresholds"), pd.DataFrame):
        results.sensitivity["thresholds"].to_csv(res_dir / "threshold_sensitivity.csv", index=False)
    pd.DataFrame(hypotheses(results)).to_csv(res_dir / "hypotheses.csv", index=False)

    figures = None
    if not args.no_figures:
        from .figures import all_figures

        figures = all_figures(results, args.root / "figures")

    from .report import render

    (args.root / "report.md").write_text(render(results, figures, source=str(args.root / "tables")), encoding="utf-8")
    for h in hypotheses(results):
        print(f"{h['id']}: {h['verdict']}")
    print(f"Report: {args.root / 'report.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
