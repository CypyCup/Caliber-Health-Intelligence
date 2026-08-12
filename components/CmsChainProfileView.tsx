import Link from "next/link";
import type { CmsChainProfile, ResolvedChainMetric } from "@/lib/data/cmsChains";
import type { ChainOwnership } from "@/lib/ownershipOverrides";
import { CHAIN_METRICS_BY_CATEGORY } from "@/lib/cmsChainMetrics";
import { CATEGORY_LABELS } from "@/lib/metrics";
import { StatTile } from "@/components/Badges";
import { StarRating } from "@/components/StarRating";
import { RiskFlagList, FlagSummary } from "@/components/RiskFlags";
import { ConfidenceBadge } from "@/components/Confidence";
import { VintageChip } from "@/components/VintageChip";
import type { Facility, MetricCategory, RiskFlag } from "@/lib/types";

export interface MemberFacility {
  facility: Facility;
  flags: RiskFlag[];
}

function fmt(v: number | null | undefined, unit: string, precision: number): string {
  if (v == null) return "—";
  if (unit === "USD") return `$${Math.round(v).toLocaleString("en-US")}`;
  if (unit.startsWith("stars")) return `${v.toFixed(precision)}★`;
  const n = v.toLocaleString("en-US", { minimumFractionDigits: precision, maximumFractionDigits: precision });
  return unit.includes("%") ? `${n}%` : n;
}

