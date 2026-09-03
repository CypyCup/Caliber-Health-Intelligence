# HCRIS (SNF cost report) — sourcing & extraction spec, v1

The financial layer. Source: CMS **Skilled Nursing Facility cost reports**
(Form CMS-2540-10) from HCRIS — 100% public CMS data, firewall-clean. This spec
is the "guide me to the exact files first" step; the ingester is built against it
once the files land.

## Agreed scope (v1)

- **Placement:** hybrid. Free *teaser* = a **margin band** + **one labor metric**
  (not rents). Full breakdown, trends, and peer cohorts are **paid**.
- **Metrics:** **margin** (for the band) + **labor economics** (salary $ and
  contract-labor $ — the bridge from PBJ agency *hours* to the cost base).
- **Deferred:** related-party rent / management fees (paid-tier, later).

## 1. Where to download (primary — CMS, not a mirror)

CMS Cost Reports → **"Skilled Nursing Facility 2540-2010 form"**:
<https://www.cms.gov/data-research/statistics-trends-and-reports/cost-reports/skilled-nursing-facility-2540-2010-form>

- Download the **per-fiscal-year ZIPs**. Each ZIP contains three CSVs:
  | File | Contains | We use |
  |---|---|---|
  | `SNF10_<FY>_RPT.CSV` | one row per filed report (index) | join key + CCN + fiscal year |
  | `SNF10_<FY>_NMRC.CSV` | numeric line items at (worksheet, line, column) | **all financial values** |
  | `SNF10_<FY>_ALPHA.CSV` | text line items (names, addresses) | ignored in v1 |
- **Grab the last ~4 available years** (≈ **FY2021–FY2024**) for a trend. FY2025
  is partial — cost reports land ~5 months after fiscal-year end and settle
  later, so there's a **~12–18 month lag**; FY2024 is the latest ~complete
  national year as of late 2026.
- Reports with a fiscal-year **begin date before 2010-12-01** are on the older
  **2540-96** form — skip for v1.
- Drop them in **`etl/raw/hcris/`** (same pattern as PBJ). No API for bulk cost
  reports, so this is a manual download like the PBJ parquet.

## 2. File structure & join logic

**`RPT` columns** (standard HCRIS layout):
- `RPT_REC_NUM` — unique report id; the **join key** to NMRC/ALPHA
- `PRVDR_NUM` — 6-char **CCN** → joins directly to `facilities.ccn`
- `FY_BGN_DT`, `FY_END_DT` — fiscal year (per-facility; drives the vintage stamp)
- `RPT_STUS_CD` — 1 = as-submitted, 2 = settled (no audit), 3 = settled (audit), 4 = reopened
- `PROC_DT`, `INITL_RPT_SW`, `LAST_RPT_SW` — for de-duplication

**`NMRC` columns:** `RPT_REC_NUM`, `WKSHT_CD`, `LINE_NUM`, `CLMN_NUM`, `ITM_VAL_NUM`.
`WKSHT_CD` is a 7-char code (e.g. Worksheet G-3 → `G300000`, Worksheet A →
`A000000`, Worksheet S-3 Part II → `S300002`); `LINE_NUM`/`CLMN_NUM` are
zero-padded. So a metric is a `(WKSHT_CD, LINE_NUM, CLMN_NUM)` triple.

**De-dup (important):** a provider can file multiple reports per fiscal year
(amendments/reopenings). Keep **one report per `(CCN, FY_END_DT)`**: prefer
`LAST_RPT_SW = 'Y'`, then the most recent `PROC_DT`, preferring a settled
`RPT_STUS_CD` where present.

## 3. Extraction targets — PINNED

`nmrc` layout: `RPT_REC_NUM, WKSHT_CD (7-char), LINE_NUM (5-digit), CLMN_NUM
(5-digit), ITM_VAL_NUM`. Coordinates below are **pinned and validated** against a
real FY2025 `nmrc`, confirmed by the cost report's own arithmetic identities
(net patient rev = gross − allowances; net patient income = net rev − opex).

**Margin — Worksheet G-3 `G300000`, column `00100`:**
| Field | LINE_NUM | Check |
|---|---|---|
| Total patient revenue | `00100` | — |
| Net patient revenue | `00300` | = line 100 − line 200 ✓ |
| Total operating expenses | `00400` | — |
| Net income (loss) for the period | `03200` | bottom line ✓ |
- **Operating margin** = (net patient rev − total operating exp) ÷ net patient rev
  → the free-teaser **band** (core patient-services result).
- **Total margin** = net income ÷ total revenue → paid depth (includes
  non-operating "other income", which can mask a loss-making care business —
  e.g. one validated report showed −10.6% operating vs +$6.0M net income).

**Labor — Worksheet S-3 Part II `S300002`:**
| Field | LINE_NUM | CLMN_NUM | Check |
|---|---|---|---|
| Total salaries | `00100` | `00100` | = line 1100 + line 900 ✓ |
| Total paid hours | `00100` | `00500` | col 6 = salaries ÷ hours ✓ |
- **Salary intensity** = total salaries ÷ total operating expenses → the v1
  free-teaser labor metric (rock-solid; observed 31–56%).
- **Contract labor** (the direct-dollar analogue of PBJ agency hours) —
  ⚠️ **deferred.** Candidate lines in `S300002` (e.g. 900 / 1200) are plausible
  but their labels can't be confirmed from values alone; pin against PRM Ch 41
  (or a filed S-3 Part II on snfdata.com) before publishing a contract-labor
  figure. The ingester captures the full S-3 Part II grid so nothing is lost.

## 4. Vintage, caveats, volume

- Stamp every figure with `FY_END_DT` and label it **"structural / lagged (FY
  YYYY)"** — the methodology page already reserves this tier for HCRIS.
- Roll up to chains via the existing crosswalk (verified members only), summing
  dollars — never averaging facility ratios (same rule as PBJ).
- **Related-party distortion:** REIT rent + affiliate management fees depress
  reported margin. Flagged for the paid layer; **excluded from the free teaser**
  per the v1 decision.
- `NMRC` files are large (hundreds of MB/year, tens of millions of rows). The
  ingester **stream-filters to only our ~6 coordinates**, so the committed seed
  stays tiny.

## 5. Build plan (once files land)

1. `etl/ingest_hcris.py`: `RPT` + `NMRC` → per-`(CCN, FY)` financials →
   `data/seed/hcris/…` (compact), **merge-aware** like the other ingesters.
2. Supabase `hcris_facility_year` table + a `load_supabase.py` step; monthly
   workflow gains an HCRIS refresh (annual cadence in practice).
3. UI: free teaser (margin band + labor metric) behind the lagged-vintage chip;
   depth reserved for the subscription.

## References

- CMS — SNF 2540-2010 form & files: <https://www.cms.gov/data-research/statistics-trends-and-reports/cost-reports/skilled-nursing-facility-2540-2010-form>
- CMS Cost Reports (HCRIS) landing: <https://www.cms.gov/Research-Statistics-Data-and-Systems/Downloadable-Public-Use-Files/Cost-Reports>
- Provider Reimbursement Manual, Part II, Chapter 41 (SNF form + instructions)
- NBER HCRIS-SNF documentation (structure reference only; download from CMS): <https://www.nber.org/research/data/hcris-snf>
