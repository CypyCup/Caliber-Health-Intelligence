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
    return path


def read_raw(name: str) -> list[dict]:
    from config import RAW_DIR

    path = os.path.join(RAW_DIR, f"{name}.json")
    with open(path) as f:
        return json.load(f)
