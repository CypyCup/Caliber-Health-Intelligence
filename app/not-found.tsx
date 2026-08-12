import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-chi py-24 text-center">
      <p className="kicker">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">We couldn&apos;t find that.</h1>
      <p className="mt-2 text-ink-soft">The facility, operator, or page may have moved.</p>
      <Link href="/search" className="mt-6 inline-block rounded-lg bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-brand">
        Explore facilities
      </Link>
    </div>
  );
}
