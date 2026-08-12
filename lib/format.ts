import type { MetricDefinition, ResolvedMetric } from "./types";

export function formatValue(value: number | null, def: MetricDefinition): string {
  if (value == null) return "—";
  if (def.unit === "USD") return `$${Math.round(value).toLocaleString("en-US")}`;
  if (def.unit.startsWith("stars")) return `${value}★`;
  const n = value.toLocaleString("en-US", {
    minimumFractionDigits: def.precision,
    maximumFractionDigits: def.precision,
  });
  if (def.unit.startsWith("%") || def.unit.includes("%")) return `${n}%`;
  return n;
}

export function formatDelta(delta: number | null, def: MetricDefinition): string {
  if (delta == null) return "—";
  const sign = delta > 0 ? "+" : "";
  if (def.unit === "USD") return `${sign}$${Math.round(delta).toLocaleString("en-US")}`;
  const n = Math.abs(delta).toLocaleString("en-US", {
    minimumFractionDigits: def.precision,
    maximumFractionDigits: def.precision,
  });
  return `${delta < 0 ? "−" : "+"}${n}`;
}

/** Trend direction relative to what's "good" for the metric. */
export type TrendTone = "good" | "bad" | "neutral" | "flat";

export function trendTone(delta: number | null, def: MetricDefinition): TrendTone {
  if (delta == null) return "neutral";
  if (delta === 0) return "flat";
  if (def.higher_is_better == null) return "neutral";
  const improving = def.higher_is_better ? delta > 0 : delta < 0;
  return improving ? "good" : "bad";
}

export function trendArrow(delta: number | null): string {
  if (delta == null || delta === 0) return "→";
  return delta > 0 ? "▲" : "▼";
}

/** Format a vintage date as a short, honest disclosure string. */
export function formatVintage(vintage: string): string {
  if (!vintage) return "vintage n/a";
  const d = new Date(vintage);
  if (isNaN(d.getTime())) return vintage;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

export function metricLatestLabel(rm: ResolvedMetric): string {
  return `${formatValue(rm.latest_value, rm.definition)}`;
}
