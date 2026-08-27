#!/usr/bin/env python3
"""
Assemble the facility-quarter parts into CHI Workforce Atlas deliverables.

Outputs (in ./out):
  pbj_nurse_facility_quarter.*      all 8 nurse categories, emp/contract split
  pbj_nonnurse_facility_quarter.*   all 25 non-nurse categories, emp/contract split
  pbj_atlas_facility_quarter.*      Atlas-ready: HPRD + agency-share metrics
  pbj_state_quarter_summary.csv     state x quarter rollup
"""

import calendar
import glob
import json
import os

import pandas as pd

BASE = os.path.dirname(os.path.abspath(__file__))
PARTS = os.path.join(BASE, "parts")
OUT = os.path.join(BASE, "out")

NURSE_CATS = ["rndon", "rnadmin", "rn", "lpnadmin", "lpn", "cna", "natrn", "medaide"]
NONNURSE_CATS = [
    "admin", "meddir", "othmd", "pa", "np", "clinnrsspec", "pharmacist",
    "dietician", "feedasst", "ot", "otasst", "otaide", "pt", "ptasst",
    "ptaide", "respther", "resptech", "spclangpath", "therrecspec",
    "qualactvprof", "othactv", "qualsocwrk", "othsocwrk", "mhsvc",
]

# CMS Five-Star staffing groupings (Technical Users' Guide job codes 5-12).
NURSE_GROUPS = {
    "rn": ["rndon", "rnadmin", "rn"],          # job codes 5, 6, 7
    "lpn": ["lpnadmin", "lpn"],                # job codes 8, 9
    "aide": ["cna", "natrn", "medaide"],       # job codes 10, 11, 12
}
NONNURSE_GROUPS = {
    "therapy": ["ot", "otasst", "otaide", "pt", "ptasst", "ptaide",
                "spclangpath", "respther", "resptech"],
    "physician_apc": ["meddir", "othmd", "pa", "np", "clinnrsspec"],
    "social_activities_mh": ["qualactvprof", "othactv", "qualsocwrk",
                             "othsocwrk", "mhsvc"],
    "clinical_support": ["pharmacist", "dietician", "feedasst"],
    "administration": ["admin"],
}


def quarter_days(cy_qtr):
    year, q = int(cy_qtr[:4]), int(cy_qtr[-1])
    months = {1: (1, 2, 3), 2: (4, 5, 6), 3: (7, 8, 9), 4: (10, 11, 12)}[q]
    return sum(calendar.monthrange(year, m)[1] for m in months)


def load(kind):
    files = sorted(glob.glob(os.path.join(PARTS, f"{kind}_*.parquet")))
    if not files:
        raise SystemExit(f"no parts found for {kind}")
    df = pd.concat((pd.read_parquet(f) for f in files), ignore_index=True)
    # A quarter can appear in more than one published file; keep the newest.
    df = df.sort_values(["provnum", "cy_qtr"])
    df = df.groupby(["provnum", "cy_qtr"], as_index=False).last()
    df["provnum"] = df["provnum"].astype(str).str.zfill(6)
    return df


def group_sums(df, cats, groups, prefix):
    """Total / contract hours per group, on the CMS census-day basis."""
    out = pd.DataFrame(index=df.index)
    for gname, members in groups.items():
        tot = sum(df[f"hrs_{c}__cms"] for c in members)
        ctr = sum(df[f"hrs_{c}_ctr__cms"] for c in members)
        out[f"{gname}_hours"] = tot
        out[f"{gname}_contract_hours"] = ctr
    all_tot = sum(df[f"hrs_{c}__cms"] for c in cats)
    all_ctr = sum(df[f"hrs_{c}_ctr__cms"] for c in cats)
    out[f"{prefix}_hours"] = all_tot
    out[f"{prefix}_contract_hours"] = all_ctr
    return out


def pct(num, den):
    return (num / den.where(den > 0)).astype(float).round(4) * 100


