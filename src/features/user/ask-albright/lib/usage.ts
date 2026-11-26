import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { log } from "@/shared/utils/logging";
/**
 * Durable limits (public.ask_albright_usage, UTC days). Unlike the in-memory
 * per-minute limiter, these hold across instances and cold starts.
 *
 * - Per user: ASK_ALBRIGHT_USER_DAILY questions (default 50). Admins have no
 *   per-user cap (owner's call, Nov 2026), but still count toward the spend
 *   caps and are still recorded.
 * - Spend caps: $1/day, $5/week (from Sunday), $15/month across members AND
 *   signed-out visitors combined. They live in the database, in the one-row
 *   public.ask_albright_budget table — retune them there, no deploy — and are
 *   checked inside the reserve RPC as questions × the per-answer cap, before
 *   anything is spent.
 *
 * Fails CLOSED: if the reservation can't be made, no question is answered.
 */

const DEFAULT_USER_DAILY = 50;

export function userDailyLimit(): number {
  const perUser = Number(process.env.ASK_ALBRIGHT_USER_DAILY ?? DEFAULT_USER_DAILY);
  return Number.isFinite(perUser) && perUser > 0 ? Math.floor(perUser) : DEFAULT_USER_DAILY;
}

/** Which spend cap stopped a question. */
export type BudgetPeriod = "day" | "week" | "month";

export const asPeriod = (p: unknown): BudgetPeriod => (p === "week" || p === "month" ? p : "day");

/** What to tell someone when a spend cap is reached. */
export function budgetMessage(period: BudgetPeriod): string {
  return period === "day"
    ? "Dr. Albright has reached today's limit. Try again tomorrow."
    : `Dr. Albright has reached this ${period}'s limit. He'll be back next ${period}.`;
}

export interface Reservation {
  allowed: boolean;
  /** Why not, when not allowed. */
  reason?: "user" | "global" | "unavailable";
  /** For reason "global": which spend cap. */
  period?: BudgetPeriod;
}

const db = () => createServiceRoleClient() as unknown as SupabaseClient;

/** No per-user cap: what admins get (the database column is an integer). */
const UNCAPPED = 2_000_000_000;

/** Take one of today's questions for this user, if any are left. */
export async function reserveQuestion(
  userId: string,
  { uncapped = false }: { uncapped?: boolean } = {}
): Promise<Reservation> {
  try {
    const { data, error } = await db().rpc("ask_albright_reserve", {
      p_user: userId,
      p_user_max: uncapped ? UNCAPPED : userDailyLimit(),
      // The spend caps are enforced in the database (ask_albright_budget).
      p_global_max: UNCAPPED,
    });
    if (error) throw error;
    const r = data as { allowed?: boolean; reason?: string; period?: string } | null;
    if (r?.allowed) return { allowed: true };
    if (r?.reason === "global")
      return { allowed: false, reason: "global", period: asPeriod(r.period) };
    return { allowed: false, reason: "user" };
  } catch (err) {
    log.error("[ask-albright] usage reservation failed; refusing the question", err);
    return { allowed: false, reason: "unavailable" };
  }
}

/** Add an answer's actual cost to today's row (reporting only; never fails the answer). */
export async function recordCost(userId: string, usd: number): Promise<void> {
  if (!(usd > 0)) return;
  try {
    const { error } = await db().rpc("ask_albright_record_cost", {
      p_user: userId,
      p_cost: Number(usd.toFixed(6)),
    });
    if (error) throw error;
  } catch (err) {
    log.warn("[ask-albright] recording cost failed", err);
  }
}
