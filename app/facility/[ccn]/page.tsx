import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getFacility, getFacilityProfile, getFacilityChow } from "@/lib/data";
import { getFacilityPbjSeries, getFacilityPbjMetrics, getPbjMeta } from "@/lib/data/pbj";
import { PbjSection } from "@/components/PbjSection";
import { isRegistered } from "@/lib/auth";
import { RegistrationWall } from "@/components/RegistrationWall";
import { MetricCard } from "@/components/MetricCard";
import { TrendChart } from "@/components/TrendChart";
import { RiskFlagList } from "@/components/RiskFlags";
import { StarRating } from "@/components/StarRating";
import { OwnershipBadges, StatTile } from "@/components/Badges";
import { VintageChip } from "@/components/VintageChip";
import { ConfidenceBadge } from "@/components/Confidence";
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

  const [profile, chow] = await Promise.all([
    getFacilityProfile(params.ccn),
    getFacilityChow(params.ccn),
  ]);
  if (!profile) notFound();
  const { metrics, flags, owner, chain } = profile;
  const pbjSeries = getFacilityPbjSeries(params.ccn);
  const pbjMetrics = getFacilityPbjMetrics(params.ccn);
  const pbjFlagged = getPbjMeta()?.flagged_quarters ?? {};

  const total = metrics["total_nurse_hprd"];
  const turnover = metrics["total_nurse_turnover_pct"];
  const occupancy = metrics["occupancy_rate"];
  const overall = metrics["overall_star"];

  const trendKeys = ["total_nurse_hprd", "total_nurse_turnover_pct", "rn_hprd", "occupancy_rate"];
  const trendMetrics = trendKeys.map((k) => metrics[k]).filter(Boolean);

  return (
    <div className="container-chi py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-ink-faint">
        <Link href="/search" className="hover:text-brand">Facilities</Link>
        <span className="mx-1">/</span>
        <span>{facility.city}, {facility.state}</span>
      </nav>

      {/* Header */}
      <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink">{facility.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {facility.address}, {facility.city}, {facility.state} {facility.zip} · {facility.county} County
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <OwnershipBadges facility={facility} owner={owner} />
            {facility.special_focus === "SFF" && <span className="pill bg-red-50 text-risk-critical border border-red-200">Special Focus Facility</span>}
            {facility.special_focus === "SFF Candidate" && <span className="pill bg-orange-50 text-risk-elevated border border-orange-200">SFF Candidate</span>}
            {facility.abuse_icon && <span className="pill bg-orange-50 text-risk-elevated border border-orange-200">Abuse icon</span>}
            {facility.changed_ownership_12mo && <span className="pill bg-amber-50 text-risk-watch border border-amber-200">Ownership change (12mo)</span>}
          </div>
          {chain && (
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
              <span>Part of{" "}
                <Link href={`/chain/${chain.id}`} className="link-quiet font-medium">{chain.name}</Link>
                {owner?.pe_sponsor_name && <> · Sponsor: {owner.pe_sponsor_name}</>}
                {owner?.reit_name && <> · Landlord: {owner.reit_name}</>}
              </span>
              <ConfidenceBadge confidence={facility.chain_confidence} />
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
          label="Occupancy"
          value={occupancy ? formatValue(occupancy.latest_value, occupancy.definition) : "—"}
          sub="residents ÷ certified beds"
        />
      </div>
      {facility.pbj_incomplete && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Incomplete PBJ data.</span> CMS could not compute one or more
          turnover/staffing measures for this facility from submitted payroll data (footnote 26/27) —
          read its staffing figures with that caveat.
        </p>
      )}

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

      {/* PBJ staffing & agency (quarterly) */}
      <PbjSection series={pbjSeries} agency={pbjMetrics.agency} hprd={pbjMetrics.hprd} flagged={pbjFlagged} />

      {/* Trends */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink">Trends</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Care Compare has no memory of last quarter. Because CHI archives every vintage, the Atlas
          shows the trajectory.
        </p>
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

      {/* Ownership history (CMS Change of Ownership) */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-ink">Ownership history</h2>
          <span className="text-xs text-ink-faint">CMS Change-of-Ownership records</span>
        </div>
        {chow.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No CMS change-of-ownership record for this facility since 2016.</p>
        ) : (
          <ol className="mt-4 space-y-3 border-l border-slate-200 pl-5">
            {chow.map((tx, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="stat-num text-sm font-semibold text-ink">{tx.date || tx.year}</span>
                  <span className="pill bg-slate-100 text-ink-faint">{tx.type}</span>
                </div>
                <p className="mt-0.5 text-sm text-ink-soft">
                  <span className="text-ink-faint">{tx.seller || "—"}</span>
                  <span className="mx-1.5">→</span>
                  <span className="font-medium text-ink">{tx.buyer || "—"}</span>
                </p>
              </li>
            ))}
          </ol>
        )}
        {facility.changed_ownership_12mo && chow.length > 0 && (
          <p className="mt-3 text-xs text-risk-watch">Provider Information also flags an ownership change in the last 12 months.</p>
        )}
      </section>

      {/* Metric scorecards by category */}
      {(["workforce", "quality", "regulatory", "financial"] as MetricCategory[]).map((cat) => {
        const defs = METRICS_BY_CATEGORY(cat);
        const cards = defs.map((d) => metrics[d.key]).filter(Boolean);
        if (cards.length === 0) return null;
        // The "lagged" note only applies if an actual HCRIS metric is present;
        // occupancy from Provider Information is current.
        const hasLagged = cards.some((m) => m!.definition.source === "hcris");
        return (
          <section key={cat} className="mt-10">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-ink">{CATEGORY_LABELS[cat]}</h2>
              {cat === "financial" && hasLagged && (
                <span className="pill bg-amber-50 text-amber-800 border border-amber-200">
                  Structural / lagged layer
                </span>
              )}
            </div>
            {cat === "financial" && hasLagged && (
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
