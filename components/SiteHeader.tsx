import Link from "next/link";
import { Logo } from "./Logo";

const NAV = [
  { href: "/search", label: "Explore facilities" },
  { href: "/compare", label: "Compare" },
  { href: "/methodology", label: "Methodology" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container-chi flex h-16 items-center justify-between gap-4">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm font-medium text-ink-soft hover:text-brand"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className="rounded-lg bg-brand-deep px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand"
          >
            Search
          </Link>
        </div>
      </div>
    </header>
  );
}
