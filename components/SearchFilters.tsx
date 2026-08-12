"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function SearchFilters({ cities }: { cities: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`/search?${next.toString()}`);
    },
    [params, router],
  );

  const sel = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={sel} value={params.get("ownerType") ?? ""} onChange={(e) => setParam("ownerType", e.target.value)}>
        <option value="">All owners</option>
        <option value="pe">PE-backed</option>
        <option value="reit">REIT-held</option>
      </select>
      <select className={sel} value={params.get("ownership") ?? ""} onChange={(e) => setParam("ownership", e.target.value)}>
        <option value="">Any profit status</option>
        <option value="For-profit">For-profit</option>
        <option value="Non-profit">Non-profit</option>
        <option value="Government">Government</option>
      </select>
      <select className={sel} value={params.get("city") ?? ""} onChange={(e) => setParam("city", e.target.value)}>
        <option value="">All cities</option>
        {cities.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select className={sel} value={params.get("minStar") ?? ""} onChange={(e) => setParam("minStar", e.target.value)}>
        <option value="">Any rating</option>
        <option value="4">4★ &amp; up</option>
        <option value="3">3★ &amp; up</option>
        <option value="2">2★ &amp; up</option>
      </select>
      <select className={sel} value={params.get("occ") ?? ""} onChange={(e) => setParam("occ", e.target.value)}>
        <option value="">Any occupancy</option>
        <option value="u70">Under 70%</option>
        <option value="u80">Under 80%</option>
        <option value="u90">Under 90%</option>
        <option value="gte90">90%+</option>
      </select>
      <select className={sel} value={params.get("pbj") ?? ""} onChange={(e) => setParam("pbj", e.target.value)}>
        <option value="">Any PBJ status</option>
        <option value="complete">PBJ complete</option>
        <option value="incomplete">PBJ incomplete</option>
      </select>
      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={params.get("hasFlags") === "1"}
          onChange={(e) => setParam("hasFlags", e.target.checked ? "1" : "")}
          className="accent-brand"
        />
        Has risk flags
      </label>
      {Array.from(params.keys()).some((k) => ["ownerType", "ownership", "city", "minStar", "hasFlags", "q", "chainId", "occ", "pbj", "sort", "dir"].includes(k)) && (
        <button
          onClick={() => router.push("/search")}
          className="rounded-lg px-3 py-2 text-sm font-medium text-ink-faint hover:text-brand"
        >
          Clear
        </button>
      )}
    </div>
  );
}
