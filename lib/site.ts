// Single source of truth for site-wide copy elements and canonical figures.
//
// Rule (site copy v2): every figure appears with its source and vintage, sourced
// in exactly one place. Page copy pulls counts from getCanonicalFigures() rather
// than hardcoding them, so a data refresh updates every page at once.
import { getSeedMeta } from "@/lib/data";
import { getCmsChainMeta } from "@/lib/data/cmsChains";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-08" -> "August 2026" (falls back to the raw string). */
export function formatMonth(period: string): string {
  const [y, m] = (period || "").split("-");
  const name = MONTHS[Number(m) - 1];
  return name && y ? `${name} ${y}` : period || "";
}

export interface CanonicalFigure {
  value: number;
  label: string; // formatted with thousands separators
  source: string;
  vintage: string; // e.g. "August 2026"
}

/** The canonical facility and chain figures, with source and vintage, derived
 *  from the ingested seed so they stay correct after each refresh. */
export async function getCanonicalFigures(): Promise<{
  facilities: CanonicalFigure;
  chains: CanonicalFigure;
}> {
  const meta = await getSeedMeta();
  const chainMeta = getCmsChainMeta();
  return {
    facilities: {
      value: meta.facilities,
      label: meta.facilities.toLocaleString("en-US"),
      source: "Provider Information",
      vintage: formatMonth(meta.generated_on || meta.quarters.at(-1) || ""),
    },
    chains: {
      value: chainMeta.chains,
      label: chainMeta.chains.toLocaleString("en-US"),
      source: "Chain Performance Measures",
      vintage: formatMonth(chainMeta.latest_period),
    },
  };
}

// --- Navigation (the firm leads; the Atlas is a product) -------------------
export const NAV: { href: string; label: string }[] = [
  { href: "/atlas", label: "Workforce Atlas" },
  { href: "/workforce-index", label: "Workforce Index" },
  { href: "/operator-pulse", label: "Operator Pulse" },
  { href: "/research", label: "Research" },
  { href: "/methodology", label: "Methodology" },
];

// --- Footer ----------------------------------------------------------------
export const FOOTER_TAGLINE =
  "Workforce economics research on U.S. skilled nursing, for the capital that finances the sector and the operators accountable for it.";

export const FOOTER_COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Atlas",
    links: [
      { href: "/search", label: "Explore facilities" },
      { href: "/chains", label: "Operators and chains" },
      { href: "/compare", label: "Compare" },
      { href: "/methodology", label: "Methodology and sources" },
    ],
  },
  {
    heading: "Research",
    links: [
      { href: "/workforce-index", label: "Workforce Index" },
      { href: "/operator-pulse", label: "Operator Pulse" },
      { href: "/research", label: "Quarterly research" },
      { href: "/research#chain-reports", label: "Chain reports" },
    ],
  },
  {
    heading: "Firm",
    links: [
      { href: "/about", label: "About" },
      { href: "/about#independence", label: "Independence and disclosure" },
      { href: "/about#contact", label: "Contact" },
    ],
  },
];

export const FOOTER_DISCLOSURE =
  "Caliber Health Intelligence is an independent research firm and is not affiliated with the Centers for Medicare & Medicaid Services. Atlas figures derive exclusively from public federal data and carry their source vintage. Indicators are rule-based with published thresholds. Nothing on this site constitutes investment, legal, or clinical advice.";

export const FOOTER_COPYRIGHT =
  "© 2026 Caliber Health Intelligence, LLC. A fixed share of net profit supports Remote Area Medical.";

/** The status banner sentence, with live vintages injected. */
export function statusBannerText(f: {
  facilities: CanonicalFigure;
  chains: CanonicalFigure;
}): string {
  return (
    `Federal data current to Provider Information, ${f.facilities.vintage}, ` +
    `and Chain Performance Measures, ${f.chains.vintage}. ` +
    "Ownership relationships beyond the CMS chain record are not published in the Atlas."
  );
}
