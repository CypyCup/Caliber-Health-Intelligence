import { getPbjNationalTrend } from "@/lib/data/pbj";
import { METRIC_BY_KEY } from "@/lib/metrics";
import { TrendChart } from "./TrendChart";
import type { ResolvedMetric } from "@/lib/types";

/**
 * National nurse agency-reliance trend — the "agency bubble" (2017→2026), built
 * from the PBJ national reference series. Weighted (sum contract ÷ sum nurse
 * hours), so it reproduces the CMS figures.
 */
export function NationalAgencyChart({ compact = false }: { compact?: boolean }) {
  const nat = getPbjNationalTrend();
  if (!nat.length) return null;
  const series = nat
    .map((r) => ({ period: String(r.cy_qtr), value: Number(r.nurse_agency_pct) }))
    .filter((x) => Number.isFinite(x.value));
  if (series.length < 2) return null;

  const first = series[0];
  const latest = series[series.length - 1];
  const peak = series.reduce((a, b) => (b.value > a.value ? b : a));

  const metric: ResolvedMetric = {
    definition: METRIC_BY_KEY["contract_staff_pct"],
    latest_value: latest.value,
    latest_period: latest.period,
    vintage_date: "",
    qoq_delta: null,
    yoy_delta: null,
    history: series,
  };
  const qlabel = (q: string) => q.replace("Q", " Q");

  return (
    <div className={compact ? "" : "card p-5"}>
      {!compact && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="kicker">Sector signal · from PBJ</p>
            <h3 className="mt-1 text-lg font-semibold text-ink">The agency bubble</h3>
          </div>
          <div className="flex gap-5 text-sm">
            <Stat label={`${qlabel(first.period)}`} value={`${first.value.toFixed(1)}%`} />
            <Stat label={`Peak · ${qlabel(peak.period)}`} value={`${peak.value.toFixed(1)}%`} tone="bad" />
            <Stat label={`Now · ${qlabel(latest.period)}`} value={`${latest.value.toFixed(1)}%`} />
          </div>
        </div>
      )}
      <p className="mt-1 text-xs text-ink-faint">
        National nurse agency reliance — contract hours ÷ total nurse hours, all ~14,700 facilities.
      </p>
      <div className="mt-3">
        <TrendChart metric={metric} height={compact ? 150 : 190} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "bad" }) {
  return (
    <div className="text-right">
      <p className={`stat-num text-xl font-semibold ${tone === "bad" ? "text-risk-high" : "text-ink"}`}>{value}</p>
      <p className="text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}
