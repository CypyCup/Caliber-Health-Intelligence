import type { MetricCategory } from "./types";

// Catalog for the CMS Nursing Home Chain Performance Measures (real, chain-level).
// Drives labels/units/precision/trend-coloring on the real Operators & chains
// surfaces. Keys match etl/ingest_chain_performance.py.
export interface ChainMetricDef {
  key: string;
  label: string;
  unit: string;
  category: MetricCategory;
  higher_is_better: boolean | null;
  precision: number;
  description?: string;
}

export const CHAIN_METRICS: ChainMetricDef[] = [
  // Workforce
  { key: "total_nurse_hprd", label: "Total nurse staffing", unit: "hrs / resident-day", category: "workforce", higher_is_better: true, precision: 2, description: "Chain-average total nurse hours per resident day." },
  { key: "rn_hprd", label: "RN staffing", unit: "hrs / resident-day", category: "workforce", higher_is_better: true, precision: 2 },
  { key: "weekend_nurse_hprd", label: "Weekend nurse staffing", unit: "hrs / resident-day", category: "workforce", higher_is_better: true, precision: 2 },
  { key: "total_nurse_turnover_pct", label: "Total nursing turnover", unit: "% / year", category: "workforce", higher_is_better: false, precision: 1 },
  { key: "rn_turnover_pct", label: "RN turnover", unit: "% / year", category: "workforce", higher_is_better: false, precision: 1 },
  { key: "admin_departures", label: "Administrator departures", unit: "avg / facility", category: "workforce", higher_is_better: false, precision: 1, description: "Average number of administrators who have left." },

  // Quality
  { key: "overall_star", label: "Overall rating", unit: "stars (1–5)", category: "quality", higher_is_better: true, precision: 1 },
  { key: "health_inspection_star", label: "Health inspection rating", unit: "stars (1–5)", category: "quality", higher_is_better: true, precision: 1 },
  { key: "staffing_star", label: "Staffing rating", unit: "stars (1–5)", category: "quality", higher_is_better: true, precision: 1 },
  { key: "qm_star", label: "Quality measure rating", unit: "stars (1–5)", category: "quality", higher_is_better: true, precision: 1 },
  { key: "rehosp_pct", label: "Short-stay rehospitalization", unit: "%", category: "quality", higher_is_better: false, precision: 1 },
  { key: "ed_visit_pct", label: "Short-stay ED visits", unit: "%", category: "quality", higher_is_better: false, precision: 1 },
  { key: "ls_antipsychotic_pct", label: "Long-stay antipsychotic use", unit: "%", category: "quality", higher_is_better: false, precision: 1 },
  { key: "ls_falls_major_pct", label: "Long-stay falls w/ major injury", unit: "%", category: "quality", higher_is_better: false, precision: 1 },
  { key: "ls_pressure_ulcer_pct", label: "Long-stay pressure ulcers", unit: "%", category: "quality", higher_is_better: false, precision: 1 },
  { key: "ls_uti_pct", label: "Long-stay UTIs", unit: "%", category: "quality", higher_is_better: false, precision: 1 },
  { key: "preventable_readmit_pct", label: "Preventable 30-day readmissions", unit: "%", category: "quality", higher_is_better: false, precision: 1 },

  // Regulatory / financial
  { key: "fines_total_usd", label: "Total fines", unit: "USD", category: "regulatory", higher_is_better: false, precision: 0 },
  { key: "fines_avg_usd", label: "Average fine per facility", unit: "USD", category: "regulatory", higher_is_better: false, precision: 0 },
  { key: "fines_count", label: "Number of fines", unit: "count", category: "regulatory", higher_is_better: false, precision: 0 },
  { key: "payment_denials_total", label: "Payment denials", unit: "count", category: "regulatory", higher_is_better: false, precision: 0 },
];

export const CHAIN_METRIC_BY_KEY: Record<string, ChainMetricDef> = Object.fromEntries(
  CHAIN_METRICS.map((m) => [m.key, m]),
);

export const CHAIN_METRICS_BY_CATEGORY = (c: MetricCategory) =>
  CHAIN_METRICS.filter((m) => m.category === c);
