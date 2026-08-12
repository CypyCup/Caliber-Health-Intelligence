import type { RiskFlag, RiskSeverity } from "@/lib/types";
import { SEVERITY_META } from "@/lib/riskFlags";
import { CATEGORY_LABELS } from "@/lib/metrics";
import { formatVintage } from "@/lib/format";

const SEV_CLASSES: Record<RiskSeverity, { dot: string; text: string; bg: string; border: string }> = {
  critical: { dot: "bg-risk-critical", text: "text-risk-critical", bg: "bg-red-50", border: "border-red-200" },
  high: { dot: "bg-risk-high", text: "text-risk-high", bg: "bg-red-50", border: "border-red-200" },
  elevated: { dot: "bg-risk-elevated", text: "text-risk-elevated", bg: "bg-orange-50", border: "border-orange-200" },
  watch: { dot: "bg-risk-watch", text: "text-risk-watch", bg: "bg-amber-50", border: "border-amber-200" },
  info: { dot: "bg-risk-info", text: "text-risk-info", bg: "bg-cyan-50", border: "border-cyan-200" },
};

export function SeverityPill({ severity }: { severity: RiskSeverity }) {
  const c = SEV_CLASSES[severity];
  return (
    <span className={`pill ${c.bg} ${c.text} border ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {SEVERITY_META[severity].label}
    </span>
  );
}

export function RiskFlagRow({ flag }: { flag: RiskFlag }) {
  const c = SEV_CLASSES[flag.severity];
  return (
    <li className={`rounded-lg border ${c.border} ${c.bg} p-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{flag.label}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{flag.rationale}</p>
        </div>
        <SeverityPill severity={flag.severity} />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-ink-faint sm:grid-cols-4">
        <div><dt className="inline font-medium text-ink-soft">Observed:</dt>{" "}
          <dd className="inline stat-num">{flag.observed_text}</dd></div>
        <div className="sm:col-span-2"><dt className="inline font-medium text-ink-soft">Threshold:</dt>{" "}
          <dd className="inline">{flag.threshold_text}</dd></div>
        <div><dt className="inline font-medium text-ink-soft">Vintage:</dt>{" "}
          <dd className="inline">{formatVintage(flag.vintage_date)}</dd></div>
      </dl>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-faint">
        {CATEGORY_LABELS[flag.category]} · Source: {flag.source}
      </p>
    </li>
  );
}

export function RiskFlagList({ flags }: { flags: RiskFlag[] }) {
  if (flags.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        No rule-based risk flags fired on the disclosed CMS metrics for this facility.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {flags.map((f) => (
        <RiskFlagRow key={f.id} flag={f} />
      ))}
    </ul>
  );
}

/** Compact severity summary used on cards / search rows. */
export function FlagSummary({ flags }: { flags: RiskFlag[] }) {
  if (flags.length === 0) {
    return <span className="pill bg-green-50 text-green-700 border border-green-200">Clear</span>;
  }
  const counts = flags.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});
  const order: RiskSeverity[] = ["critical", "high", "elevated", "watch", "info"];
  return (
    <span className="inline-flex items-center gap-1.5">
      {order.filter((s) => counts[s]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1" title={SEVERITY_META[s].label}>
          <span className={`h-2 w-2 rounded-full ${SEV_CLASSES[s].dot}`} />
          <span className="stat-num text-xs text-ink-soft">{counts[s]}</span>
        </span>
      ))}
    </span>
  );
}
