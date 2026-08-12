import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getFacility, getFacilityProfile } from "@/lib/data";
import { isRegistered } from "@/lib/auth";
import { RegistrationWall } from "@/components/RegistrationWall";
import { MetricCard } from "@/components/MetricCard";
import { TrendChart } from "@/components/TrendChart";
import { RiskFlagList } from "@/components/RiskFlags";
import { StarRating } from "@/components/StarRating";
import { OwnershipBadges, StatTile } from "@/components/Badges";
import { VintageChip } from "@/components/VintageChip";
import { METRICS_BY_CATEGORY, CATEGORY_LABELS } from "@/lib/metrics";
import { formatValue } from "@/lib/format";
import type { MetricCategory } from "@/lib/types";

export async function generateMetadata({ params }: { params: { ccn: string } }): Promise<Metadata> {
  const f = await getFacility(params.ccn);
  return { title: f ? f.name : "Facility" };
}

export default async function FacilityPage({ params }: { params: { ccn: string } }) {
  const facility = await getFacility(params.ccn);
  if (!facility) notFound();

  if (!isRegistered()) {
    return <RegistrationWall nextLabel={`the full profile for ${facility.name}`} />;
  }

  const profile = await getFacilityProfile(params.ccn);
  if (!profile) notFound();
  const { metrics, flags, owner, chain } = profile;

  const total = metrics["total_nurse_hprd"];
  const turnover = metrics["total_nurse_turnover_pct"];
  const agency = metrics["contract_staff_pct"];
  const overall = metrics["overall_star"];

  const trendKeys = ["total_nurse_hprd", "total_nurse_turnover_pct", "contract_staff_pct", "rn_hprd"];
  const trendMetrics = trendKeys.map((k) => metrics[k]).filter(Boolean);

  return (
    <div className="container-chi py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-ink-faint">
        <Link href="/search" className="hover:text-brand">Facilities</Link>
        <span className="mx-1">/</span>
        <span>{facility.city}, TX</span>
      </nav>

      {/* Header */}
      <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">{facility.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {facility.address}, {facility.city}, TX {facility.zip} · {facility.county} County
          </p>
          <div className="mt-3">
            <OwnershipBadges facility={facility} owner={owner} />
          </div>
          {chain && (
            <p className="mt-2 text-sm">
              Part of{" "}
              <Link href={`/chain/${chain.id}`} className="link-quiet font-medium">{chain.name}</Link>
              {owner?.pe_sponsor_name && <> · Sponsor: {owner.pe_sponsor_name}</>}
              {owner?.reit_name && <> · Landlord: {owner.reit_name}</>}
            </p>
          )}
          <p className="mt-1 font-mono text-xs text-ink-faint">CCN {facility.ccn}</p>
        </div>
        <div className="flex items-center gap-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-center">
            <StarRating value={overall?.latest_value ?? null} />
            <p className="mt-1 text-xs text-ink-faint">Overall rating</p>
          </div>
          <div className="text-center">
            <p className="stat-num text-2xl font-semibold text-ink">{flags.length}</p>
            <p className="text-xs text-ink-faint">risk flags</p>
          </div>
        </div>
      </div>

      {/* Headline stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Certified beds" value={facility.certified_beds} sub={`${facility.avg_residents_per_day} avg residents/day`} />
        <StatTile
          label="Total nurse staffing"
          value={total ? formatValue(total.latest_value, total.definition) : "—"}
          sub={total ? `HPRD · ${total.latest_period}` : undefined}
        />
        <StatTile
          label="Nursing turnover"
          value={turnover ? formatValue(turnover.latest_value, turnover.definition) : "—"}
          tone={turnover && (turnover.latest_value ?? 0) > 52.5 ? "warn" : "default"}
        />
        <StatTile
          label="Agency reliance"
          value={agency ? formatValue(agency.latest_value, agency.definition) : "—"}
          tone={agency && (agency.latest_value ?? 0) > 20 ? "warn" : "default"}
        />
      </div>

      {/* Risk flags */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">Risk flags</h2>
          <span className="text-xs text-ink-faint">Rule-based · each tied to a CMS metric &amp; published threshold</span>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-ink-soft">
          Transparent signals, not a composite score. The deeper synthesis — peer cohorts, financial
          overlays, and forward commentary — is CHI&apos;s quarterly research.
        </p>
        <div className="mt-4">
          <RiskFlagList flags={flags} />
        </div>
      </section>

      {/* Trends */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink">Trends</h2>
        <p className="mt-1 text-sm text-ink-soft">The trajectory Care Compare doesn&apos;t show.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {trendMetrics.map((m) => (
            <div key={m!.definition.key} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{m!.definition.label}</p>
                  <p className="text-xs text-ink-faint">{m!.definition.unit}</p>
                </div>
                <VintageChip vintage={m!.vintage_date} period={m!.latest_period} />
              </div>
              <div className="mt-2">
                <TrendChart metric={m!} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Metric scorecards by category */}
      {(["workforce", "quality", "regulatory", "financial"] as MetricCategory[]).map((cat) => {
        const defs = METRICS_BY_CATEGORY(cat);
        const cards = defs.map((d) => metrics[d.key]).filter(Boolean);
        if (cards.length === 0) return null;
        return (
          <section key={cat} className="mt-10">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-ink">{CATEGORY_LABELS[cat]}</h2>
              {cat === "financial" && (
                <span className="pill bg-amber-50 text-amber-800 border border-amber-200">
                  Structural / lagged layer
                </span>
              )}
            </div>
            {cat === "financial" && (
              <p className="mt-1 max-w-3xl text-sm text-ink-soft">
                Cost-report metrics run 12–18 months behind. Related-party rent and management fees
                can distort reported margin — read alongside the ownership structure above.
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((m) => (
                <MetricCard key={m!.definition.key} metric={m!} />
              ))}
            </div>
          </section>
        );
      })}

      {/* CTA to research */}
      <section className="mt-12 rounded-xl border border-slate-200 bg-paper-muted p-6">
        <h2 className="text-lg font-semibold text-ink">Underwriting this facility or its operator?</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          The Atlas gives you the public data and the trend. Caliber Health Intelligence&apos;s
          quarterly research adds peer-cohort benchmarking, financial overlays, and forward-looking
          workforce commentary — the synthesis diligence actually turns on.
        </p>
        <Link href="/methodology" className="mt-4 inline-block rounded-lg bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-brand">
          How the research works
        </Link>
      </section>
    </div>
  );
}
