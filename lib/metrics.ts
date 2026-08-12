import type { MetricDefinition } from "./types";

// ---------------------------------------------------------------------------
// Data sources. Every source carries an honest cadence + typical lag, so the
// UI can disclose vintage on every metric (Business Plan §3: "methodological
// honesty about data vintage" is the moat).
// ---------------------------------------------------------------------------
export interface SourceDef {
  key: string;
  name: string;
  publisher: string;
  cadence: string;
  typical_lag: string;
  url: string;
}

export const SOURCES: Record<string, SourceDef> = {
  pbj: {
    key: "pbj",
    name: "Payroll-Based Journal (PBJ) Daily Nurse Staffing",
    publisher: "CMS",
    cadence: "Quarterly",
    typical_lag: "~4–5 months after quarter close",
    url: "https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing",
  },
  provider: {
    key: "provider",
    name: "Nursing Home Provider Information (Care Compare)",
    publisher: "CMS",
    cadence: "Monthly",
    typical_lag: "~1 month",
    url: "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
  },
  deficiencies: {
    key: "deficiencies",
    name: "Health Deficiencies",
    publisher: "CMS",
    cadence: "Monthly (survey-cycle driven)",
    typical_lag: "Varies by survey timing",
    url: "https://data.cms.gov/provider-data/dataset/r5ix-sfxw",
  },
  penalties: {
    key: "penalties",
    name: "Penalties (CMPs & Payment Denials)",
    publisher: "CMS",
    cadence: "Monthly",
    typical_lag: "~1 month",
    url: "https://data.cms.gov/provider-data/dataset/g6vv-u9sr",
  },
  ownership: {
    key: "ownership",
    name: "Nursing Home Ownership",
    publisher: "CMS",
    cadence: "Monthly",
    typical_lag: "~1 month",
    url: "https://data.cms.gov/provider-data/dataset/y2hd-n93e",
  },
  hcris: {
    key: "hcris",
    name: "Medicare Cost Reports (HCRIS, SNF)",
    publisher: "CMS",
    cadence: "Annual",
    typical_lag: "12–18 months (structural / lagged layer)",
    url: "https://www.cms.gov/data-research/statistics-trends-reports/cost-reports/cost-reports-fiscal-year",
  },
};

