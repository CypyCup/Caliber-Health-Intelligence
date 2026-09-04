import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isRegistered } from "@/lib/auth";
import { RegistrationWall } from "@/components/RegistrationWall";
import { getCmsChainById, getCmsChainProfile } from "@/lib/data/cmsChains";
import {
  getFacilitiesByChain,
  getChainFacilityRollup,
  getChainRollupTrends,
  getChainChowRecent,
} from "@/lib/data";
import { getChainPbjTrend } from "@/lib/data/pbj";
import { CmsChainProfileView } from "@/components/CmsChainProfileView";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const c = getCmsChainById(params.id);
  return { title: c ? c.name : "Operator" };
}

export default async function ChainPage({ params }: { params: { id: string } }) {
  // Chains are presented from the federal chain record (Chain Performance
  // Measures). Any id not in that record is not published.
  const cms = getCmsChainById(params.id);
  if (!cms) notFound();

  if (!isRegistered()) {
    return <RegistrationWall nextLabel={`the performance profile for ${cms.name}`} />;
  }

  const cmsProfile = getCmsChainProfile(params.id);
  if (!cmsProfile) notFound();

  const [members, rollup, trends, chowRecent] = await Promise.all([
    getFacilitiesByChain(params.id),
    getChainFacilityRollup(params.id),
    getChainRollupTrends(params.id),
    getChainChowRecent(params.id, 2023),
  ]);
  const pbj = getChainPbjTrend(members.map((m) => m.facility.ccn));

  return (
    <CmsChainProfileView
      profile={cmsProfile}
      members={members}
      rollup={rollup}
      trends={trends}
      chowRecent={chowRecent}
      pbj={pbj}
    />
  );
}
