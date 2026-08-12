import Link from "next/link";

/**
 * The operator panel is forthcoming primary collection (Business Plan §3), gated
 * on ADP approval — so this is a recruitment surface, NOT live data. It shows no
 * panel figures; it invites operators to join. The Atlas is the panel's primary
 * recruitment surface (§4.1).
 */
export function PanelCTA() {
  return (
    <div className="rounded-xl border border-brand/30 bg-brand-tint/50 p-5">
      <div className="flex items-start gap-3">
        <span className="pill bg-white text-brand border border-brand/30">Coming</span>
        <div>
          <p className="font-semibold text-ink">The Caliber Operator Panel</p>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            A short quarterly read from SNF HR &amp; operations leaders on wage movement, agency use,
            open requisitions, and sign-on bonuses — current-quarter signal that federal data, by
            construction, can&apos;t give. Participants get a free benchmark cut in return.
          </p>
          <Link href="/search" className="mt-3 inline-block text-sm font-medium text-brand hover:text-brand-deep">
            Register on the Atlas to be invited →
          </Link>
        </div>
      </div>
    </div>
  );
}
