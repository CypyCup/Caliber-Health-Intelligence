import type { ResolvedMetric, RiskFlag, RiskSeverity } from "./types";
import { BENCHMARKS } from "./benchmarks";
import { SOURCES } from "./metrics";

// ---------------------------------------------------------------------------
// The rule-based risk-flag engine.
//
// Design commitments (Business Plan §3, §4.1):
//   1. Every flag is DETERMINISTIC — same inputs always produce the same flags.
//   2. Every flag traces to ONE disclosed CMS metric and ONE published
//      threshold, both surfaced in the UI.
//   3. There is NO composite score. The Atlas surfaces transparent flags; the
//      analytical synthesis is the paid research product.
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<RiskSeverity, number> = {
  critical: 5,
  high: 4,
  elevated: 3,
  watch: 2,
  info: 1,
};

export function sortFlags(flags: RiskFlag[]): RiskFlag[] {
  return [...flags].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
}

type MetricMap = Record<string, ResolvedMetric | undefined>;

function fmt(n: number, precision = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export interface FacilitySignals {
  special_focus?: string | null;
  abuse_icon?: boolean;
  changed_ownership_12mo?: boolean;
}

/** Compute all fired risk flags for a facility from its resolved metrics, plus
 *  optional CMS facility signals (Special Focus, abuse icon, ownership change). */
export function computeFacilityRiskFlags(metrics: MetricMap, facility?: FacilitySignals): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const m = (k: string) => metrics[k];
  const v = (k: string) => {
    const rm = metrics[k];
    return rm && rm.latest_value != null ? rm.latest_value : null;
  };
  const anyVintage = metrics["overall_star"]?.vintage_date ?? metrics["total_nurse_hprd"]?.vintage_date ?? "";

  // --- CMS facility signals (Provider Information) --------------------------
  if (facility?.special_focus === "SFF") {
    flags.push({
      id: "special_focus", label: "Special Focus Facility", category: "regulatory", severity: "critical",
      metric_key: "special_focus", threshold_text: "CMS Special Focus Facility designation",
      observed_text: "SFF", source: SOURCES.provider.name, vintage_date: anyVintage,
      rationale: "CMS's most serious enforcement status — a persistent record of serious quality problems.",
    });
  } else if (facility?.special_focus === "SFF Candidate") {
    flags.push({
      id: "sff_candidate", label: "Special Focus Facility candidate", category: "regulatory", severity: "elevated",
      metric_key: "special_focus", threshold_text: "CMS SFF candidate list",
      observed_text: "SFF Candidate", source: SOURCES.provider.name, vintage_date: anyVintage,
      rationale: "On CMS's SFF candidate list — among the poorest performers on health inspections.",
    });
  }
  if (facility?.abuse_icon) {
    flags.push({
      id: "abuse_icon", label: "Abuse icon", category: "regulatory", severity: "elevated",
      metric_key: "abuse_icon", threshold_text: "CMS abuse icon flag",
      observed_text: "flagged", source: SOURCES.provider.name, vintage_date: anyVintage,
      rationale: "CMS flags this facility for a citation involving abuse within the last two survey cycles.",
    });
  }
  if (facility?.changed_ownership_12mo) {
    flags.push({
      id: "ownership_change", label: "Ownership changed in last 12 months", category: "regulatory", severity: "watch",
      metric_key: "changed_ownership_12mo", threshold_text: "CMS ownership-change flag",
      observed_text: "recent change", source: SOURCES.provider.name, vintage_date: anyVintage,
      rationale: "A recent change of ownership — a transaction signal, and a period where performance often shifts.",
    });
  }

  // --- Workforce: staffing vs. CMS minimum benchmark -----------------------
  const total = v("total_nurse_hprd");
  if (total != null && total < BENCHMARKS.cms_min_total_nurse_hprd) {
    flags.push(
      mk({
        id: "below_min_total_staffing",
        label: "Below CMS minimum total nurse staffing benchmark",
        category: "workforce",
        severity: "high",
        metric: m("total_nurse_hprd"),
        threshold_text: `< ${BENCHMARKS.cms_min_total_nurse_hprd} total nurse HPRD (${BENCHMARKS.cms_min_rule_label})`,
        observed_text: `${fmt(total)} HPRD`,
        rationale:
          "Total nurse hours fall below the CMS minimum staffing benchmark. Compared as a published benchmark, not a compliance finding.",
      }),
    );
  }

  const rn = v("rn_hprd");
  if (rn != null && rn < BENCHMARKS.cms_min_rn_hprd) {
    flags.push(
      mk({
        id: "below_min_rn_staffing",
        label: "Below CMS minimum RN staffing benchmark",
        category: "workforce",
        severity: "high",
        metric: m("rn_hprd"),
        threshold_text: `< ${BENCHMARKS.cms_min_rn_hprd} RN HPRD (${BENCHMARKS.cms_min_rule_label})`,
        observed_text: `${fmt(rn)} HPRD`,
        rationale:
          "RN hours fall below the CMS minimum RN staffing benchmark — the class of staffing most tied to acute-care capability.",
      }),
    );
  }

  const cna = v("cna_hprd");
  if (cna != null && cna < BENCHMARKS.cms_min_cna_hprd) {
    flags.push(
      mk({
        id: "below_min_cna_staffing",
        label: "Below CMS minimum nurse-aide staffing benchmark",
        category: "workforce",
        severity: "elevated",
        metric: m("cna_hprd"),
        threshold_text: `< ${BENCHMARKS.cms_min_cna_hprd} nurse-aide HPRD (${BENCHMARKS.cms_min_rule_label})`,
        observed_text: `${fmt(cna)} HPRD`,
        rationale: "Nurse-aide hours fall below the CMS minimum nurse-aide staffing benchmark.",
      }),
    );
  }

  // --- Workforce: turnover -------------------------------------------------
  const turnover = v("total_nurse_turnover_pct");
  if (turnover != null && turnover > BENCHMARKS.national_total_nurse_turnover_median_pct) {
    flags.push(
      mk({
        id: "high_turnover",
        label: "Nursing turnover above national median",
        category: "workforce",
        severity: turnover > 70 ? "elevated" : "watch",
        metric: m("total_nurse_turnover_pct"),
        threshold_text: `> ${BENCHMARKS.national_total_nurse_turnover_median_pct}% (CMS national median)`,
        observed_text: `${fmt(turnover, 1)}%`,
        rationale:
          "Turnover above the national median signals workforce instability, elevated agency spend, and continuity-of-care risk.",
      }),
    );
  }

  // --- Workforce: agency reliance -----------------------------------------
  const agency = v("contract_staff_pct");
  if (agency != null && agency > BENCHMARKS.elevated_agency_reliance_pct) {
    flags.push(
      mk({
        id: "high_agency_reliance",
        label: "Elevated agency / contract staffing reliance",
        category: "workforce",
        severity: agency > 35 ? "elevated" : "watch",
        metric: m("contract_staff_pct"),
        threshold_text: `> ${BENCHMARKS.elevated_agency_reliance_pct}% of nurse hours (CHI reference line)`,
        observed_text: `${fmt(agency, 1)}%`,
        rationale:
          "Heavy reliance on contract/agency labor is a leading indicator of staffing instability and a direct drag on operating margin.",
      }),
    );
  }

  // --- Workforce: weekend coverage ----------------------------------------
  const weekend = v("weekend_nurse_hprd");
  if (weekend != null && total != null && total > 0) {
    const ratio = weekend / total;
    if (ratio < BENCHMARKS.weekend_coverage_ratio_floor) {
      flags.push(
        mk({
          id: "low_weekend_staffing",
          label: "Weekend staffing materially below weekday",
          category: "workforce",
          severity: "watch",
          metric: m("weekend_nurse_hprd"),
          threshold_text: `weekend HPRD < ${Math.round(
            BENCHMARKS.weekend_coverage_ratio_floor * 100,
          )}% of overall HPRD (CHI reference line)`,
          observed_text: `${Math.round(ratio * 100)}% of overall`,
          rationale: "Weekend under-coverage concentrates avoidable adverse events and family complaints.",
        }),
      );
    }
  }

  // --- Workforce: declining staffing trend (YoY) ---------------------------
  const totalMetric = m("total_nurse_hprd");
  if (totalMetric && totalMetric.yoy_delta != null && totalMetric.yoy_delta <= -BENCHMARKS.material_staffing_decline_hprd) {
    flags.push(
      mk({
        id: "declining_staffing_trend",
        label: "Total staffing declining year-over-year",
        category: "workforce",
        severity: "elevated",
        metric: totalMetric,
        threshold_text: `YoY change ≤ −${BENCHMARKS.material_staffing_decline_hprd} HPRD (CHI reference line)`,
        observed_text: `${fmt(totalMetric.yoy_delta)} HPRD YoY`,
        rationale:
          "A material year-over-year staffing decline often precedes deterioration in inspection and quality outcomes.",
      }),
    );
  }

  // --- Quality: low staffing / overall stars -------------------------------
  const staffingStar = v("staffing_star");
  if (staffingStar != null && staffingStar <= 2) {
    flags.push(
      mk({
        id: "low_staffing_star",
        label: "Low CMS staffing rating",
        category: "quality",
        severity: staffingStar <= 1 ? "elevated" : "watch",
        metric: m("staffing_star"),
        threshold_text: "≤ 2 of 5 stars (CMS staffing rating)",
        observed_text: `${staffingStar}★`,
        rationale: "A 1–2 star staffing rating reflects case-mix-adjusted staffing in the bottom tiers nationally.",
      }),
    );
  }

  const overallStar = v("overall_star");
  if (overallStar != null && overallStar <= 2) {
    flags.push(
      mk({
        id: "low_overall_star",
        label: "Low CMS overall rating",
        category: "quality",
        severity: "watch",
        metric: m("overall_star"),
        threshold_text: "≤ 2 of 5 stars (CMS overall rating)",
        observed_text: `${overallStar}★`,
        rationale: "A 1–2 star overall rating places the facility in the lower tiers of CMS Five-Star nationally.",
      }),
    );
  }

  // --- Regulatory: Immediate Jeopardy --------------------------------------
  const ij = v("ij_deficiencies");
  if (ij != null && ij >= 1) {
    flags.push(
      mk({
        id: "immediate_jeopardy",
        label: "Immediate Jeopardy citation in latest survey cycle",
        category: "regulatory",
        severity: "critical",
        metric: m("ij_deficiencies"),
        threshold_text: "≥ 1 J/K/L scope-severity citation",
        observed_text: `${ij} citation${ij === 1 ? "" : "s"}`,
        rationale:
          "Immediate Jeopardy is the most serious deficiency class, indicating actual or likely serious harm — a material regulatory and litigation exposure.",
      }),
    );
  }

  // --- Regulatory: civil monetary penalties --------------------------------
  const cmp = v("cmp_amount_trailing");
  if (cmp != null && cmp > BENCHMARKS.significant_cmp_usd) {
    flags.push(
      mk({
        id: "significant_penalties",
        label: "Significant civil monetary penalties (trailing 3 years)",
        category: "regulatory",
        severity: "elevated",
        metric: m("cmp_amount_trailing"),
        threshold_text: `> $${BENCHMARKS.significant_cmp_usd.toLocaleString("en-US")} in trailing-3-yr CMPs`,
        observed_text: `$${Math.round(cmp).toLocaleString("en-US")}`,
        rationale: "A pattern of material penalties signals sustained compliance exposure, not a one-off event.",
      }),
    );
  }

  return sortFlags(flags);
}

