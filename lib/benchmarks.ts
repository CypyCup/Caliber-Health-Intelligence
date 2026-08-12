// Published thresholds and national benchmarks used by the rule-based risk
// flags. Every value here is sourced from a public CMS rule or CMS-published
// national statistic, and every flag that uses one discloses it in-line. This
// keeps the Atlas defensible: no black-box scoring, only transparent rules.

export const BENCHMARKS = {
  // CMS Minimum Staffing Standard for LTC Facilities — Final Rule, May 2024.
  // NOTE ON VINTAGE / STATUS: the rule set 3.48 total nurse HPRD, 0.55 RN HPRD,
  // and 2.45 nurse-aide HPRD, plus a 24/7 on-site RN requirement, phased in
  // over several years. The standard has been the subject of litigation and
  // legislative action since finalization; portions have been challenged and
  // implementation timelines have shifted. The Atlas uses these figures as a
  // published BENCHMARK for comparison, NOT as a compliance determination, and
  // says so wherever the benchmark is applied.
  cms_min_total_nurse_hprd: 3.48,
  cms_min_rn_hprd: 0.55,
  cms_min_cna_hprd: 2.45,
  cms_min_rule_label: "CMS Minimum Staffing Standard (2024 Final Rule benchmark)",

  // CMS-published national medians / reference points (staffing & turnover).
  national_total_nurse_turnover_median_pct: 52.5,
  national_rn_turnover_median_pct: 51.0,

  // Practitioner reference points (disclosed as CHI reference lines, not rules).
  elevated_agency_reliance_pct: 20.0,
  weekend_coverage_ratio_floor: 0.85, // weekend HPRD / overall HPRD
  material_staffing_decline_hprd: 0.25, // YoY drop that we treat as material
  significant_cmp_usd: 100_000,
};

export const NATIONAL_REFERENCE = {
  // Rough national reference bands for context bars on facility pages. These
  // are CHI reference ranges, disclosed as such; they are not CMS medians for
  // every metric and should not be read as compliance lines.
  total_nurse_hprd: { low: 3.0, mid: 3.7, high: 4.5 },
  rn_hprd: { low: 0.4, mid: 0.65, high: 0.9 },
  cna_hprd: { low: 1.9, mid: 2.3, high: 2.8 },
  contract_staff_pct: { low: 2, mid: 8, high: 20 },
  total_nurse_turnover_pct: { low: 35, mid: 52, high: 70 },
};
