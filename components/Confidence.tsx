import type { Confidence } from "@/lib/types";

/** Verified vs. inferred badge for entity-resolution (crosswalk) mappings.
 *  Inferred mappings are excluded from published chain-level figures. */
export function ConfidenceBadge({
  confidence,
  className = "",
}: {
  confidence?: Confidence;
  className?: string;
}) {
  if (!confidence) return null;
  if (confidence === "verified") {
    return (
      <span className={`pill border border-emerald-200 bg-emerald-50 text-emerald-700 ${className}`} title="Confirmed against a public filing / CMS affiliated-entity grouping.">
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
          <path d="M2.5 6.3l2.2 2.2L9.5 3.7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Verified
      </span>
    );
  }
  return (
    <span className={`pill border border-slate-300 bg-slate-50 text-ink-faint ${className}`} title="Judgment-based mapping — excluded from published chain-level figures.">
      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
        <circle cx="6" cy="6" r="4.6" stroke="currentColor" strokeWidth="1.4" fill="none" strokeDasharray="2 1.6" />
      </svg>
      Inferred
    </span>
  );
}
