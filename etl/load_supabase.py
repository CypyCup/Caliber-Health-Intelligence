#!/usr/bin/env python3
"""Load the seed JSON (demo or real) into Supabase via PostgREST bulk upsert.

Prereqs:
  * Run supabase/schema.sql in your project first.
  * Export SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role — server side
    only; never ship it to the browser).

Usage:
  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \\
    python3 etl/load_supabase.py
"""
from __future__ import annotations

import json
import os

import requests

from config import OUT_DIR

URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
BATCH = 1000


def upsert(table: str, rows: list[dict], on_conflict: str) -> None:
    if not rows:
        return
    endpoint = f"{URL}/rest/v1/{table}?on_conflict={on_conflict}"
    headers = {
        "apikey": KEY, "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        resp = requests.post(endpoint, headers=headers, data=json.dumps(chunk), timeout=120)
        resp.raise_for_status()
        print(f"  {table}: upserted {i + len(chunk)}/{len(rows)}")


def load(name: str) -> list[dict]:
    with open(os.path.join(OUT_DIR, f"{name}.json")) as f:
        return json.load(f)


def main() -> None:
    if not URL or not KEY:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    # Order matters for FKs: owners -> chains -> facilities -> snapshots.
    upsert("owners", load("owners"), "id")
    upsert("chains", load("chains"), "id")
    upsert("facilities", load("facilities"), "ccn")
    upsert("metric_snapshots", load("metric_snapshots"), "ccn,metric_key,period")
    print("Done.")


if __name__ == "__main__":
    main()
