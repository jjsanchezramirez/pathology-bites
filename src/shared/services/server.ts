// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { Database } from "@/shared/types/supabase";

export async function createClient() {
  try {
    // IMPORTANT: Await the cookies() call in Next.js 15
    const cookieStore = await cookies();

    // Use environment variables directly for server-side
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Native clients (the iOS app) authenticate with `Authorization: Bearer <access-token>`
    // and send no cookies. Middleware already accepts that token for identity; forward it
    // here too, or every query runs as `anon` and RLS hides the caller's own rows. A global
    // Authorization header takes precedence over the (absent) cookie session in supabase-js.
    const authorization = (await headers()).get("authorization");
    const bearer = authorization && /^Bearer\s+\S+/i.test(authorization) ? authorization : null;

    return createServerClient<Database>(url, anonKey, {
      ...(bearer && { global: { headers: { Authorization: bearer } } }),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (_cookieError) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    });
  } catch (error) {
    throw error;
  }
}
