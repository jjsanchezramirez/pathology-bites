// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/shared/types/supabase";
import { boundedLock } from "./auth-guards";

export function createClient() {
  // Use environment variables directly for client-side
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  // boundedLock: one stalled tab must not hang session reads in every tab (auth-guards.ts).
  return createBrowserClient<Database>(url, anonKey, { auth: { lock: boundedLock } });
}
