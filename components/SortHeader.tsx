"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** Clickable, server-round-tripped column sort. Sorting runs in the backend over
 *  the full filtered result set (not just the visible page). */
export function SortHeader({
  field,
  label,
  align = "left",
}: {
  field: string;
  label: string;
  align?: "left" | "right";
}) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("sort") ?? "risk";
  const dir = params.get("dir") ?? (field === "name" ? "asc" : "desc");
  const active = current === field;

  function onClick() {
    const next = new URLSearchParams(params.toString());
    if (active) {
      next.set("dir", dir === "asc" ? "desc" : "asc");
    } else {
      next.set("sort", field);
      next.set("dir", field === "name" ? "asc" : "desc");
    }
    router.push(`/search?${next.toString()}`);
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-medium uppercase tracking-wide hover:text-brand ${
        active ? "text-brand" : "text-ink-faint"
      } ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      {label}
      <span className="text-[9px]">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
    </button>
  );
}