export function CmsChainProfileView({
  profile,
  members = [],
  ownership,
}: {
  profile: CmsChainProfile;
  members?: MemberFacility[];
  ownership?: ChainOwnership;
}) {
  const { chain, metrics, flags, national, latestPeriod } = profile;
  const vint = `${latestPeriod}-01`;
  const sortedMembers = [...members].sort((a, b) => b.flags.length - a.flags.length);

  const total = metrics["total_nurse_hprd"];
  const turn = metrics["total_nurse_turnover_pct"];
  const overall = metrics["overall_star"];
  const staffing = metrics["staffing_star"];

  return (
    <div className="container-chi py-8">
      <nav className="text-xs text-ink-faint">
        <Link href="/chains" className="hover:text-brand">Operators &amp; chains</Link>
        <span className="mx-1">/</span>
        <span>Chain profile</span>
      </nav>

      <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="kicker">Chain profile · real CMS data</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">{chain.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="pill bg-slate-100 text-ink-soft">{Math.round(chain.num_facilities ?? 0)} facilities · {chain.num_states ?? "—"} states</span>
            {(chain.pct_for_profit ?? 0) >= 50 && <span className="pill bg-slate-100 text-ink-soft">{chain.pct_for_profit?.toFixed(0)}% for-profit</span>}
            {ownership?.private_equity && <span className="pill bg-violet-50 text-violet-700 border border-violet-200">PE{ownership.pe_sponsor_name ? `: ${ownership.pe_sponsor_name}` : ""}</span>}
            {ownership?.reit && <span className="pill bg-sky-50 text-sky-700 border border-sky-200">REIT{ownership.reit_name ? `: ${ownership.reit_name}` : ""}</span>}
            {ownership?.public_ticker && <span className="pill bg-slate-100 text-ink-soft">Public: {ownership.public_ticker}</span>}
            {ownership && <ConfidenceBadge confidence={ownership.confidence} />}
            {(chain.sff ?? 0) >= 1 && <span className="pill bg-red-50 text-risk-critical border border-red-200">{Math.round(chain.sff!)} Special Focus</span>}
            {(chain.abuse_count ?? 0) >= 1 && <span className="pill bg-orange-50 text-risk-elevated border border-orange-200">{Math.round(chain.abuse_count!)} abuse icon</span>}
            <VintageChip vintage={vint} period={latestPeriod} />
          </div>
          <p className="mt-2 max-w-2xl text-xs text-ink-faint">
            CMS chain-level performance measures. Facility-level membership, PE-sponsor, and REIT
            resolution are CHI&apos;s value-add and load with the facility ETL.
          </p>
        </div>
        <div className="flex items-center gap-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-center">
            <StarRating value={overall?.latest_value ?? null} />
            <p className="mt-1 text-xs text-ink-faint">Overall (avg)</p>
          </div>
          <div className="text-center">
            <p className="stat-num text-2xl font-semibold text-ink">{flags.length}</p>
            <p className="text-xs text-ink-faint">risk flags</p>
          </div>
        </div>
      </div>

      {/* Headline vs national */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total nurse staffing" value={fmt(total?.latest_value, "hprd", 2)}
          sub={`National ${fmt(national.total_nurse_hprd, "hprd", 2)}`}
          tone={total?.latest_value != null && total.latest_value < 3.48 ? "warn" : "default"} />
        <StatTile label="Nursing turnover" value={fmt(turn?.latest_value, "%", 1)}
          sub={`National ${fmt(national.total_nurse_turnover_pct, "%", 1)}`}
          tone={turn?.latest_value != null && (national.total_nurse_turnover_pct != null) && turn.latest_value > national.total_nurse_turnover_pct ? "warn" : "default"} />
        <StatTile label="Staffing rating" value={fmt(staffing?.latest_value, "stars", 1)} />
        <StatTile label="Facilities" value={Math.round(chain.num_facilities ?? 0).toLocaleString()} sub={`${chain.num_states ?? "—"} states`} />
      </div>

      {/* Risk flags */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">Risk flags</h2>
          <span className="text-xs text-ink-faint">Rule-based · each tied to a CMS chain measure &amp; threshold</span>
        </div>
        <div className="mt-4"><RiskFlagList flags={flags} /></div>
      </section>

      {/* Metrics by category */}
      {(["workforce", "quality", "regulatory"] as MetricCategory[]).map((cat) => {
        const defs = CHAIN_METRICS_BY_CATEGORY(cat);
        const cards = defs.map((d) => ({ d, m: metrics[d.key] })).filter((x) => x.m);
        if (cards.length === 0) return null;
        return (
          <section key={cat} className="mt-10">
            <h2 className="text-xl font-semibold text-ink">{CATEGORY_LABELS[cat]}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map(({ d, m }) => (
                <ChainMetricCard key={d.key} m={m!} nationalValue={national[d.key] ?? null} />
              ))}
            </div>
          </section>
        );
      })}

      {/* Real member facilities (verified via CMS Chain ID) */}
      {sortedMembers.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">Member facilities</h2>
            <span className="text-xs text-ink-faint">{sortedMembers.length} resolved via CMS Chain ID · most at-risk first</span>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-paper-muted text-left text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-medium">Facility</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Mapping</th>
                  <th className="px-4 py-3 font-medium">Risk flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedMembers.slice(0, 100).map(({ facility, flags: ff }) => (
                  <tr key={facility.ccn} className="hover:bg-brand-tint/40">
                    <td className="px-4 py-3">
                      <Link href={`/facility/${facility.ccn}`} className="font-medium text-brand hover:underline">{facility.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{facility.city}, {facility.state}</td>
                    <td className="px-4 py-3"><ConfidenceBadge confidence={facility.chain_confidence} /></td>
                    <td className="px-4 py-3"><FlagSummary flags={ff} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedMembers.length > 100 && (
            <p className="mt-2 text-xs text-ink-faint">Showing the 100 most at-risk of {sortedMembers.length} facilities.</p>
          )}
        </section>
      )}

      <section className="mt-12 rounded-xl border border-slate-200 bg-paper-muted p-6">
        <h2 className="text-lg font-semibold text-ink">Underwriting this operator?</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          These are CMS&apos;s published chain measures. CHI&apos;s quarterly research adds the
          facility-level roll-up, PE-sponsor and REIT resolution, peer-cohort benchmarking, and
          forward-looking workforce commentary.
        </p>
        <Link href="/methodology" className="mt-4 inline-block rounded-lg bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-brand">
          How the research works
        </Link>
      </section>
    </div>
  );
}

function ChainMetricCard({ m, nationalValue }: { m: ResolvedChainMetric; nationalValue: number | null }) {
  const d = m.def;
  const delta = m.prev_delta;
  const improving = delta == null || d.higher_is_better == null ? null : d.higher_is_better ? delta > 0 : delta < 0;
  const deltaClass = improving == null ? "text-ink-faint" : improving ? "text-green-600" : "text-red-600";
  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-ink-soft">{d.label}</p>
      <p className="text-[11px] text-ink-faint">{d.unit}</p>
      <p className="mt-1 stat-num text-2xl font-semibold text-ink">{fmt(m.latest_value, d.unit, d.precision)}</p>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-ink-faint">Nat&apos;l {fmt(nationalValue, d.unit, d.precision)}</span>
        {delta != null && (
          <span className={deltaClass} title="Change vs prior CMS vintage">
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "→"} {fmt(Math.abs(delta), d.unit, d.precision)} MoM
          </span>
        )}
      </div>
    </div>
  );
}
