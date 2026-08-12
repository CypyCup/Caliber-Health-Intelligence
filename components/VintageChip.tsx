import { formatVintage } from "@/lib/format";

/** The signature CHI element: an explicit vintage disclosure on every number. */
export function VintageChip({
  vintage,
  period,
  className = "",
}: {
  vintage: string;
  period?: string;
  className?: string;
}) {
  return (
    <span
      title={`Data vintage: ${vintage || "unknown"}${period ? ` · reporting period ${period}` : ""}`}
      className={`pill bg-slate-100 text-ink-faint ${className}`}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden className="opacity-70">
        <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 3.2V6l1.8 1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
      <span className="tabular-nums">as of {formatVintage(vintage)}</span>
    </span>
  );
}
