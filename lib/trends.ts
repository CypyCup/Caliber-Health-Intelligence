import type { MetricSnapshot, ResolvedMetric } from "./types";
import { METRIC_BY_KEY } from "./metrics";

// ---------------------------------------------------------------------------
// Trend resolution. This is the analytical layer the public CMS Care Compare
// interface does NOT provide (Business Plan §4.1): quarter-over-quarter and
// year-over-year movement on every metric.
// ---------------------------------------------------------------------------

/** Parse "2026Q2" -> comparable ordinal (year*4 + quarter). */
export function periodOrdinal(period: string): number {
  const m = /^(\d{4})Q([1-4])$/.exec(period);
  if (!m) return 0;
  return parseInt(m[1], 10) * 4 + parseInt(m[2], 10);
}

export function comparePeriods(a: string, b: string): number {
  return periodOrdinal(a) - periodOrdinal(b);
}

/** Resolve one metric's full history + latest value + QoQ/YoY deltas. */
export function resolveMetric(
  metricKey: string,
  snapshots: MetricSnapshot[],
): ResolvedMetric | null {
  const def = METRIC_BY_KEY[metricKey];
  if (!def) return null;

  const series = snapshots
    .filter((s) => s.metric_key === metricKey)
    .sort((a, b) => comparePeriods(a.period, b.period));

  if (series.length === 0) return null;

  const latest = series[series.length - 1];
  const prevQuarter = series[series.length - 2];

  // YoY: find the snapshot 4 quarters back from latest.
  const targetYoY = periodOrdinal(latest.period) - 4;
  const yoy = series.find((s) => periodOrdinal(s.period) === targetYoY);

  const qoqDelta =
    latest.value != null && prevQuarter?.value != null
      ? round(latest.value - prevQuarter.value, def.precision + 1)
      : null;
  const yoyDelta =
    latest.value != null && yoy?.value != null
      ? round(latest.value - yoy.value, def.precision + 1)
      : null;

  return {
    definition: def,
    latest_value: latest.value,
    latest_period: latest.period,
    vintage_date: latest.vintage_date,
    qoq_delta: qoqDelta,
    yoy_delta: yoyDelta,
    history: series.map((s) => ({ period: s.period, value: s.value })),
  };
}

/** Resolve a set of metric keys into a keyed map. */
export function resolveMetrics(
  metricKeys: string[],
  snapshots: MetricSnapshot[],
): Record<string, ResolvedMetric | undefined> {
  const out: Record<string, ResolvedMetric | undefined> = {};
  for (const key of metricKeys) {
    out[key] = resolveMetric(key, snapshots) ?? undefined;
  }
  return out;
}

function round(n: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
