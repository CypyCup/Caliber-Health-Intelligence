// ---------------------------------------------------------------------------
// Data access layer — backend selector.
//
// The whole app talks to these async functions. The backend is chosen ONCE here
// by CHI_DATA_SOURCE:
//   * default    → lib/data/national.ts   real CMS Provider Information (14,693
//                  facilities) loaded from disk; the default facility source
//   * "supabase" → lib/data/supabase.ts   reads Postgres at national scale
//
// Real chains (CMS Chain Performance Measures) are served by lib/data/cmsChains.ts.
// Pages and components never change when the backend does, because the API is
// async and identical across both. See docs/architecture.md.
// ---------------------------------------------------------------------------
import * as national from "./national";
import * as supabase from "./supabase";

// Re-export the shared result/param types.
export type {
  SeedMeta,
  FacilityProfile,
  ChainProfile,
  ChainAggregates,
  FacilitySearchRow,
  SearchParams,
  ChainDirectoryRow,
  ArchiveInfo,
} from "./shared";

const impl = process.env.CHI_DATA_SOURCE === "supabase" ? supabase : national;

// Extra national-only accessors (chains are served by cmsChains).
export const getFacilitiesByChain = national.getFacilitiesByChain;
export const getChainFacilityRollup = national.getChainFacilityRollup;
export const getAllChainFacilityRollups = national.getAllChainFacilityRollups;
export type { ChainFacilityRollup } from "./national";

export const getSeedMeta = impl.getSeedMeta;
export const getAllFacilities = impl.getAllFacilities;
export const getFacility = impl.getFacility;
export const getFacilitySnapshots = impl.getFacilitySnapshots;
export const getAllChains = impl.getAllChains;
export const getChain = impl.getChain;
export const getOwner = impl.getOwner;
export const getFacilityProfile = impl.getFacilityProfile;
export const getChainProfile = impl.getChainProfile;
export const searchFacilities = impl.searchFacilities;
export const getCities = impl.getCities;
export const getChainsDirectory = impl.getChainsDirectory;
export const getArchiveInfo = impl.getArchiveInfo;
