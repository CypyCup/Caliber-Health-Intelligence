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

  if ((process.env.CHI_LEAD_SINK ?? "local") === "supabase") {
    // Production: insert into the Supabase `leads` table via PostgREST. The
    // table's RLS allows anon INSERT (no SELECT), so the publishable/anon key is
    // sufficient; the service-role key also works server-side. Failure is
    // non-fatal — we still unlock so a transient DB blip never blocks a visitor.
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) {
        await fetch(`${url}/rest/v1/leads`, {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(lead),
        });
      }
    } catch {
      // Non-fatal: still unlock even if the Supabase write fails.
    }
  } else {
    // Demo / local: append to a gitignored file.
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

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // 180 days
  });
  return res;
}
