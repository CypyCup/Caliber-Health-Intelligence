import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

const COOKIE = "chi_registered";
const LEAD_FILE = path.join(process.cwd(), "data", "leads.local.json");

/**
 * Lead capture. In demo mode (CHI_LEAD_SINK unset or "local") the lead is
 * appended to data/leads.local.json (gitignored) and a cookie unlocks deep
 * views. In production, set CHI_LEAD_SINK=supabase and write to the leads
 * table instead (see docs/architecture.md).
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  const lead = {
    email,
    role: String(body.role ?? ""),
    firm: String(body.firm ?? ""),
    source: String(body.source ?? ""),
    captured_at: new Date().toISOString(),
  };

  if ((process.env.CHI_LEAD_SINK ?? "local") === "local") {
    try {
      let existing: unknown[] = [];
      try {
        existing = JSON.parse(await fs.readFile(LEAD_FILE, "utf8"));
      } catch {
        existing = [];
      }
      existing.push(lead);
      await fs.writeFile(LEAD_FILE, JSON.stringify(existing, null, 2));
    } catch {
      // Non-fatal in demo: still unlock even if the local write fails.
    }
  }
  // else: TODO write to Supabase `leads` table.

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // 180 days
  });
  return res;
}
