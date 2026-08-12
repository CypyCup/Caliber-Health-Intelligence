import Link from "next/link";
import { getSeedMeta, searchFacilities, getAllChains } from "@/lib/data";
import { SearchBox } from "@/components/SearchBox";

export default async function HomePage() {
  const [meta, topRisk, chains] = await Promise.all([
    getSeedMeta(),
    searchFacilities({ hasFlags: true }),
    getAllChains(),
  ]);
  const highlighted = topRisk.slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-tint/60 to-white">
        <div className="container-chi py-16 sm:py-20">
          <p className="kicker">Caliber Health Intelligence · Free public-data surface</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            The workforce economics of every U.S. nursing home — with the vintage on every number.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-soft">
            The Caliber Workforce Atlas turns CMS public data into an underwriting-grade view of
            staffing, turnover, agency reliance, regulatory exposure, and financial pressure — with
            the quarter-over-quarter and year-over-year trends Care Compare doesn&apos;t show.
          </p>

          <div className="mt-8 max-w-xl">
            <SearchBox autoFocus placeholder="Search facilities, cities, chains, or owners…" />
            <p className="mt-2 text-xs text-ink-faint">
              Built for PE, healthcare REITs, and lenders running diligence — and the operators who
              live these numbers.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <Link href="/search?ownerType=pe" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-ink-soft hover:border-brand hover:text-brand">
              PE-backed facilities →
            </Link>
            <Link href="/search?hasFlags=1" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-ink-soft hover:border-brand hover:text-brand">
              Facilities with risk flags →
            </Link>
            <Link href="/search?ownerType=reit" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-ink-soft hover:border-brand hover:text-brand">
              REIT-held facilities →
            </Link>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="container-chi py-14">
        <div className="grid gap-6 md:grid-cols-3">
          <ValueProp
            title="Vintage on every metric"
            body="Staffing is current to the latest PBJ quarter; cost-report financials lag 12–18 months. We disclose which is which, on every number — the discipline that anchors CHI's research."
          />
          <ValueProp
            title="Trends, not snapshots"
            body="Care Compare shows today. The Atlas shows the trajectory: QoQ and YoY movement on staffing, turnover, agency reliance, and ratings, for every facility and every chain."
          />
          <ValueProp
            title="Transparent risk flags"
            body="Every flag ties to one disclosed CMS metric and one published threshold — the CMS staffing minimum, national turnover medians, Immediate Jeopardy. No black-box score."
          />
        </div>
      </section>

      {/* Chains / portfolio lens */}
      <section className="border-y border-slate-200 bg-paper-muted">
        <div className="container-chi py-14">
          <div className="flex items-end justify-between">
            <div>
              <p className="kicker">Portfolio lens</p>
              <h2 className="mt-1 text-2xl font-semibold text-ink">Roll up risk by operator &amp; owner</h2>
              <p className="mt-1 max-w-2xl text-sm text-ink-soft">
                Screen a whole chain the way an underwriter would: census-weighted staffing, how many
                facilities sit below the CMS staffing benchmark, and where Immediate Jeopardy clusters.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chains.map((c) => (
              <Link key={c.id} href={`/chain/${c.id}`} className="card p-4 transition hover:border-brand">
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="mt-1 text-sm text-brand">View portfolio risk roll-up →</p>
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
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink">{row.facility.name}</p>
              </div>
              <p className="text-xs text-ink-faint">{row.facility.city}, TX · {row.chainName ?? "Independent"}</p>
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

      {/* Methodology / trust strip */}
      <section className="border-t border-slate-200 bg-ink text-white">
        <div className="container-chi py-12">
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-2xl font-semibold">Methodological honesty, by design</h2>
              <p className="mt-3 max-w-xl text-slate-300">
                The Atlas uses only public CMS sources. It never claims freshness the underlying data
                doesn&apos;t have. What it shows for free is the data and the trends; the analytical
                synthesis — peer cohorts, financial overlays, forward commentary — is CHI&apos;s
                quarterly research subscription.
              </p>
              <Link href="/methodology" className="mt-5 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-100">
                Read the methodology
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Stat label="Facilities in this demo" value={meta.facilities.toLocaleString()} />
              <Stat label="Operators / chains" value={meta.chains.toLocaleString()} />
              <Stat label="Quarters of history" value={meta.quarters.length.toLocaleString()} />
              <Stat label="Data sources" value="6 CMS datasets" />
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}

function ValueProp({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-ink-soft">{body}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 stat-num text-xl font-semibold">{value}</dd>
    </div>
  );
}
