// The national scope of the model, as stated in the CHI Strategic Business Plan
// (§3): the entity-resolution layer resolves the full SNF universe of facilities
// into their operating chains. These are the product-claim figures; a given
// deployment may load a sample (see seed metadata / getSeedMeta).
export const NATIONAL_SCOPE = {
  facilities: 14703,
  chains: 616,
} as const;