def main():
    os.makedirs(OUT, exist_ok=True)
    nurse = load("nurse")
    nonnurse = load("nonnurse")

    for name, df in (("nurse", nurse), ("nonnurse", nonnurse)):
        path = os.path.join(OUT, f"pbj_{name}_facility_quarter")
        df.to_parquet(path + ".parquet", index=False)
        df.to_csv(path + ".csv.gz", index=False, compression="gzip")
        print(f"{name}: {len(df):,} facility-quarters, "
              f"{df.provnum.nunique():,} facilities, "
              f"{df.cy_qtr.nunique()} quarters")

    dims = ["provname", "city", "state", "county_name", "county_fips"]
    a = nurse[["provnum", "cy_qtr"] + dims + ["days_reported", "days_with_census",
                                              "resident_days"]].copy()

    ng = group_sums(nurse, NURSE_CATS, NURSE_GROUPS, "total_nurse")
    a = pd.concat([a, ng], axis=1)

    nn = nonnurse.set_index(["provnum", "cy_qtr"])
    nng = group_sums(nn, NONNURSE_CATS, NONNURSE_GROUPS, "total_nonnurse")
    nng = nng.reset_index()
    a = a.merge(nng, on=["provnum", "cy_qtr"], how="left")

    a["year"] = a.cy_qtr.str[:4].astype(int)
    a["quarter"] = a.cy_qtr.str[-1].astype(int)
    a["expected_days"] = a.cy_qtr.map(quarter_days)
    a["reporting_completeness_pct"] = (
        a.days_reported / a.expected_days * 100).round(1)
    a["avg_daily_census"] = (
        a.resident_days / a.days_with_census.where(a.days_with_census > 0)).round(2)

    a["total_hours_all_staff"] = a.total_nurse_hours + a.total_nonnurse_hours.fillna(0)
    a["total_contract_hours_all_staff"] = (
        a.total_nurse_contract_hours + a.total_nonnurse_contract_hours.fillna(0))

    rd = a.resident_days
    for col in ["rn", "lpn", "aide", "total_nurse", "therapy", "physician_apc",
                "social_activities_mh", "clinical_support", "administration",
                "total_nonnurse"]:
        a[f"{col}_hprd"] = (a[f"{col}_hours"] / rd.where(rd > 0)).round(4)
        a[f"{col}_agency_pct"] = pct(a[f"{col}_contract_hours"], a[f"{col}_hours"])
    a["total_hours_all_staff_hprd"] = (
        a.total_hours_all_staff / rd.where(rd > 0)).round(4)
    a["agency_pct_all_staff"] = pct(
        a.total_contract_hours_all_staff, a.total_hours_all_staff)

    order = (["provnum", "provname", "city", "state", "county_name", "county_fips",
              "cy_qtr", "year", "quarter", "days_reported", "days_with_census",
              "expected_days", "reporting_completeness_pct", "resident_days",
              "avg_daily_census"]
             + [c for c in a.columns if c.endswith("_hours")]
             + [c for c in a.columns if c.endswith("_contract_hours")]
             + [c for c in a.columns if c.endswith("_hprd")]
             + [c for c in a.columns if c.endswith("_agency_pct")])
    order = list(dict.fromkeys(order))
    a = a[order + [c for c in a.columns if c not in order]]
    a = a.sort_values(["cy_qtr", "provnum"]).reset_index(drop=True)

    path = os.path.join(OUT, "pbj_atlas_facility_quarter")
    a.to_parquet(path + ".parquet", index=False)
    a.to_csv(path + ".csv.gz", index=False, compression="gzip")
    print(f"atlas: {len(a):,} rows x {a.shape[1]} cols")

    # State x quarter rollup (hours-weighted, not a mean of facility ratios).
    grp = a.groupby(["state", "cy_qtr"], as_index=False).agg(
        facilities=("provnum", "nunique"),
        resident_days=("resident_days", "sum"),
        total_nurse_hours=("total_nurse_hours", "sum"),
        total_nurse_contract_hours=("total_nurse_contract_hours", "sum"),
        rn_hours=("rn_hours", "sum"),
        aide_hours=("aide_hours", "sum"),
        total_hours_all_staff=("total_hours_all_staff", "sum"),
        total_contract_hours_all_staff=("total_contract_hours_all_staff", "sum"),
    )
    grp["total_nurse_hprd"] = (
        grp.total_nurse_hours / grp.resident_days.where(grp.resident_days > 0)).round(4)
    grp["rn_hprd"] = (
        grp.rn_hours / grp.resident_days.where(grp.resident_days > 0)).round(4)
    grp["nurse_agency_pct"] = pct(grp.total_nurse_contract_hours, grp.total_nurse_hours)
    grp["agency_pct_all_staff"] = pct(
        grp.total_contract_hours_all_staff, grp.total_hours_all_staff)
    grp.to_csv(os.path.join(OUT, "pbj_state_quarter_summary.csv"), index=False)
    print(f"state summary: {len(grp):,} rows")

    national = a.groupby("cy_qtr", as_index=False).agg(
        facilities=("provnum", "nunique"),
        resident_days=("resident_days", "sum"),
        total_nurse_hours=("total_nurse_hours", "sum"),
        total_nurse_contract_hours=("total_nurse_contract_hours", "sum"),
        rn_hours=("rn_hours", "sum"),
    )
    national["total_nurse_hprd"] = (
        national.total_nurse_hours / national.resident_days).round(3)
    national["rn_hprd"] = (national.rn_hours / national.resident_days).round(3)
    national["nurse_agency_pct"] = pct(
        national.total_nurse_contract_hours, national.total_nurse_hours).round(2)
    national.to_csv(os.path.join(OUT, "pbj_national_quarter_trend.csv"), index=False)
    print(national[["cy_qtr", "facilities", "total_nurse_hprd", "rn_hprd",
                    "nurse_agency_pct"]].to_string(index=False))


if __name__ == "__main__":
    main()
