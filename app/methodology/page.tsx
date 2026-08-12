import type { Metadata } from "next";
import { SOURCES } from "@/lib/metrics";
import { BENCHMARKS } from "@/lib/benchmarks";
import { getSeedMeta, getArchiveInfo } from "@/lib/data";
import { NATIONAL_SCOPE } from "@/lib/scope";

export const metadata: Metadata = { title: "Methodology & sources" };

export default async function MethodologyPage() {
  const [meta, archive] = await Promise.all([getSeedMeta(), getArchiveInfo()]);
  const sources = Object.values(SOURCES);

  return (
    <div className="container-chi max-w-4xl py-10">
      <p className="kicker">Methodology</p>
      <h1 className="mt-1 text-3xl font-semibold text-ink">What the Atlas is built on</h1>
      <p className="mt-3 text-lg text-ink-soft">
        The Atlas is the public-facing surface of a proprietary data asset. Its value isn&apos;t a
        disclosure convention — those are easy to copy — it&apos;s the data underneath: an archive that
        deepens every quarter, and an entity-resolution layer that maps facilities to the
        organizations that own them.
      </p>

      {meta.synthetic && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">This deployment is running the illustrative demo seed.</p>
          <p className="mt-1">{meta.disclaimer}</p>
          <p className="mt-1">
            To load real data, run the CMS ETL pipeline in <code className="font-mono">/etl</code> on a
            network with access to <code className="font-mono">data.cms.gov</code>.
          </p>
        </div>
      )}

      {/* The three assets (the moat) */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink">The data assets</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Three assets that compound over time and are impractical for a new entrant to reproduce quickly.
        </p>
        <div className="mt-4 space-y-3">
          <Asset
            badge="Depth"
            title="The point-in-time archive"
            body={`CMS publishes Provider Information, Five-Star, and PBJ staffing as overwriting snapshots — each refresh replaces the prior file, with no changelog and unannounced revisions. A file not captured in the quarter it is published is not recoverable from CMS afterward. CHI captures every vintage as delivered, alongside a normalized version, a capture timestamp, and a diff against the prior vintage. This demo holds ${archive.depth} quarters (${archive.earliest || "—"}–${archive.latest || "—"}); the production archive deepens every quarter and cannot be bought after the fact, because the input is elapsed time.`}
          />
          <Asset
            badge="Resolution"
            title="The entity-resolution layer"
            body={`A CMS certification number identifies a building, not an owner. Resolving ${NATIONAL_SCOPE.facilities.toLocaleString()} facilities into ${NATIONAL_SCOPE.chains.toLocaleString()} operating chains — and those chains into parent, sponsor, and REIT-landlord relationships — is judgment-heavy work no public file provides in usable form. Every mapping carries a verified-or-inferred flag, and inferred mappings are excluded from published chain-level figures. This is the level at which an investor question is actually asked.`}
          />
          <Asset
            badge="Currency"
            title="The operator panel (forthcoming)"
            body="A short quarterly instrument fielded to SNF HR and operations leaders on wage movement, agency use, open requisitions, and sign-on bonuses. Federal data lags by construction; a panel fielded mid-quarter reports that quarter. It is primary collection gated on written ADP approval, so it is not live in the Atlas — the Atlas is its recruitment surface. No panel figures are shown until the panel reaches publishable scale."
          />
        </div>
      </section>

      {/* Vintage — now framed as the quality floor */}
      <section className="mt-10 rounded-xl border border-slate-200 bg-paper-muted p-6">
        <h2 className="text-lg font-semibold text-ink">Vintage disclosure — the quality floor</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Every metric in the Atlas carries the vintage of its source, and claims about current
          conditions are built only on sources that are actually current. Structural analysis drawn
          from lagged sources (HCRIS cost reports, filings, BLS) is labeled with its lag rather than
          blurred into the present. This is the quality standard governing every CHI deliverable — a
          floor we hold ourselves to, not the moat. It is straightforward for any competitor to adopt,
          which is exactly why it can&apos;t carry the defensibility argument on its own.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="pill bg-white text-green-700 border border-green-200">Current backbone</p>
            <p className="mt-2 text-sm text-ink-soft">
              PBJ staffing, Care Compare Five-Star, turnover, deficiencies, penalties — current to the
              latest CMS reporting period.
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="pill bg-white text-amber-800 border border-amber-200">Structural / lagged</p>
            <p className="mt-2 text-sm text-ink-soft">
              HCRIS Medicare cost-report financials run 12–18 months behind, used only for structural
              analysis with explicit vintage labels.
            </p>
          </div>
        </div>
      </section>

      {/* Sources table */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink">Data sources</h2>
        <p className="mt-1 text-sm text-ink-soft">Public CMS data only. No private, client, or proprietary employer data is used.</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-paper-muted text-left text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Cadence</th>
                <th className="px-4 py-3 font-medium">Typical lag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map((s) => (
                <tr key={s.key}>
                  <td className="px-4 py-3">
                    <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
                      {s.name}
                    </a>
                    <div className="text-xs text-ink-faint">{s.publisher}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{s.cadence}</td>
                  <td className="px-4 py-3 text-ink-soft">{s.typical_lag}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Risk flag methodology */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-ink">How risk flags work</h2>
        <p className="mt-2 text-sm text-ink-soft">
          The Atlas surfaces <strong>transparent, rule-based flags</strong> — never a composite
          black-box score. Every flag is deterministic and traces to exactly one disclosed CMS metric
          and one published threshold. The analytical synthesis — peer cohorts, financial overlays,
          forward commentary — is reserved for the CHI quarterly research subscription.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-ink-soft">
          <li className="card p-3">
            <strong>Staffing benchmarks.</strong> Facilities below {BENCHMARKS.cms_min_total_nurse_hprd} total /
            {" "}{BENCHMARKS.cms_min_rn_hprd} RN / {BENCHMARKS.cms_min_cna_hprd} nurse-aide HPRD are flagged
            against the {BENCHMARKS.cms_min_rule_label}. <em>A benchmark comparison, not a compliance
            determination</em> — the standard has faced litigation and shifting implementation timelines.
          </li>
          <li className="card p-3">
            <strong>Turnover.</strong> Flagged above the CMS national median
            ({BENCHMARKS.national_total_nurse_turnover_median_pct}%).
          </li>
          <li className="card p-3">
            <strong>Agency reliance &amp; weekend coverage.</strong> Flagged against CHI reference lines,
            disclosed as such.
          </li>
          <li className="card p-3">
            <strong>Regulatory.</strong> Any Immediate Jeopardy (J/K/L) citation in the latest survey
            cycle, and trailing-3-year civil monetary penalties above
            ${BENCHMARKS.significant_cmp_usd.toLocaleString("en-US")}.
          </li>
        </ul>
      </section>

      {/* Disclaimers */}
      <section className="mt-10 rounded-xl border border-slate-200 bg-paper-muted p-6">
        <h2 className="text-lg font-semibold text-ink">Important limitations</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
          <li>The Atlas is an informational research surface, not investment, legal, or clinical advice.</li>
          <li>Staffing metrics in this free view are not case-mix adjusted; CMS&apos;s staffing star rating is.</li>
          <li>Entity-resolution mappings flagged <em>inferred</em> are excluded from published chain-level figures; a stale crosswalk can attribute a facility to the wrong operator, so mappings carry a refresh cadence and confidence flag.</li>
          <li>Reported financials can be distorted by related-party rent and management-fee structures.</li>
          <li>Caliber Health Intelligence is not affiliated with or endorsed by CMS.</li>
        </ul>
      </section>
    </div>
  );
}

function Asset({ badge, title, body }: { badge: string; title: string; body: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <span className="kicker">{badge}</span>
      </div>
      <h3 className="mt-1 font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-ink-soft">{body}</p>
    </div>
  );
}
