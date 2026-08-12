# Data sources & vintage

The Atlas uses **only public CMS data**. No private, client, or employer data of
any kind is used — this is the structural data firewall in the CHI business plan
(§4.1, §11). Every metric below is stamped with an explicit vintage in the UI.

## Two-layer strategy

| Layer | Purpose | Sources | Freshness |
|---|---|---|---|
| **Current backbone** | "What is happening now" | PBJ staffing, Care Compare Five-Star, turnover, deficiencies, penalties | Current to the latest CMS reporting period |
| **Structural / lagged** | "What the economics look like" | HCRIS Medicare cost reports | 12–18 months behind (disclosed) |

## Datasets

| Dataset | Publisher | Cadence | Typical lag | Feeds |
|---|---|---|---|---|
| [PBJ Daily Nurse Staffing](https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing) | CMS | Quarterly | ~4–5 mo | Total/RN/LPN/CNA HPRD, agency %, weekend HPRD |
| [Provider Information (Care Compare)](https://data.cms.gov/provider-data/dataset/4pq5-n9py) | CMS | Monthly | ~1 mo | Five-Star ratings, turnover, beds, census |
| [Health Deficiencies](https://data.cms.gov/provider-data/dataset/r5ix-sfxw) | CMS | Survey-cycle | varies | Deficiency counts, Immediate Jeopardy |
| [Penalties](https://data.cms.gov/provider-data/dataset/g6vv-u9sr) | CMS | Monthly | ~1 mo | CMP totals, payment denials |
| [Ownership](https://data.cms.gov/provider-data/dataset/y2hd-n93e) | CMS | Monthly | ~1 mo | Chain affiliation, PE/REIT flags (heuristic) |
| [HCRIS Cost Reports (SNF)](https://www.cms.gov/data-research/statistics-trends-reports/cost-reports) | CMS | Annual | 12–18 mo | Occupancy, payer mix, operating margin |

## Known limitations (surfaced on `/methodology`)

- Free-view staffing metrics are **not case-mix adjusted** (CMS's staffing star is).
- Reported financials can be distorted by **related-party rent and management fees**.
- PE/REIT classification from CMS ownership records is a **documented heuristic**,
  not an official CMS flag; refine in `etl/build_seed.py::_classify_ownership`.
- The CMS minimum-staffing figures are used as a **published benchmark**, not a
  compliance determination — the standard has faced litigation and shifting
  implementation timelines.
- CHI is **not affiliated with or endorsed by CMS**.
