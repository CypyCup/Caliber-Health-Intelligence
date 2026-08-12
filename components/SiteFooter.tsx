import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-paper-muted">
      <div className="container-chi grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="max-w-xs">
          <p className="font-semibold text-ink">Caliber Health Intelligence</p>
          <p className="mt-2 text-sm text-ink-faint">
            Rigorous workforce economics research for the healthcare investors and operators whose
            decisions have to hold up under scrutiny.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Atlas</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="link-quiet" href="/search">Explore facilities</Link></li>
            <li><Link className="link-quiet" href="/chains">Operators &amp; chains</Link></li>
            <li><Link className="link-quiet" href="/compare">Compare facilities</Link></li>
            <li><Link className="link-quiet" href="/methodology">Methodology &amp; sources</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Data</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-faint">
            <li>CMS PBJ staffing</li>
            <li>CMS Care Compare &amp; Five-Star</li>
            <li>Deficiencies &amp; penalties</li>
            <li>HCRIS cost reports</li>
          </ul>
        </div>
        <div className="text-sm text-ink-faint">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Disclosure</p>
          <p className="mt-3">
            Built on public CMS data — a captured archive plus an ownership crosswalk. Every metric
            carries its vintage. The Atlas surfaces transparent, rule-based signals — not investment
            advice.
          </p>
        </div>
      </div>
      <div className="border-t border-slate-200">
        <div className="container-chi flex flex-col justify-between gap-2 py-4 text-xs text-ink-faint sm:flex-row">
          <p>© {new Date().getFullYear()} Caliber Health Intelligence. Not affiliated with CMS.</p>
          <p>A portion of profits supports Remote Area Medical.</p>
        </div>
      </div>
    </footer>
  );
}
