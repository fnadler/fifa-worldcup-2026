import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. Server-only (the `server-only`
// import above makes any accidental client-component import a build error).
// Used exclusively to resolve a public share token to its owner's collection.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
