# CMS PBJ ingest toolkit — CHI Workforce Atlas

Rebuilds the Atlas staffing tables from source. Two scripts, run in order.

```bash
pip install pandas pyarrow
python3 pbj_pipeline.py    # downloads + aggregates every quarter -> parts/
python3 derive.py          # assembles parts/ -> out/
```

`pbj_pipeline.py` streams each quarterly CSV, aggregates it to facility-quarter,
writes a parquet part, and deletes the raw file before moving on. Peak disk is
about 2.5 GB even though the full raw series is ~32 GB. Completed parts are
cached, so re-running only fetches what is new or missing — delete a part file
to force that quarter to rebuild.

Runtime on a 2-core box: roughly 45 minutes for a full cold build, a couple of
minutes for an incremental refresh once CMS posts a new quarter.

## Why it re-reads the CMS catalog every run

PBJ download URLs embed a publication-date folder and a UUID:

```
https://data.cms.gov/sites/default/files/2026-06/5c2f045b-.../PBJ_dailynursestaffing_CY2026Q1.csv
```

When CMS restates a quarter, that URL changes and the old one 404s. The pipeline
resolves every URL fresh from `https://data.cms.gov/data.json` on each run, so a
restatement is picked up rather than silently missed. Do not hardcode the links.

## Schema defects handled

Nine years of CMS publishing has left real inconsistencies. These are corrected
in `normalize_columns()`; if you rebuild this logic elsewhere, carry them over.

| Quarter(s) | Defect | Handling |
|---|---|---|
| 2017Q1–2017Q4 | Legacy nurse column names: `hrs_rn_donadmin`, `hrs_lpn_admin`, `hrs_na_trn` | Renamed to canonical `hrs_rndon`, `hrs_lpnadmin`, `hrs_natrn` |
| 2017Q2 | CMS header typo — the Med Aide contract column is mislabeled `hrs_rn_donadmin`, and `hrs_medaide_ctr` is absent | Positional remap to `hrs_medaide_ctr` |
| 2021Q4 | Extra `incomplete` submission-flag column | Counted, not silently dropped |
| 2023Q1 onward | Non-nurse files gain `hrs_admin_fn` | Carried; zero-filled for earlier quarters |
| Many quarters | cp1252 rather than UTF-8 encoding (smart quotes, en dashes in facility names) | UTF-8 attempted first, cp1252 fallback — never a lossy decode |
| 2020Q3, one non-nurse quarter | Filename is a bare legacy Socrata id, no quarter in it | Quarter read from the file's own `CY_Qtr` column, which is authoritative |

## PROVNUM

`PROVNUM` is the 6-character CMS Certification Number and **has meaningful
leading zeros** (`015009`, not `15009`). It is stored as text throughout and
zero-padded on read. Opening the CSVs in Excel will strip those zeros and break
every join. Use the `.parquet` files, or set the column to Text on import.

It joins directly to the CMS Care Compare Provider Information file, which is
where bed count, ownership/chain, and case-mix-adjusted expected hours live —
none of which exist in PBJ.