function mk(args: {
  id: string;
  label: string;
  category: RiskFlag["category"];
  severity: RiskSeverity;
  metric: ResolvedMetric | undefined;
  threshold_text: string;
  observed_text: string;
  rationale: string;
}): RiskFlag {
  const sourceKey = args.metric?.definition.source ?? "provider";
  return {
    id: args.id,
    label: args.label,
    category: args.category,
    severity: args.severity,
    metric_key: args.metric?.definition.key ?? "",
    threshold_text: args.threshold_text,
    observed_text: args.observed_text,
    source: SOURCES[sourceKey]?.name ?? sourceKey,
    vintage_date: args.metric?.vintage_date ?? "",
    rationale: args.rationale,
  };
}

export const SEVERITY_META: Record<
  RiskSeverity,
  { label: string; tone: string; description: string }
> = {
  critical: { label: "Critical", tone: "risk-critical", description: "Serious harm class — immediate attention." },
  high: { label: "High", tone: "risk-high", description: "Below a published minimum benchmark." },
  elevated: { label: "Elevated", tone: "risk-elevated", description: "Materially worse than reference." },
  watch: { label: "Watch", tone: "risk-watch", description: "Above/below a reference line — monitor." },
  info: { label: "Info", tone: "risk-info", description: "Contextual signal." },
};
