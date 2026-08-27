#!/usr/bin/env python3
"""Verification pass over the assembled PBJ tables. Prints PASS/FAIL per check."""

import calendar
import glob
import os

import pandas as pd

BASE = os.path.dirname(os.path.abspath(__file__))
PARTS, OUT = os.path.join(BASE, "parts"), os.path.join(BASE, "out")

NURSE_CATS = ["rndon", "rnadmin", "rn", "lpnadmin", "lpn", "cna", "natrn", "medaide"]
NONNURSE_CATS = [
    "admin", "meddir", "othmd", "pa", "np", "clinnrsspec", "pharmacist",
    "dietician", "feedasst", "ot", "otasst", "otaide", "pt", "ptasst",
    "ptaide", "respther", "resptech", "spclangpath", "therrecspec",
    "qualactvprof", "othactv", "qualsocwrk", "othsocwrk", "mhsvc",
]
results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  -- {detail}" if detail else ""))


def qdays(q):
    y, n = int(q[:4]), int(q[-1])
    return sum(calendar.monthrange(y, m)[1]
               for m in {1: (1, 2, 3), 2: (4, 5, 6), 3: (7, 8, 9),
                         4: (10, 11, 12)}[n])


def main():
    atlas = pd.read_parquet(os.path.join(OUT, "pbj_atlas_facility_quarter.parquet"))
    nurse = pd.read_parquet(os.path.join(OUT, "pbj_nurse_facility_quarter.parquet"))
    nonnurse = pd.read_parquet(
        os.path.join(OUT, "pbj_nonnurse_facility_quarter.parquet"))

    # 1. Coverage: every quarter 2017Q1-2026Q1 present exactly once per facility.
    quarters = sorted(atlas.cy_qtr.unique())
    expected = [f"{y}Q{q}" for y in range(2017, 2027) for q in (1, 2, 3, 4)]
    expected = [q for q in expected if "2017Q1" <= q <= "2026Q1"]
    check("all 37 quarters present, no gaps",
          quarters == expected, f"{len(quarters)} quarters, {quarters[0]}..{quarters[-1]}")
    check("no duplicate facility-quarter keys",
          not atlas.duplicated(["provnum", "cy_qtr"]).any())

    # 2. PROVNUM integrity -- leading zeros are meaningful and must survive.
    bad = atlas.loc[atlas.provnum.str.len() != 6, "provnum"]
    check("PROVNUM is 6 characters throughout", bad.empty,
          f"{atlas.provnum.nunique():,} distinct CCNs; "
          f"{(atlas.provnum.str[0] == '0').sum():,} rows start with a zero")

    # 3. Arithmetic: employee + contract must reconcile to total, every category.
    worst = []
    for df, cats in ((nurse, NURSE_CATS), (nonnurse, NONNURSE_CATS)):
        for c in cats:
            gap = (df[f"hrs_{c}__cms"] - df[f"hrs_{c}_emp__cms"]
                   - df[f"hrs_{c}_ctr__cms"]).abs().sum()
            tot = df[f"hrs_{c}__cms"].sum()
            worst.append((c, gap / tot if tot else 0.0))
    worst.sort(key=lambda x: -x[1])
    check("employee + contract reconciles to total (all 32 categories)",
          worst[0][1] < 1e-4,
          f"largest relative gap {worst[0][1]:.2e} ({worst[0][0]}) -- float32 rounding")

    # 4. No silently-empty category: a category that is zero in one quarter but
    #    material in its neighbours means a missed rename.
    holes = []
    for df, cats, label in ((nurse, NURSE_CATS, "nurse"),
                            (nonnurse, NONNURSE_CATS, "nonnurse")):
        by_q = df.groupby("cy_qtr")[[f"hrs_{c}__cms" for c in cats]].sum()
        for c in cats:
            s = by_q[f"hrs_{c}__cms"]
            if s.max() > 0:
                zero_qs = s[s == 0].index.tolist()
                if zero_qs:
                    holes.append(f"{label}.{c}: {zero_qs}")
    check("no category drops to zero in an isolated quarter", not holes,
          "; ".join(holes) if holes else "checked 32 categories x 37 quarters")

    # 5. Reporting completeness: days_reported should equal the calendar quarter.
    atlas["_qd"] = atlas.cy_qtr.map(qdays)
    over = (atlas.days_reported > atlas._qd).sum()
    full = (atlas.days_reported == atlas._qd).mean()
    check("no facility reports more days than the quarter holds", over == 0,
          f"{full:.1%} of facility-quarters report the full quarter")

    # 6. Plausibility against CMS-published national staffing levels.
    nat = atlas.groupby("cy_qtr").apply(
        lambda g: pd.Series({
            "total_nurse_hprd": g.total_nurse_hours.sum() / g.resident_days.sum(),
            "rn_hprd": g.rn_hours.sum() / g.resident_days.sum(),
        }), include_groups=False)
    tn, rn = nat.total_nurse_hprd, nat.rn_hprd
    check("national total nurse HPRD in the published 3.0-4.5 band",
          bool(tn.between(3.0, 4.5).all()), f"range {tn.min():.2f}-{tn.max():.2f}")
    check("national RN HPRD in the published 0.4-0.9 band",
          bool(rn.between(0.4, 0.9).all()), f"range {rn.min():.2f}-{rn.max():.2f}")

    # 7. Agency share must be a share.
    ag = atlas.agency_pct_all_staff.dropna()
    check("agency share bounded 0-100%", bool(ag.between(0, 100).all()),
          f"median {ag.median():.1f}%, p95 {ag.quantile(.95):.1f}%")

    # 8. Nurse and non-nurse cover the same facility-quarters.
    check("nurse and non-nurse tables align on facility-quarter",
          len(nurse) == len(nonnurse) == len(atlas),
          f"{len(atlas):,} rows each")

    # 9. Census denominator consistency.
    check("resident days only counted on census days",
          bool((atlas.days_with_census <= atlas.days_reported).all()),
          f"{int((atlas.days_reported - atlas.days_with_census).sum()):,} "
          f"zero-census facility-days excluded from HPRD denominators")

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
