# CMS PBJ staffing tables — data dictionary

**Source:** CMS Payroll Based Journal, Daily Nurse Staffing and Daily Non-Nurse
Staffing, downloaded from data.cms.gov on 26 August 2026.
**Coverage:** 2017Q1 – 2026Q1 (37 quarters), 16,158 distinct facilities,
539,243 facility-quarter rows.
**Grain:** one row per facility (PROVNUM) per calendar quarter.
**Built from:** 74 quarterly files, ~32 GB raw, aggregated from ~48 million
facility-day records.

---

## Files

| File | Contents |
|---|---|
| `pbj_atlas_facility_quarter.{parquet,csv.gz}` | **Start here.** 59 columns: identifiers, census, hours and contract hours by staff group, HPRD, agency share. |
| `pbj_nurse_facility_quarter.{parquet,csv.gz}` | All 8 nurse categories at full detail — total / employee / contract, both day bases. |
| `pbj_nonnurse_facility_quarter.{parquet,csv.gz}` | All 25 non-nurse categories at the same detail. |
| `pbj_state_quarter_summary.csv` | State × quarter, hours-weighted. |
| `pbj_national_quarter_trend.csv` | National × quarter — the headline series. |

Prefer the `.parquet` files. Opening the CSVs in Excel will strip the leading
zeros from `provnum` and break every join.

---

## Identifiers and coverage

| Column | Meaning |
|---|---|
| `provnum` | CMS Certification Number, 6 characters, **leading zeros significant** (`015009`). Joins to CMS Care Compare Provider Information. |
| `provname`, `city`, `state`, `county_name`, `county_fips` | Facility identity as reported that quarter. Names and ownership change over time; the value is the one CMS carried in that quarter's file. |
| `cy_qtr`, `year`, `quarter` | Reporting quarter, e.g. `2026Q1`. |
| `days_reported` | Facility-days present in the source file. |
| `days_with_census` | Days with at least one resident. |
| `expected_days` | Calendar days in the quarter. |
| `reporting_completeness_pct` | `days_reported / expected_days × 100`. Below 100 means a partial-quarter submission — a facility that opened, closed, or changed CCN mid-quarter. Filter on this before benchmarking. |
| `resident_days` | Sum of the daily MDS census. This is the HPRD denominator. |
| `avg_daily_census` | `resident_days / days_with_census`. |

## Hours

Every category carries three values in the detail files: total, `_emp`
(facility payroll), `_ctr` (contract/agency). **Total = employee + contract**,
verified to reconcile across all 32 categories and all 37 quarters.

Columns suffixed `__cms` are summed over census days only. CMS excludes
zero-census days from staffing calculations, so **the `__cms` columns are the
ones that reproduce published CMS figures** — the derived metrics in the Atlas
file all use them. The unsuffixed columns cover every reported day and are kept
so nothing from the source is lost. Across the full series the two differ by
23,820 facility-days out of ~48 million.

### Staff groups in the Atlas file

Groupings follow the CMS Five-Star Technical Users' Guide job codes.

| Group | PBJ categories | Job codes |
|---|---|---|
| `rn` | RN Director of Nursing, RN with administrative duties, RN | 5, 6, 7 |
| `lpn` | LPN with administrative duties, LPN/LVN | 8, 9 |
| `aide` | Certified nurse aide, aide in training, medication aide/technician | 10, 11, 12 |
| `total_nurse` | RN + LPN + aide | 5–12 |
| `therapy` | OT, OTA, OT aide, PT, PTA, PT aide, speech-language pathology, respiratory therapist, respiratory tech | |
| `physician_apc` | Medical director, other physician, PA, NP, clinical nurse specialist | |
| `social_activities_mh` | Qualified activities professional, other activities, qualified social worker, other social worker, mental health service | |
| `clinical_support` | Pharmacist, dietician, feeding assistant | |
| `administration` | Administrative staff | |
| `total_nonnurse` | All 25 non-nurse categories | |

For each group: `<group>_hours`, `<group>_contract_hours`, `<group>_hprd`,
`<group>_agency_pct`. Plus `total_hours_all_staff`,
`total_contract_hours_all_staff`, `total_hours_all_staff_hprd`,
`agency_pct_all_staff`.

- `_hprd` = group hours ÷ `resident_days`. Null where resident days are zero.
- `_agency_pct` = contract hours ÷ group hours × 100. Null where the group has
  no hours — a facility with no respiratory therapy has no agency share, which
  is not the same as 0%. **Aggregate agency share by summing hours, never by
  averaging facility percentages.**

---

## Caveats that matter for a client-facing tool

**Self-reported and auditable.** PBJ is submitted by the facility and subject to
CMS audit. It is payroll data, not an observation of who was on the floor.

**CMS restates.** Prior quarters get republished. Stamp every view with the
extraction date. Re-running the pipeline picks up restatements automatically.

**Two-quarter lag.** 2026Q1 was posted in June 2026. Expect the next quarter
around late October. Not an operational instrument.

**2020Q1 is thin.** The published file carries 12,134 facilities against
~14,900 in adjacent quarters, a COVID-era reporting gap. Treat 2020Q1 as
incomplete rather than as a real drop in the provider base.

**2021Q4 carries an incompleteness flag.** 51,475 facility-day records are
marked incomplete by CMS in that quarter's files.

**The facility panel is not stable.** 16,158 CCNs appear across nine years but
only ~14,500 in any one quarter. CCNs retire, transfer, and get reissued.
Same-store trending needs a facility to be present in both endpoints — do not
read national movement as same-facility movement.

**No beds, no ownership, no wages.** PBJ has none of these. Occupancy, chain
roll-ups, and any labor cost figure require joining Care Compare Provider
Information (on `provnum`) and a wage source.

**Hours are not FTEs and not acuity-adjusted.** Raw HPRD is not comparable
across facilities with different case mix. CMS adjusts using PDPM nursing
case-mix indexes; the expected-hours fields for that live in Care Compare, not
here.

**Contract ≠ agency vendor.** `_ctr` means paid outside facility payroll. It
captures agency nursing, and also individual contractors and some management
arrangements. It does not name the staffing vendor.

---

## Source

CMS Payroll Based Journal Daily Nurse Staffing and Daily Non-Nurse Staffing,
data.cms.gov. US Government work, public domain. Methodology per the CMS
Design for Care Compare Nursing Home Five-Star Quality Rating System Technical
Users' Guide.
