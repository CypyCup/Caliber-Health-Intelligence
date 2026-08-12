import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client for the read-path. Reference tables are public-read
// (RLS), so the anon key is sufficient for reads; the service-role key also works
// server-side. Never expose the service-role key to the browser.
let cached: SupabaseClient | null = null;

export function supa(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "CHI_DATA_SOURCE=supabase but Supabase env is not set. Provide NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY, or set CHI_DATA_SOURCE=demo to use the bundled seed.",
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
