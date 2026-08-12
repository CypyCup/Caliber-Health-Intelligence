import type { Confidence } from "./types";
import overridesJson from "@/data/seed/overrides/chain_ownership.json";

// Curated PE-sponsor / REIT-landlord resolution layered on top of the CMS chain
// grouping. CMS files carry no PE/REIT data — this is CHI's value-add. Only
// chains present here show a PE/REIT badge; everything else is left unresolved
// (honest). Edit data/seed/overrides/chain_ownership.json to expand.
export interface ChainOwnership {
  private_equity: boolean;
  reit: boolean;
  pe_sponsor_name?: string;
  reit_name?: string;
  confidence?: Confidence;
  note?: string;
  public_ticker?: string;
}

const raw = (overridesJson as { overrides?: Record<string, ChainOwnership> }).overrides ?? {};

export function getChainOwnership(chainId: string | undefined): ChainOwnership | undefined {
  if (!chainId) return undefined;
  return raw[chainId];
}

export function hasOwnershipResolution(chainId: string | undefined): boolean {
  return !!getChainOwnership(chainId);
}
