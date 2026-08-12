import { cookies } from "next/headers";

/** Demo-mode registration check. In production this becomes a Supabase session
 *  check; the call sites (facility/chain pages) don't change. */
export function isRegistered(): boolean {
  return cookies().get("chi_registered")?.value === "1";
}
