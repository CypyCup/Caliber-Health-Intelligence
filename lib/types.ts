// Core domain types for the Caliber Workforce Atlas.
//
// The data model is deliberately time-series first: every metric is stored as a
// dated snapshot so the Atlas can show quarter-over-quarter and year-over-year
// trends (the feature that distinguishes it from CMS Care Compare's snapshots),
// and every value carries an explicit vintage — the methodological discipline
// that anchors Caliber Health Intelligence (Business Plan §3, §4.1).

export type OwnershipType =
  | "For-profit"
  | "Non-profit"
  | "Government";

export interface OwnerEntity {
  id: string;
  name: string;
  /** True when a private-equity sponsor sits in the ownership chain. */
  private_equity: boolean;
  /** True when a healthcare REIT is the (or a) property owner/landlord. */
  reit: boolean;
  reit_name?: string;
  pe_sponsor_name?: string;
}

export interface Chain {
  id: string;
  name: string;
  /** Owner entity that controls the chain, if identified. */
  owner_id?: string;
  headquarters_state?: string;
}

export interface Facility {
  /** CMS Certification Number — the primary key across all CMS datasets. */
  ccn: string;
  name: string;
  address: string;
  city: string;
  state: string;
  county: string;
  zip: string;
  ownership_type: OwnershipType;
  certified_beds: number;
  avg_residents_per_day: number;
  chain_id?: string;
  owner_id?: string;
  /** True when we could not attribute the facility to a chain. */
  independent: boolean;
}

/** A single dated observation of one metric for one facility. */
export interface MetricSnapshot {
  ccn: string;
  metric_key: string;
  /** Reporting period, e.g. "2026Q2". */
  period: string;
  value: number | null;
  /** The date the underlying data reflects / was published (vintage). */
  vintage_date: string;
  /** Source dataset key — see SOURCES in lib/metrics.ts. */
  source: string;
}

export type MetricCategory =
  | "workforce"
  | "quality"
  | "regulatory"
  | "financial";

export interface MetricDefinition {
  key: string;
  label: string;
  short_label?: string;
  unit: string;
  category: MetricCategory;
  source: string;
  cadence: string;
  /** Whether a higher value is better for the facility (drives trend coloring). */
  higher_is_better: boolean | null;
  description: string;
  methodology_note: string;
  /** Number of decimal places to display. */
  precision: number;
}

export type RiskSeverity =
  | "info"
  | "watch"
  | "elevated"
  | "high"
  | "critical";

/** A fired, rule-based risk flag. Every flag is deterministic and traceable
 *  back to a single disclosed CMS metric and a published threshold. The Atlas
 *  deliberately does NOT compute a composite black-box score — the analytical
 *  synthesis is reserved for the paid research subscription (Business Plan §4.1). */
export interface RiskFlag {
  id: string;
  label: string;
  category: MetricCategory;
  severity: RiskSeverity;
  /** The metric this flag is derived from. */
  metric_key: string;
  /** Human-readable statement of the threshold that fired the flag. */
  threshold_text: string;
  /** The observed value that tripped the threshold. */
  observed_text: string;
  source: string;
  vintage_date: string;
  rationale: string;
}

/** A metric resolved to its latest value plus QoQ / YoY trend, ready for UI. */
export interface ResolvedMetric {
  definition: MetricDefinition;
  latest_value: number | null;
  latest_period: string;
  vintage_date: string;
  qoq_delta: number | null;
  yoy_delta: number | null;
  /** Full ordered history for sparkline/trend rendering. */
  history: { period: string; value: number | null }[];
}