// ---------------------------------------------------------------------------
// Metric catalog. This drives the whole app: labels, units, precision, trend
// coloring, and the vintage/methodology disclosures shown next to every number.
// ---------------------------------------------------------------------------
export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // --- Workforce (the core of CHI) -----------------------------------------
  {
    key: "total_nurse_hprd",
    label: "Total nurse staffing",
    short_label: "Total nurse HPRD",
    unit: "hrs / resident-day",
    category: "workforce",
    source: "pbj",
    cadence: "Quarterly",
    higher_is_better: true,
    precision: 2,
    description:
      "Total licensed + aide nurse care hours per resident per day (RN + LPN + nurse aide), from payroll-verified PBJ submissions.",
    methodology_note:
      "Case-mix is not adjusted in this free view. PBJ hours are payroll-verified but self-reported by facilities.",
  },
  {
    key: "rn_hprd",
    label: "RN staffing",
    short_label: "RN HPRD",
    unit: "hrs / resident-day",
    category: "workforce",
    source: "pbj",
    cadence: "Quarterly",
    higher_is_better: true,
    precision: 2,
    description: "Registered Nurse care hours per resident per day.",
    methodology_note: "Excludes RN hours coded to administrative-only roles where identifiable.",
  },
  {
    key: "lpn_hprd",
    label: "LPN/LVN staffing",
    short_label: "LPN HPRD",
    unit: "hrs / resident-day",
    category: "workforce",
    source: "pbj",
    cadence: "Quarterly",
    higher_is_better: true,
    precision: 2,
    description: "Licensed Practical / Vocational Nurse care hours per resident per day.",
    methodology_note: "PBJ payroll-verified.",
  },
  {
    key: "cna_hprd",
    label: "Nurse aide staffing",
    short_label: "CNA HPRD",
    unit: "hrs / resident-day",
    category: "workforce",
    source: "pbj",
    cadence: "Quarterly",
    higher_is_better: true,
    precision: 2,
    description: "Certified Nurse Aide care hours per resident per day.",
    methodology_note: "PBJ payroll-verified.",
  },
  {
    key: "contract_staff_pct",
    label: "Agency / contract reliance",
    short_label: "Agency %",
    unit: "% of nurse hours",
    category: "workforce",
    source: "pbj",
    cadence: "Quarterly",
    higher_is_better: false,
    precision: 1,
    description:
      "Share of total nurse hours delivered by contract / agency staff rather than employees — a leading indicator of staffing instability and margin pressure.",
    methodology_note: "Derived from PBJ contract-hours fields as a percentage of total nurse hours.",
  },
  {
    key: "weekend_nurse_hprd",
    label: "Weekend nurse staffing",
    short_label: "Weekend HPRD",
    unit: "hrs / resident-day",
    category: "workforce",
    source: "pbj",
    cadence: "Quarterly",
    higher_is_better: true,
    precision: 2,
    description: "Total nurse HPRD on Saturdays and Sundays — where coverage gaps concentrate.",
    methodology_note: "Compared against overall HPRD to surface weekend under-coverage.",
  },
  {
    key: "total_nurse_turnover_pct",
    label: "Total nursing turnover",
    short_label: "Turnover %",
    unit: "% / year",
    category: "workforce",
    source: "provider",
    cadence: "Quarterly (rolling)",
    higher_is_better: false,
    precision: 1,
    description:
      "Percentage of nursing staff who left over a rolling 12-month window — the single clearest workforce-instability signal.",
    methodology_note: "CMS-published rolling turnover; not case-mix adjusted.",
  },
  {
    key: "rn_turnover_pct",
    label: "RN turnover",
    short_label: "RN turnover %",
    unit: "% / year",
    category: "workforce",
    source: "provider",
    cadence: "Quarterly (rolling)",
    higher_is_better: false,
    precision: 1,
    description: "Rolling 12-month turnover among registered nurses specifically.",
    methodology_note: "CMS-published rolling turnover.",
  },

  // --- Quality (Five-Star) --------------------------------------------------
  {
    key: "overall_star",
    label: "Overall rating",
    short_label: "Overall ★",
    unit: "stars (1–5)",
    category: "quality",
    source: "provider",
    cadence: "Monthly",
    higher_is_better: true,
    precision: 0,
    description: "CMS Five-Star overall quality rating.",
    methodology_note: "Composite of health inspection, staffing, and quality-measure domains.",
  },
  {
    key: "staffing_star",
    label: "Staffing rating",
    short_label: "Staffing ★",
    unit: "stars (1–5)",
    category: "quality",
    source: "provider",
    cadence: "Monthly",
    higher_is_better: true,
    precision: 0,
    description: "CMS Five-Star staffing rating (case-mix adjusted RN and total nurse staffing).",
    methodology_note: "Derived by CMS from PBJ with case-mix adjustment.",
  },
  {
    key: "health_inspection_star",
    label: "Health inspection rating",
    short_label: "Inspection ★",
    unit: "stars (1–5)",
    category: "quality",
    source: "provider",
    cadence: "Monthly",
    higher_is_better: true,
    precision: 0,
    description: "CMS Five-Star health-inspection rating from the three most recent survey cycles.",
    methodology_note: "Weighted toward the most recent survey.",
  },
  {
    key: "qm_star",
    label: "Quality measure rating",
    short_label: "QM ★",
    unit: "stars (1–5)",
    category: "quality",
    source: "provider",
    cadence: "Monthly",
    higher_is_better: true,
    precision: 0,
    description: "CMS Five-Star quality-measure rating from MDS and claims-based measures.",
    methodology_note: "Blends short-stay and long-stay quality measures.",
  },

  // --- Regulatory -----------------------------------------------------------
  {
    key: "total_deficiencies",
    label: "Health deficiencies (latest cycle)",
    short_label: "Deficiencies",
    unit: "count",
    category: "regulatory",
    source: "deficiencies",
    cadence: "Survey cycle",
    higher_is_better: false,
    precision: 0,
    description: "Number of health-deficiency citations in the most recent standard survey cycle.",
    methodology_note: "Survey timing varies by facility; counts are not survey-length adjusted.",
  },
  {
    key: "ij_deficiencies",
    label: "Immediate Jeopardy citations",
    short_label: "IJ citations",
    unit: "count",
    category: "regulatory",
    source: "deficiencies",
    cadence: "Survey cycle",
    higher_is_better: false,
    precision: 0,
    description:
      "Citations at Immediate Jeopardy scope/severity (J, K, or L) — the most serious deficiency class, indicating actual or likely serious harm.",
    methodology_note: "Counts J/K/L scope-severity codes in the latest cycle.",
  },
  {
    key: "cmp_amount_trailing",
    label: "Civil monetary penalties (3-yr)",
    short_label: "CMP $ (3yr)",
    unit: "USD",
    category: "regulatory",
    source: "penalties",
    cadence: "Monthly",
    higher_is_better: false,
    precision: 0,
    description: "Total civil monetary penalties levied by CMS over the trailing three years.",
    methodology_note: "Sum of CMP amounts; excludes penalties under appeal where flagged by CMS.",
  },

  // --- Financial (structural / lagged layer) --------------------------------
  {
    key: "occupancy_pct",
    label: "Occupancy",
    short_label: "Occupancy %",
    unit: "% of beds",
    category: "financial",
    source: "hcris",
    cadence: "Annual",
    higher_is_better: true,
    precision: 1,
    description: "Average daily census as a share of certified beds.",
    methodology_note:
      "STRUCTURAL / LAGGED layer — HCRIS cost reports run 12–18 months behind. Vintage disclosed explicitly.",
  },
  {
    key: "medicaid_pct",
    label: "Medicaid payer mix",
    short_label: "Medicaid %",
    unit: "% of days",
    category: "financial",
    source: "hcris",
    cadence: "Annual",
    higher_is_better: null,
    precision: 1,
    description: "Share of resident-days reimbursed by Medicaid — the lowest-margin payer.",
    methodology_note: "STRUCTURAL / LAGGED layer — HCRIS. High Medicaid concentration compresses margin.",
  },
  {
    key: "operating_margin_pct",
    label: "Operating margin",
    short_label: "Op. margin %",
    unit: "%",
    category: "financial",
    source: "hcris",
    cadence: "Annual",
    higher_is_better: true,
    precision: 1,
    description: "Facility operating margin from the Medicare cost report.",
    methodology_note:
      "STRUCTURAL / LAGGED layer — HCRIS runs 12–18 months behind. Related-party rent and management fees can distort reported margin.",
  },
];

export const METRIC_BY_KEY: Record<string, MetricDefinition> = Object.fromEntries(
  METRIC_DEFINITIONS.map((m) => [m.key, m]),
);

export const METRICS_BY_CATEGORY = (category: MetricDefinition["category"]) =>
  METRIC_DEFINITIONS.filter((m) => m.category === category);

export const CATEGORY_LABELS: Record<MetricDefinition["category"], string> = {
  workforce: "Workforce",
  quality: "Quality",
  regulatory: "Regulatory",
  financial: "Financial",
};
