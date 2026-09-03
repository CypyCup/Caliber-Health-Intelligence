import Link from "next/link";
import { getSeedMeta, searchFacilities } from "@/lib/data";
import { getCmsChainsDirectory, getCmsChainMeta } from "@/lib/data/cmsChains";
import { SearchBox } from "@/components/SearchBox";
import { PanelCTA } from "@/components/PanelCTA";
import { NationalAgencyChart } from "@/components/NationalAgencyChart";

// ISR: serve fast, refresh hourly so Supabase-backed deployments aren't stale.
export const revalidate = 3600;

export default async function HomePage() {
  const [meta, topRisk] = await Promise.all([
    getSeedMeta(),
    searchFacilities({ hasFlags: true }),
  ]);
  const chainMeta = getCmsChainMeta();
  const chains = getCmsChainsDirectory();
  const highlighted = topRisk.slice(0, 6);
  const topChains = chains.slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-tint/60 to-white">
        <div className="container-chi py-16 sm:py-20">
          <p className="kicker">Caliber Health Intelligence · Free public-data surface</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Every U.S. nursing home, resolved to the chains, sponsors, and REITs that own it.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-soft">
            The Caliber Workforce Atlas sits on a proprietary data asset:{" "}
            <strong>{chainMeta.national_facilities.toLocaleString()}</strong> facilities resolved into{" "}
            <strong>{chainMeta.chains.toLocaleString()}</strong> operating chains, and a
            point-in-time archive of every release CMS publishes and then overwrites. That&apos;s the
            staffing, turnover, and ownership picture at the level an underwriter actually decides on.
          </p>

          <div className="mt-8 max-w-xl">
            <SearchBox autoFocus placeholder="Search facilities, chains, sponsors, or REITs…" />
            <p className="mt-2 text-xs text-ink-faint">
              Built for PE, healthcare REITs, and lenders running diligence — and the operators who
              live these numbers.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <Link href="/chains" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-ink-soft hover:border-brand hover:text-brand">
              Browse operators &amp; chains →
            </Link>
            <Link href="/search?ownerType=pe" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-ink-soft hover:border-brand hover:text-brand">
              PE-backed facilities →
            </Link>
            <Link href="/search?ownerType=reit" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-ink-soft hover:border-brand hover:text-brand">
              REIT-held facilities →
            </Link>
          </div>
        </div>
      </section>

      {/* The three assets */}
      <section className="container-chi py-14">
        <p className="kicker">Why the Atlas is different</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">Research on a proprietary data asset</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Like PitchBook for private markets, the value isn&apos;t a disclosure convention anyone can
          copy — it&apos;s the data underneath, which compounds every quarter.
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <ValueProp
            badge="Resolution"
            title="Ownership, resolved"
            body="A CCN names a building, not who owns it. We map facilities to their operating chain, private-equity sponsor, and REIT landlord — the only level at which a portfolio question can be answered. Every mapping is flagged verified or inferred."
          />
          <ValueProp
            badge="Depth"
            title="The point-in-time archive"
            body="CMS overwrites its files each cycle with no changelog. We capture every vintage as published, so the Atlas remembers what the record said last quarter and last year. A competitor starting in 2030 can't buy elapsed time."
          />
          <ValueProp
            badge="Trend"
            title="History Care Compare deletes"
            body="Care Compare shows today, with no memory of yesterday. Because we own the archive, the Atlas shows quarter-over-quarter and year-over-year movement on every metric — and the trend line deepens every quarter."
          />
        </div>
        <p className="mt-6 max-w-3xl text-xs text-ink-faint">
          A quality floor underneath all of it: every metric carries an explicit vintage, and current
          claims are built only on genuinely current sources. That discipline is table stakes, not the
          moat — the moat is the asset above.
        </p>

        <div className="mt-8">
          <NationalAgencyChart />
          <p className="mt-2 max-w-3xl text-sm text-ink-soft">
            Nine years of payroll-verified staffing (PBJ) let the Atlas show the sector&apos;s agency
            boom and unwind — reliance more than quintupled into 2022, then fell by half. Every
            facility and chain carries this history.
          </p>
        </div>
      </section>

      {/* Chains / portfolio lens */}
      <section className="border-y border-slate-200 bg-paper-muted">
        <div className="container-chi py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="kicker">Portfolio lens · the entity-resolution layer</p>
              <h2 className="mt-1 text-2xl font-semibold text-ink">Screen operators the way an underwriter would</h2>
              <p className="mt-1 max-w-2xl text-sm text-ink-soft">
                Census-weighted staffing, how many facilities sit below the CMS staffing benchmark, and
                where Immediate Jeopardy clusters — rolled up by chain, sponsor, and landlord.
              </p>
            </div>
            <Link href="/chains" className="text-sm font-medium text-brand hover:text-brand-deep">
              All operators &amp; chains →
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topChains.map((c) => (
              <Link key={c.chain.id} href={`/chain/${c.chain.id}`} className="card p-4 transition hover:border-brand">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{c.chain.name}</p>
                  <div className="flex gap-1">
                    {(c.chain.sff ?? 0) >= 1 && <span className="pill bg-red-50 text-risk-critical border border-red-200">{Math.round(c.chain.sff!)} SFF</span>}
                  </div>
                </div>
                <p className="mt-1 text-xs text-ink-faint">{Math.round(c.chain.num_facilities ?? 0)} facilities · {c.total_nurse_hprd?.toFixed(2) ?? "—"} HPRD · {c.turnover_pct?.toFixed(0) ?? "—"}% turnover</p>
                <p className="mt-2 text-xs">
                  <span className="font-medium text-risk-high">{c.flagCount}</span>
                  <span className="text-ink-faint"> risk flag{c.flagCount === 1 ? "" : "s"}</span>
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Highlighted at-risk facilities */}
      <section className="container-chi py-14">
        <p className="kicker">Sample screen</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">Facilities carrying the most risk flags</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {highlighted.map((row) => (
            <Link key={row.facility.ccn} href={`/facility/${row.facility.ccn}`} className="card p-4 transition hover:border-brand">
              <p className="font-semibold text-ink">{row.facility.name}</p>
              <p className="text-xs text-ink-faint">{row.facility.city}, {row.facility.state} · {row.chainName ?? "Independent"}</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-ink-soft">
                  {row.total_nurse_hprd?.toFixed(2) ?? "—"} HPRD · {row.turnover_pct?.toFixed(0) ?? "—"}% turnover
                </span>
                <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                  {row.flagCount} flags
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-6">
          <Link href="/search" className="link-quiet text-sm font-medium">Explore all facilities →</Link>
        </div>
      </section>

      {/* Operator panel recruitment */}
      <section className="container-chi pb-4">
        <PanelCTA />
      </section>

      {/* Trust strip */}
      <section className="mt-10 border-t border-slate-200 bg-ink text-white">
        <div className="container-chi py-12">
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-2xl font-semibold">A data asset, not a disclosure convention</h2>
              <p className="mt-3 max-w-xl text-slate-300">
                The Atlas uses only public CMS sources, and it never claims freshness the underlying
                data doesn&apos;t have. What it shows for free is the resolved data and the trend the
                archive makes possible; the analytical synthesis — peer cohorts, financial overlays,
                forward commentary — is CHI&apos;s quarterly research subscription.
              </p>
              <Link href="/methodology" className="mt-5 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-100">
                Read the methodology
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Stat label="Facilities (national, CMS)" value={chainMeta.national_facilities.toLocaleString()} />
              <Stat label="Operating chains (CMS)" value={chainMeta.chains.toLocaleString()} />
              <Stat label="Chain data vintage" value={fmtPeriod(chainMeta.latest_period)} />
              <Stat label="Facility demo (this build)" value={`${meta.facilities} facilities`} />
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}

function ValueProp({ badge, title, body }: { badge: string; title: string; body: string }) {
  return (
    <div className="card p-5">
      <span className="kicker">{badge}</span>
      <h3 className="mt-1 font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-ink-soft">{body}</p>
    </div>
  );
}

/** "2026-09" -> "Sep 2026" (falls back to the raw value if unparseable). */
function fmtPeriod(period: string): string {
  const [y, m] = (period || "").split("-");
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1];
  return mon && y ? `${mon} ${y}` : period || "—";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 stat-num text-xl font-semibold">{value}</dd>
    </div>
  );
}
