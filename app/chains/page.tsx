import type { Metadata } from "next";
import { getCmsChainsDirectory, getCmsChainMeta, getCmsNational } from "@/lib/data/cmsChains";
import { getAllChainFacilityRollups } from "@/lib/data";
import { getChainOwnership } from "@/lib/ownershipOverrides";
import { CmsChainsTable, type ChainRow } from "@/components/CmsChainsTable";
import { formatVintage } from "@/lib/format";

export const metadata: Metadata = { title: "Operators & chains" };
export const revalidate = 3600;

export default async function ChainsPage() {
  const dir = getCmsChainsDirectory();
  const meta = getCmsChainMeta();
  const national = getCmsNational();
  const rollups = await getAllChainFacilityRollups();

  const rows: ChainRow[] = dir.map((r) => {
    const own = getChainOwnership(r.chain.id);
    const roll = rollups[r.chain.id];
    return {
      id: r.chain.id,
      name: r.chain.name,
      num_facilities: r.chain.num_facilities,
      num_states: r.chain.num_states,
      overall_star: r.overall_star,
      staffing_star: r.staffing_star,
      total_nurse_hprd: r.total_nurse_hprd,
      turnover_pct: r.turnover_pct,
      fines_total_usd: r.fines_total_usd,
      sff: r.chain.sff,
      sff_candidates: r.chain.sff_candidates,
      abuse_count: r.chain.abuse_count,
      flagCount: r.flagCount,
      topSeverity: r.topSeverity,
      pct_for_profit: r.chain.pct_for_profit,
      privateEquity: own?.private_equity,
      reit: own?.reit,
      publicTicker: own?.public_ticker,
      occupancy_pct: roll?.avg_occupancy_pct ?? null,
      missingPbjPct: roll?.missing_pbj_pct,
    };
  });

  const withSff = dir.filter((r) => (r.chain.sff ?? 0) >= 1).length;
  const belowBench = dir.filter((r) => r.total_nurse_hprd != null && r.total_nurse_hprd < 3.48).length;

  return (
    <div className="container-chi py-10">
      <p className="kicker">The entity-resolution layer · real CMS data</p>
      <h1 className="mt-1 text-3xl font-semibold text-ink">Operators &amp; chains</h1>
      <p className="mt-2 max-w-3xl text-sm text-ink-soft">
        Every operating chain in the U.S. skilled-nursing sector, from CMS&apos;s{" "}
        <a href={meta.source} target="_blank" rel="noreferrer" className="link-quiet">Nursing Home Chain Performance Measures</a>{" "}
        — <strong>{meta.chains.toLocaleString()}</strong> chains over{" "}
        <strong>{meta.national_facilities.toLocaleString()}</strong> facilities, resolved to the level
        an investor question is actually asked at. Real CMS data, vintage {formatVintage((national.vintage_date as string) ?? meta.latest_period + "-01")}.
      </p>
      <p className="mt-2 text-xs text-ink-faint">
        Chain-level measures are real CMS data, and each chain links to its real member facilities
        (via CMS Chain ID). Occupancy and incomplete-PBJ counts are CHI-computed from the facility
        list; PE-sponsor and REIT-landlord resolution is CHI&apos;s value-add layered on top.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Kpi label="Operating chains" value={meta.chains.toLocaleString()} />
        <Kpi label="Facilities (national)" value={meta.national_facilities.toLocaleString()} />
        <Kpi label="Chains below staffing benchmark" value={belowBench.toLocaleString()} tone="warn" />
        <Kpi label="Chains operating an SFF" value={withSff.toLocaleString()} tone="bad" />
      </div>

      <div className="mt-8">
        <CmsChainsTable rows={rows} />
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" | "bad" }) {
  const t = { default: "text-ink", warn: "text-risk-elevated", bad: "text-risk-high" }[tone];
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`mt-1 stat-num text-2xl font-semibold ${t}`}>{value}</p>
    </div>
  );
}
