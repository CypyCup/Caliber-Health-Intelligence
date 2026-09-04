"use client";

import { useState } from "react";

/**
 * Soft registration wall — the Atlas's lead-capture funnel (Business Plan §4.1:
 * "captures qualified leads through registration"). In demo mode it posts to
 * /api/register, which records the lead locally and sets a cookie; deep views
 * then unlock. No password in demo mode — the point is email capture, not auth.
 * In production this is where Supabase Auth slots in.
 */
export function RegistrationWall({ nextLabel }: { nextLabel: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [firm, setFirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, firm, source: window.location.pathname }),
      });
      if (!res.ok) throw new Error("failed");
      window.location.reload();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="container-chi py-16">
      <div className="mx-auto max-w-md card p-6">
        <p className="kicker">Free · Register to continue</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">See {nextLabel}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          The Caliber Workforce Atlas is free. Register once to explore full facility and chain
          profiles: staffing trends, turnover, deficiencies, and rule-based indicators, each with its
          source vintage.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-soft">Work email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@firm.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-soft">Role</label>
              <input
                value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Investor"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-soft">Firm</label>
              <input
                value={firm} onChange={(e) => setFirm(e.target.value)} placeholder="Optional"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>
          <button
            type="submit" disabled={status === "loading"}
            className="w-full rounded-lg bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand disabled:opacity-60"
          >
            {status === "loading" ? "Unlocking…" : "Unlock the Atlas"}
          </button>
          {status === "error" && (
            <p className="text-xs text-red-600">Something went wrong. Please try again.</p>
          )}
          <p className="text-[11px] text-ink-faint">
            Registration records your email so Caliber can follow up. No password is required.
          </p>
        </form>
      </div>
    </div>
  );
}
