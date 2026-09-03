#!/usr/bin/env python3
"""
fetch_datasets.py — auto-download a CMS dataset's current CSV into etl/raw/<folder>/
and run the matching ingester.

This unifies the API path with manual uploads: both land a CSV in etl/raw/ and
are processed by the same tested ingesters (ingest_provider_info.py /
ingest_chain_performance.py), which also point-in-time archive each vintage.

CMS public data needs no API key. Provider-Data-Catalog datasets resolve their
current CSV downloadURL automatically from the metastore. Datasets on other CMS
catalogs (e.g. Chain Performance Measures on quality-of-care) don't expose the
same query API, so pass their CSV URL with --url (copy the "Download CSV" link
from the dataset page).

Examples:
    # Provider Information — fully automatic
    python3 etl/fetch_datasets.py provider_info

    # Chain Performance Measures — give it the CSV link + the data month
    python3 etl/fetch_datasets.py chain_performance --url "<csv-url>" --period 2026-06

Note: data.cms.gov must be reachable from where this runs.
"""
from __future__ import annotations

import argparse
import csv
import os
from datetime import datetime, timezone

from common import SESSION, get_json, period_from_filename
from config import CSV_DATASETS, PROVIDER_DATA_BASE, RAW_DIR


def _now_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _period_from_modified(modified: str | None) -> str:
    if modified and len(modified) >= 7 and modified[4] == "-":
        return modified[:7]
    return _now_month()


def resolve_provider_data_csv(title: str) -> tuple[str, str | None]:
    """Find a Provider Data Catalog dataset by title and return its CSV
    downloadURL + last-modified date."""
    items = get_json(f"{PROVIDER_DATA_BASE}/metastore/schemas/dataset/items")
    for item in items:
        if title.lower() in str(item.get("title", "")).lower():
            for dist in item.get("distribution", []):
                data = dist.get("data", dist)  # metastore nests under "data" sometimes
                url = data.get("downloadURL")
                mt = str(data.get("mediaType", "")).lower()
                if url and ("csv" in mt or url.lower().endswith(".csv")):
                    return url, item.get("modified")
    raise SystemExit(f"Could not resolve a CSV download for '{title}' from the metastore.")


def download(url: str, folder: str, period: str) -> str:
    dest_dir = os.path.join(RAW_DIR, folder)
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{period}.csv")
    print(f"Downloading {url}\n  -> {dest}")
    with SESSION.get(url, stream=True, timeout=300) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                if chunk:
                    f.write(chunk)
    print(f"  saved {os.path.getsize(dest):,} bytes")
    return dest


def download_data_api_as_csv(url: str, folder: str, period: str) -> str:
    """CMS Open Data API (data-api/v1) returns JSON records; page through them and
    write the CSV the ingesters expect. The API's field names are the dataset's
    column titles — the same names the ingesters match on — so a stable "Latest"
    API URL can replace a manual CSV-download link that changes each month."""
    base = url.split("?")[0]
    rows: list[dict] = []
    size, offset = 5000, 0
    while True:
        page = get_json(base, {"size": size, "offset": offset})
        if not isinstance(page, list) or not page:
            break
        rows.extend(page)
        if len(page) < size:
            break
        offset += size
    if not rows:
        raise SystemExit(f"No rows returned from {base}")
    # Column order: first row's keys, then any extra keys later rows introduce.
    cols: list[str] = []
    seen: set[str] = set()
    for r in rows:
        for k in r.keys():
            if k not in seen:
                seen.add(k)
                cols.append(k)
    dest_dir = os.path.join(RAW_DIR, folder)
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{period}.csv")
    with open(dest, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({k: ("" if r.get(k) is None else r.get(k)) for k in cols})
    print(f"  wrote {len(rows):,} rows x {len(cols)} cols -> {dest}")
    return dest


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("dataset", choices=list(CSV_DATASETS.keys()))
    ap.add_argument("--url", help="Direct CSV downloadURL (required for non-Provider-Data-Catalog datasets).")
    ap.add_argument("--period", help="Data month YYYY-MM (else inferred from the dataset's modified date).")
    ap.add_argument("--no-ingest", action="store_true", help="Download only; skip the ingester.")
    args = ap.parse_args()
    cfg = CSV_DATASETS[args.dataset]

    if args.url:
        if "/data-api/" in args.url:
            # CMS Open Data API endpoint (JSON) — page + convert to CSV. The
            # period only names the raw file; the chain ingester derives real
            # periods from each row's snapshot_release column.
            download_data_api_as_csv(args.url, cfg["folder"], args.period or _now_month())
        else:
            guessed = period_from_filename(args.url)
            period = args.period or (guessed if guessed.count("-") == 1 and guessed[:2] == "20" else _now_month())
            download(args.url, cfg["folder"], period)
    elif cfg["source"] == "provider-data":
        url, modified = resolve_provider_data_csv(cfg["title"])
        download(url, cfg["folder"], args.period or _period_from_modified(modified))
    else:
        raise SystemExit(
            f"{args.dataset} is on the '{cfg['source']}' catalog (no metastore query API). "
            f"Pass its CSV URL via --url — copy the Download CSV link from {cfg.get('landing')}."
        )

    if args.no_ingest:
        print("Downloaded. Skipping ingest (--no-ingest).")
        return
    print("Running ingester…")
    if args.dataset == "provider_info":
        import ingest_provider_info
        ingest_provider_info.main()
    elif args.dataset == "chain_performance":
        import ingest_chain_performance
        ingest_chain_performance.main()


if __name__ == "__main__":
    main()
