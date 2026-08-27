#!/usr/bin/env python3
"""
CHI Workforce Atlas -- CMS Payroll Based Journal (PBJ) ingest.

Downloads every quarterly PBJ Daily Nurse Staffing and Daily Non-Nurse Staffing
file published by CMS, normalizes schema drift across the 2017-present series,
and aggregates the daily facility records to one row per facility per quarter,
preserving the employee vs. contract (agency) split on every staff category.

Raw files are streamed and deleted as they are processed, so peak disk stays
low even though the full raw series is ~32 GB.
"""

import codecs
import json
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd

CATALOG_URL = "https://data.cms.gov/data.json"
DATASETS = {
    "nurse": "Payroll Based Journal Daily Nurse Staffing",
    "nonnurse": "Payroll Based Journal Daily Non-Nurse Staffing",
}

BASE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(BASE, "raw")
PARTS = os.path.join(BASE, "parts")
OUT = os.path.join(BASE, "out")

# Identifier / dimension columns, in normalized (lowercase) form.
ID_COLS = ["provnum", "provname", "city", "state", "county_name", "county_fips"]
KEY_COLS = ["provnum", "cy_qtr"]

# CMS renamed several nurse columns after the 2017 files. Map old -> canonical.
NURSE_ALIASES = {
    "hrs_rn_donadmin": "hrs_rndon",
    "hrs_lpn_admin": "hrs_lpnadmin",
    "hrs_na_trn": "hrs_natrn",
    "hrs_na_trn_emp": "hrs_natrn_emp",
    "hrs_na_trn_ctr": "hrs_natrn_ctr",
}

NURSE_CATS = ["rndon", "rnadmin", "rn", "lpnadmin", "lpn", "cna", "natrn", "medaide"]
NONNURSE_CATS = [
    "admin", "meddir", "othmd", "pa", "np", "clinnrsspec", "pharmacist",
    "dietician", "feedasst", "ot", "otasst", "otaide", "pt", "ptasst",
    "ptaide", "respther", "resptech", "spclangpath", "therrecspec",
    "qualactvprof", "othactv", "qualsocwrk", "othsocwrk", "mhsvc",
]
# Standalone column present only in later non-nurse quarters (no emp/ctr split).
EXTRA_NONNURSE = ["hrs_admin_fn"]


def log(msg):
    print(msg, flush=True)
    sys.stdout.flush()


