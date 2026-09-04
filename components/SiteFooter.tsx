import Link from "next/link";
import { FOOTER_TAGLINE, FOOTER_COLUMNS, FOOTER_DISCLOSURE, FOOTER_COPYRIGHT } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-paper-muted">
      <div className="container-chi grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="max-w-xs">
          <p className="font-semibold text-ink">Caliber Health Intelligence</p>
          <p className="mt-2 text-sm text-ink-faint">{FOOTER_TAGLINE}</p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.heading}>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{col.heading}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link className="link-quiet" href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200">
        <div className="container-chi space-y-3 py-6 text-xs leading-relaxed text-ink-faint">
          <p>{FOOTER_DISCLOSURE}</p>
          <p>{FOOTER_COPYRIGHT}</p>
        </div>
      </div>
    </footer>
  );
}
