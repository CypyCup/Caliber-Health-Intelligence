import type { Facility, OwnerEntity } from "@/lib/types";

export function OwnershipBadges({
  facility,
  owner,
}: {
  facility: Facility;
  owner?: OwnerEntity;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="pill bg-slate-100 text-ink-soft">{facility.ownership_type}</span>
      {owner?.private_equity && (
        <span className="pill bg-violet-50 text-violet-700 border border-violet-200" title={owner.pe_sponsor_name}>
          PE-backed
        </span>
      )}
      {owner?.reit && (
        <span className="pill bg-sky-50 text-sky-700 border border-sky-200" title={owner.reit_name}>
          REIT landlord
        </span>
      )}
      {facility.independent ? (
        <span className="pill bg-slate-100 text-ink-faint">Independent</span>
      ) : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "warn" | "bad" | "good";
}) {
  const toneClass = {
    default: "text-ink",
    warn: "text-risk-elevated",
    bad: "text-risk-high",
    good: "text-green-600",
  }[tone];
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`mt-1 stat-num text-2xl font-semibold ${toneClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-faint">{sub}</p>}
    </div>
  );
}
