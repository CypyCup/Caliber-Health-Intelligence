import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getChain, getChainProfile } from "@/lib/data";
import { isRegistered } from "@/lib/auth";
import { RegistrationWall } from "@/components/RegistrationWall";
import { StatTile } from "@/components/Badges";
import { StarRating } from "@/components/StarRating";
import { FlagSummary } from "@/components/RiskFlags";
import { BENCHMARKS } from "@/lib/benchmarks";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const c = await getChain(params.id);
  return { title: c ? c.name : "Operator" };
}

export default async function ChainPage({ params }: { params: { id: string } }) {
  const chain = await getChain(params.id);
  if (!chain) notFound();

  if (!isRegistered()) {
    return <RegistrationWall nextLabel={`the portfolio risk roll-up for ${chain.name}`} />;
  }

  const profile = await getChainProfile(params.id);
  if (!profile) notFound();
  const { owner, facilities, facilityFlags, aggregates: a } = profile;

  const belowPct = a.facility_count ? Math.round((a.facilities_below_staffing_benchmark / a.facility_count) * 100) : 0;

  return (
    <div className="container-chi py-8">
      <nav className="text-xs text-ink-faint">
        <Link href="/search" className="hover:text-brand">Facilities</Link>
        <span className="mx-1">/</span>
        <span>Operators</span>
      </nav>

      <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="kicker">Portfolio roll-up</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">{chain.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {owner?.private_equity && (
              <span className="pill bg-violet-50 text-violet-700 border border-violet-200">
                PE sponsor: {owner.pe_sponsor_name}
              </span>
            )}
            {owner?.reit && (
              <span className="pill bg-sky-50 text-sky-700 border border-sky-200">
                REIT landlord: {owner.reit_name}
              </span>
            )}
            <span className="pill bg-slate-100 text-ink-soft">{a.facility_count} facilities · TX</span>
          </div>
        </div>
      </div>

      {/* Portfolio aggregates */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Census-wtd total staffing"
          value={a.avg_total_nurse_hprd?.toFixed(2) ?? "—"}
          sub="HPRD across portfolio"
          tone={a.avg_total_nurse_hprd != null && a.avg_total_nurse_hprd < BENCHMARKS.cms_min_total_nurse_hprd ? "warn" : "default"}
        />
        <StatTile
          label="Census-wtd turnover"
          value={a.avg_turnover_pct != null ? `${a.avg_turnover_pct.toFixed(0)}%` : "—"}
          tone={a.avg_turnover_pct != null && a.avg_turnover_pct > BENCHMARKS.national_total_nurse_turnover_median_pct ? "warn" : "default"}
        />
        <StatTile
          label="Census-wtd agency reliance"
          value={a.avg_agency_pct != null ? `${a.avg_agency_pct.toFixed(0)}%` : "—"}
          tone={a.avg_agency_pct != null && a.avg_agency_pct > BENCHMARKS.elevated_agency_reliance_pct ? "warn" : "default"}
        />
        <StatTile label="Avg overall rating" value={a.avg_overall_star?.toFixed(1) ?? "—"} sub="stars (unweighted)" />
      </div>

      {/* Portfolio risk exposure */}
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Portfolio risk exposure</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ExposureBar
            label="Below CMS staffing benchmark"
            count={a.facilities_below_staffing_benchmark}
            total={a.facility_count}
            tone="high"
          />
          <ExposureBar
            label="Turnover above national median"
            count={a.facilities_high_turnover}
            total={a.facility_count}
            tone="watch"
          />
          <ExposureBar
            label="Immediate Jeopardy (latest cycle)"
            count={a.facilities_with_ij}
            total={a.facility_count}
            tone="critical"
          />
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          {belowPct}% of this portfolio&apos;s facilities sit below the CMS minimum total-staffing
          benchmark, and it carries {a.total_flags} risk flags in total. Each flag traces to a
          disclosed CMS metric on the facility page.
        </p>
      </section>

      {/* Facility table */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">Facilities in this portfolio</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-paper-muted text-left text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Facility</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium text-right">Beds</th>
                <th className="px-4 py-3 font-medium">Risk flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facilities.map((f) => (
                <tr key={f.ccn} className="hover:bg-brand-tint/40">
                  <td className="px-4 py-3">
                    <Link href={`/facility/${f.ccn}`} className="font-medium text-brand hover:underline">{f.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{f.city}</td>
                  <td className="px-4 py-3 text-right stat-num">{f.certified_beds}</td>
                  <td className="px-4 py-3"><FlagSummary flags={facilityFlags[f.ccn] ?? []} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ExposureBar({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: "high" | "watch" | "critical";
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  const bar = { high: "bg-risk-high", watch: "bg-risk-watch", critical: "bg-risk-critical" }[tone];
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-soft">{label}</span>
        <span className="stat-num text-sm font-semibold text-ink">{count}/{total}</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
