"""
Shared HTTP + CMS Provider Data Catalog helpers for the real ETL pipeline.

Design notes:
  * Every fetch is paginated and retried with backoff.
  * resolve_dataset() falls back to the metastore when a pinned identifier
    stops resolving, so the pipeline survives CMS re-publishing a dataset.
"""
from __future__ import annotations

import json
import os
import time
from typing import Iterator

import requests

from config import PROVIDER_DATA_BASE

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "CaliberWorkforceAtlas-ETL/1.0 (+public CMS data)"})


def get_json(url: str, params: dict | None = None, retries: int = 4) -> dict:
    """GET JSON with exponential backoff (2s, 4s, 8s, 16s)."""
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            resp = SESSION.get(url, params=params, timeout=60)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            wait = 2 ** (attempt + 1)
            print(f"  request failed ({exc}); retrying in {wait}s…")
            time.sleep(wait)
    raise RuntimeError(f"GET {url} failed after {retries} attempts: {last_exc}")


def resolve_dataset(dataset_id: str, title: str) -> str:
    """Return a working datastore identifier for a Provider Data Catalog dataset.

    Tries the pinned id first; if it no longer resolves, searches the metastore
    by title. Returns the identifier to use in datastore/query calls.
    """
    # Probe the pinned id cheaply.
    try:
        probe = get_json(f"{PROVIDER_DATA_BASE}/datastore/query/{dataset_id}/0", {"limit": 1})
        if "results" in probe:
            return dataset_id
    except Exception:  # noqa: BLE001
        pass

    print(f"  pinned id '{dataset_id}' did not resolve; searching metastore for '{title}'…")
    items = get_json(f"{PROVIDER_DATA_BASE}/metastore/schemas/dataset/items")
    for item in items:
        if title.lower() in str(item.get("title", "")).lower():
            dist = (item.get("distribution") or [{}])[0]
            ident = dist.get("identifier") or item.get("identifier")
            if ident:
                print(f"  resolved '{title}' -> {ident}")
                return ident
    raise RuntimeError(f"Could not resolve dataset for title '{title}'")


def query_dataset(
    dataset_id: str,
    conditions: list[dict] | None = None,
    page_size: int = 2000,
) -> Iterator[dict]:
    """Yield all rows of a Provider Data Catalog dataset, paginated.

    `conditions` uses the DKAN datastore query format, e.g.
      [{"property": "state", "value": "TX", "operator": "="}]
    """
    offset = 0
    url = f"{PROVIDER_DATA_BASE}/datastore/query/{dataset_id}/0"
    while True:
        body = {"limit": page_size, "offset": offset}
        if conditions:
            body["conditions"] = conditions
        # The datastore query endpoint accepts POST with a JSON body.
        resp = SESSION.post(url, json=body, timeout=90)
        resp.raise_for_status()
        payload = resp.json()
        rows = payload.get("results", [])
        if not rows:
            break
        for row in rows:
            yield row
        if len(rows) < page_size:
            break
        offset += page_size


def write_raw(name: str, rows: list[dict]) -> str:
    from config import RAW_DIR

    os.makedirs(RAW_DIR, exist_ok=True)
    path = os.path.join(RAW_DIR, f"{name}.json")
    with open(path, "w") as f:
        json.dump(rows, f)
    print(f"  wrote {len(rows)} rows -> {path}")
    archive_capture(name, rows)
    return path


def archive_capture(source: str, rows: list[dict], key_fields=("cms_certification_number_ccn", "provnum", "ccn")) -> None:
    """Capture a point-in-time copy of a fetched CMS payload (Business Plan §3).

    CMS overwrites its published files with no changelog, so each fetch is stored
    under a capture timestamp and diffed against the most recent prior capture.
    The manifest indexes every capture; the raw copies are the archive itself.
    """
    from datetime import datetime, timezone

    arch_dir = os.path.join("etl", "archive", source)
    os.makedirs(arch_dir, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    def keyset(items: list[dict]) -> dict:
        out = {}
        for r in items:
            k = next((str(r[f]) for f in key_fields if r.get(f)), None)
            if k:
                out[k] = r
        return out

    prior_files = sorted(f for f in os.listdir(arch_dir) if f.endswith(".json"))
    changed = None
    if prior_files:
        try:
            with open(os.path.join(arch_dir, prior_files[-1])) as pf:
                prior = keyset(json.load(pf))
            cur = keyset(rows)
            changed = sum(1 for k, v in cur.items() if prior.get(k) != v) + \
                sum(1 for k in prior if k not in cur)
        except Exception:  # noqa: BLE001
            changed = None

    cap_path = os.path.join(arch_dir, f"{ts}.json")
    with open(cap_path, "w") as f:
        json.dump(rows, f)

    manifest_path = os.path.join("etl", "archive", "manifest.json")
    manifest = []
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path) as mf:
                manifest = json.load(mf)
        except Exception:  # noqa: BLE001
            manifest = []
    manifest.append({
        "source": source, "period": None, "captured_at": ts,
        "file_uri": cap_path, "row_count": len(rows), "changed_rows": changed,
    })
    with open(manifest_path, "w") as mf:
        json.dump(manifest, mf, indent=2)
    diff_note = f", {changed} rows changed vs prior" if changed is not None else " (first capture)"
    print(f"  archived {len(rows)} rows -> {cap_path}{diff_note}")


def read_raw(name: str) -> list[dict]:
    from config import RAW_DIR

    path = os.path.join(RAW_DIR, f"{name}.json")
    with open(path) as f:
        return json.load(f)


_MONTHS = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
    "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}


def period_from_filename(path: str) -> str:
    """Infer a 'YYYY-MM' period from a filename, tolerant of CMS's native names.

    Handles: 2026-07, 2026_07, 202607, and month names in any position, e.g.
    'NH_ProviderInfo_Jul2026.csv', 'Nursing_Home_Chain_Performance_Measures_Jun_2026.csv',
    'July 2026'. Falls back to the filename stem if nothing matches.
    """
    import re

    base = os.path.basename(path)
    m = re.search(r"(20\d{2})[-_ ]?(0[1-9]|1[0-2])", base)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    m = re.search(r"([A-Za-z]{3,9})[-_ ]?(20\d{2})", base)
    if m and m.group(1)[:3].lower() in _MONTHS:
        return f"{m.group(2)}-{_MONTHS[m.group(1)[:3].lower()]}"
    m = re.search(r"(20\d{2})[-_ ]?([A-Za-z]{3,9})", base)
    if m and m.group(2)[:3].lower() in _MONTHS:
        return f"{m.group(1)}-{_MONTHS[m.group(2)[:3].lower()]}"
    return os.path.splitext(base)[0]
