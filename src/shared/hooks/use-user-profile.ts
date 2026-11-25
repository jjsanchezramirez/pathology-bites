"use client";

// One cached copy of the signed-in user's profile row. The sidebar footer and the
// header profile menu each fetched it themselves on every page load (6 identical
// requests on /admin), which queued the dashboard's own requests behind them.

import useSWR from "swr";
import { createClient } from "@/shared/services/client";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { log } from "@/shared/utils/logging";

export interface UserProfile {
  id: string;
  email: string | null;
  role: string;
  first_name: string | null;
  last_name: string | null;
}

type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: { first_name?: string; last_name?: string; full_name?: string };
};

/** Names from the auth record, used when the profile row can't be read. */
function profileFromAuth(user: AuthUser): UserProfile {
  const full = user.user_metadata?.full_name ?? "";
  return {
    id: user.id,
    email: user.email ?? null,
    role: "user",
    first_name: user.user_metadata?.first_name || full.split(" ")[0] || null,
    last_name: user.user_metadata?.last_name || full.split(" ").slice(1).join(" ") || null,
  };
}

export function useUserProfile() {
  const { user, isAuthenticated } = useAuthContext();
  const key = user && isAuthenticated ? (["user-profile", user.id] as const) : null;

  const { data, isLoading, mutate } = useSWR<UserProfile>(
    key,
    async () => {
      const { data: profile, error } = await createClient()
        .from("users")
        .select("id, email, role, first_name, last_name")
        .eq("id", user!.id)
        .maybeSingle();
      if (error && (error.message || error.code)) log.error("Profile error:", error);
      return (profile as UserProfile | null) ?? profileFromAuth(user as AuthUser);
    },
    { dedupingInterval: 60_000, revalidateOnFocus: false }
  );

  return {
    profile: key ? (data ?? null) : null,
    loading: !!key && isLoading,
    /** Re-read the profile (e.g. after an auth refresh). */
    refresh: () => mutate(),
  };
}