def build_manifest():
    """Re-read the CMS catalog every run: PBJ download URLs embed a publication
    date folder and change whenever CMS restates a quarter."""
    cat_path = os.path.join(BASE, "catalog.json")
    subprocess.run(
        ["curl", "-sS", "--max-time", "120", "-o", cat_path, CATALOG_URL], check=True
    )
    with open(cat_path) as fh:
        catalog = json.load(fh)

    manifest = {}
    for key, title in DATASETS.items():
        rows = []
        for ds in catalog.get("dataset", []):
            if ds.get("title") != title:
                continue
            for dist in ds.get("distribution", []):
                if dist.get("format") != "CSV":
                    continue
                url = dist.get("downloadURL")
                if not url:
                    continue
                rows.append({"quarter": quarter_from_url(url), "url": url})
        rows.sort(key=lambda r: r["quarter"])
        manifest[key] = rows
    with open(os.path.join(BASE, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=1)
    return manifest


def quarter_from_url(url):
    """Best-effort CY####Q# label from the filename. Two files in the series are
    named only by their legacy Socrata id, so this is a provisional label only --
    the authoritative quarter is read from the file's own CY_Qtr column."""
    name = os.path.basename(url).replace(".csv", "")
    upper = name.upper()
    if "CY" in upper:
        tail = upper.split("CY")[-1].lstrip("_")
        if len(tail) >= 6 and tail[:4].isdigit() and tail[4] == "Q":
            return f"{tail[:4]}Q{tail[5]}"
    parts = upper.replace("-", "_").split("_")
    year = quarter = None
    for p in parts:
        if len(p) == 4 and p.isdigit() and p.startswith("20"):
            year = p
        if len(p) == 2 and p[0] == "Q" and p[1].isdigit():
            quarter = p[1]
        if len(p) == 6 and p[:4].isdigit() and p[4] == "Q":
            year, quarter = p[:4], p[5]
    if year and quarter:
        return f"{year}Q{quarter}"
    return name


def normalize_columns(df):
    """Reconcile nine years of CMS header drift onto one canonical schema.

    Known defects handled here:
      * 2017 files use legacy names (hrs_rn_donadmin, hrs_lpn_admin, hrs_na_trn).
      * 2017Q2 ships six scrambled header labels: the Nurse Aide in Training
        and Med Aide blocks are rotated against their data, one column is
        mislabeled 'hrs_rn_donadmin' (a name already used earlier in the row),
        and 'hrs_medaide_ctr' is missing. The corrected mapping below was
        established empirically and confirmed three ways -- employee + contract
        sums exactly to total under it and under no other pairing, reporting
        facility counts line up with 2017Q1 and 2017Q3, and the magnitudes are
        continuous with the adjacent quarters.
      * 2021Q4 carries an extra 'incomplete' submission flag column.
      * Non-nurse files gained 'hrs_admin_fn' starting 2023Q1.
    """
    df.columns = [c.strip().strip('"').lower() for c in df.columns]
    cols = set(df.columns)

    # 2017Q2 scrambled aide/med-aide labels. Applied as one simultaneous rename.
    if ("hrs_rn_donadmin" in cols and "hrs_rndon" in cols
            and "hrs_medaide_ctr" not in cols):
        df = df.rename(columns={
            "hrs_medaide": "hrs_medaide_emp",
            "hrs_medaide_emp": "hrs_medaide_ctr",
            "hrs_rn_donadmin": "hrs_natrn",
            "hrs_na_trn": "hrs_natrn_emp",
            "hrs_natrn_emp": "hrs_natrn_ctr",
            "hrs_natrn_ctr": "hrs_medaide",
        })
        cols = set(df.columns)

    df = df.rename(columns={k: v for k, v in NURSE_ALIASES.items()
                            if k in df.columns and v not in df.columns})
    return df


def detect_encoding(path, block=8 << 20):
    """Some quarters are cp1252-encoded (smart quotes and en dashes in facility
    names) and the offending byte can sit anywhere in a 600 MB file, so a
    try-the-first-chunk approach misses it. Stream-validate UTF-8 over the whole
    file and fall back to cp1252 rather than ever decoding lossily."""
    decoder = codecs.getincrementaldecoder("utf-8")()
    with open(path, "rb") as fh:
        while True:
            buf = fh.read(block)
            if not buf:
                try:
                    decoder.decode(b"", final=True)
                except UnicodeDecodeError:
                    return "cp1252"
                return "utf-8"
            try:
                decoder.decode(buf)
            except UnicodeDecodeError:
                return "cp1252"


def read_csv_chunks(path, **kwargs):
    encoding = detect_encoding(path)
    return pd.read_csv(path, encoding=encoding, **kwargs), encoding


def hour_columns(kind):
    cats = NURSE_CATS if kind == "nurse" else NONNURSE_CATS
    cols = []
    for c in cats:
        cols += [f"hrs_{c}", f"hrs_{c}_emp", f"hrs_{c}_ctr"]
    if kind == "nonnurse":
        cols += EXTRA_NONNURSE
    return cols


def process_file(kind, quarter, url):
    """Download one quarterly file, aggregate to facility-quarter, delete raw."""
    out_path = os.path.join(PARTS, f"{kind}_{quarter}.parquet")
    if os.path.exists(out_path):
        return {"kind": kind, "quarter": quarter, "status": "skipped_cached",
                "url": url}

    tmpdir = tempfile.mkdtemp(dir=RAW)
    local = os.path.join(tmpdir, f"{kind}_{quarter}.csv")
    try:
        subprocess.run(
            ["curl", "-sS", "--fail", "--retry", "3", "--retry-delay", "5",
             "--max-time", "900", "-o", local, url],
            check=True, capture_output=True,
        )
        size_mb = os.path.getsize(local) / 1e6

        expected = hour_columns(kind)
        agg_parts = []
        rows_in = 0
        missing_cols = set()
        incomplete_rows = 0
        quarters_seen = set()

        chunks, encoding = read_csv_chunks(
            local,
            chunksize=300_000,
            dtype={"PROVNUM": str, "provnum": str,
                   "COUNTY_FIPS": str, "county_fips": str},
            low_memory=False,
        )
        for chunk in chunks:
            chunk = normalize_columns(chunk)
            rows_in += len(chunk)

            for col in expected:
                if col not in chunk.columns:
                    chunk[col] = 0.0
                    missing_cols.add(col)
            if "mdscensus" not in chunk.columns:
                chunk["mdscensus"] = 0.0

            for col in expected + ["mdscensus"]:
                chunk[col] = (pd.to_numeric(chunk[col], errors="coerce")
                              .fillna(0.0).astype("float32"))

            # 2021Q4 ships an 'incomplete' submission flag; count it, don't drop it.
            if "incomplete" in chunk.columns:
                flag = pd.to_numeric(chunk["incomplete"], errors="coerce").fillna(0)
                incomplete_rows += int((flag != 0).sum())

            # The file's own CY_Qtr is authoritative -- two files in the series
            # are named only by a legacy Socrata id.
            if "cy_qtr" in chunk.columns:
                vals = chunk["cy_qtr"].astype(str).str.strip().str.upper()
                quarters_seen.update(vals.dropna().unique().tolist())
                chunk["cy_qtr"] = vals
            else:
                chunk["cy_qtr"] = quarter

            chunk["provnum"] = chunk["provnum"].astype(str).str.strip().str.zfill(6)
            chunk["days_reported"] = 1
            # CMS Five-Star counts only days with at least one resident. Sum the
            # hour columns twice -- all days, and census days only -- rather than
            # materializing a second copy of every column, which is what pushed
            # the non-nurse files (75 hour columns) into swap.
            has_census = chunk["mdscensus"] > 0
            chunk["days_with_census"] = has_census.astype("int32")

            for c in ID_COLS:
                if c not in chunk.columns:
                    chunk[c] = ""

            sum_cols = expected + ["mdscensus", "days_reported", "days_with_census"]
            g = chunk.groupby(KEY_COLS, as_index=False)
            summed = g[sum_cols].sum()
            dims = g[[c for c in ID_COLS if c != "provnum"]].first()

            cms = (chunk.loc[has_census].groupby(KEY_COLS, as_index=False)[expected]
                   .sum().rename(columns={c: f"{c}__cms" for c in expected}))

            part = summed.merge(dims, on=KEY_COLS, how="left")
            part = part.merge(cms, on=KEY_COLS, how="left")
            for c in expected:
                part[f"{c}__cms"] = part[f"{c}__cms"].fillna(0.0)
            agg_parts.append(part)

        agg = pd.concat(agg_parts, ignore_index=True)
        # Chunk boundaries can split a facility; collapse again.
        sum_cols = (expected + [f"{c}__cms" for c in expected]
                    + ["mdscensus", "days_reported", "days_with_census"])
        dim_cols = [c for c in ID_COLS if c != "provnum"]
        agg = (
            agg.groupby(KEY_COLS, as_index=False)
            .agg({**{c: "sum" for c in sum_cols}, **{c: "first" for c in dim_cols}})
        )
        agg = agg.rename(columns={"mdscensus": "resident_days"})

        agg.to_parquet(out_path, index=False)
        return {
            "kind": kind, "quarter": quarter, "facilities": len(agg),
            "rows_in": rows_in, "size_mb": round(size_mb, 1),
            "resident_days": float(agg["resident_days"].sum()),
            "encoding": encoding,
            "missing_cols_filled_zero": sorted(missing_cols),
            "incomplete_flag_rows": incomplete_rows,
            "quarters_in_file": sorted(quarters_seen),
            "url": url, "status": "ok",
        }
    except subprocess.CalledProcessError as exc:
        return {"kind": kind, "quarter": quarter, "status": "download_failed",
                "url": url, "error": (exc.stderr or b"").decode()[:300]}
    except Exception as exc:  # noqa: BLE001
        return {"kind": kind, "quarter": quarter, "status": "error",
                "url": url, "error": f"{type(exc).__name__}: {exc}"[:300]}
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def main():
    for d in (RAW, PARTS, OUT):
        os.makedirs(d, exist_ok=True)

    manifest = build_manifest()
    jobs = [(k, r["quarter"], r["url"]) for k, rows in manifest.items() for r in rows]
    log(f"manifest: {len(jobs)} files "
        f"({len(manifest['nurse'])} nurse, {len(manifest['nonnurse'])} non-nurse)")

    results = []
    done = 0
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(process_file, *j): j for j in jobs}
        for fut in as_completed(futures):
            res = fut.result()
            results.append(res)
            done += 1
            if res["status"] == "ok":
                notes = []
                if res["missing_cols_filled_zero"]:
                    notes.append(f"filled0={len(res['missing_cols_filled_zero'])}")
                if res["incomplete_flag_rows"]:
                    notes.append(f"incomplete={res['incomplete_flag_rows']:,}")
                if res["encoding"] != "utf-8":
                    notes.append(res["encoding"])
                if len(res["quarters_in_file"]) != 1:
                    notes.append(f"mixed_qtrs={res['quarters_in_file']}")
                log(f"[{done}/{len(jobs)}] {res['kind']:9s} {res['quarter']:8s} "
                    f"{res['size_mb']:7.1f}MB {res['rows_in']:>9,} rows -> "
                    f"{res['facilities']:,} facilities "
                    f"{' '.join(notes)}")
            elif res["status"] == "skipped_cached":
                log(f"[{done}/{len(jobs)}] cached {res['kind']} {res['quarter']}")
            else:
                log(f"[{done}/{len(jobs)}] FAILED {res['kind']} {res['quarter']}: "
                    f"{res.get('error')}")

    with open(os.path.join(OUT, "_ingest_log.json"), "w") as fh:
        json.dump(sorted(results, key=lambda r: (r["kind"], r["quarter"])), fh, indent=1)

    failures = [r for r in results if r["status"] not in ("ok", "skipped_cached")]
    cached = sum(1 for r in results if r["status"] == "skipped_cached")
    log(f"\ncomplete: {len(results) - len(failures) - cached} built, "
        f"{cached} cached, {len(failures)} failed")
    for f in failures:
        log(f"  FAILED {f['kind']} {f['quarter']} {f.get('error')}")


if __name__ == "__main__":
    main()
