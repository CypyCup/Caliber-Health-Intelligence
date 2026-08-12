import type { ResolvedMetric } from "@/lib/types";
import { formatValue, formatDelta, trendTone, trendArrow, type TrendTone } from "@/lib/format";
import { Sparkline } from "./Sparkline";
import { VintageChip } from "./VintageChip";

const TONE_TEXT: Record<TrendTone, string> = {
  good: "text-green-600",
  bad: "text-red-600",
  neutral: "text-ink-faint",
  flat: "text-ink-faint",
};

/** A single workforce/quality metric with latest value, QoQ + YoY trend,
 *  a sparkline, and — always — its vintage. */
export function MetricCard({ metric }: { metric: ResolvedMetric }) {
  const def = metric.definition;
  const isAnnual = def.cadence.toLowerCase().includes("annual");
  const yoyTone = trendTone(metric.yoy_delta, def);
  const qoqTone = trendTone(metric.qoq_delta, def);
  // Label the short-period delta by the actual period granularity: monthly
  // files -> MoM, quarterly -> QoQ.
  const shortLabel = /^\d{4}-\d{2}$/.test(metric.latest_period) ? "MoM" : "QoQ";

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-soft">{def.label}</p>
          <p className="text-[11px] text-ink-faint">{def.unit}</p>
        </div>
        <Sparkline values={metric.history.map((h) => h.value)} tone={yoyTone} />
      </div>

      <div className="mt-2 flex items-baseline gap-3">
        <span className="stat-num text-2xl font-semibold text-ink">
          {formatValue(metric.latest_value, def)}
        </span>
        <div className="flex flex-col text-xs">
          {!isAnnual && (
            <span className={`${TONE_TEXT[qoqTone]}`} title={`${shortLabel === "MoM" ? "Month" : "Quarter"}-over-${shortLabel === "MoM" ? "month" : "quarter"} change`}>
              {trendArrow(metric.qoq_delta)} {formatDelta(metric.qoq_delta, def)} {shortLabel}
            </span>
          )}
          <span className={`${TONE_TEXT[yoyTone]}`} title="Year-over-year change">
            {trendArrow(metric.yoy_delta)} {formatDelta(metric.yoy_delta, def)} YoY
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <VintageChip vintage={metric.vintage_date} period={metric.latest_period} />
      </div>
    </div>
  );
}
