import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { log } from "@/shared/utils/logging";
import { COST_CAP_USD } from "./cost";

/**
 * Durable daily limits (public.ask_albright_usage, UTC days). Unlike the
 * in-memory per-minute limiter, these hold across instances and cold starts.
 *
 * - Per user: ASK_ALBRIGHT_USER_DAILY questions (default 50).
 * - Global:   ASK_ALBRIGHT_DAILY_BUDGET_USD (default $2). Every answer is
 *   capped at COST_CAP_USD, so the budget is enforced as a question count
 *   (budget / cap) before anything is spent — exact, not after the fact.
 *
 * Fails CLOSED: if the reservation can't be made, no question is answered.
 */

const DEFAULT_USER_DAILY = 50;
const DEFAULT_DAILY_BUDGET_USD = 2;

export function dailyLimits(): { perUser: number; global: number } {
  const perUser = Number(process.env.ASK_ALBRIGHT_USER_DAILY ?? DEFAULT_USER_DAILY);
  const budget = Number(process.env.ASK_ALBRIGHT_DAILY_BUDGET_USD ?? DEFAULT_DAILY_BUDGET_USD);
  return {
    perUser: Number.isFinite(perUser) && perUser > 0 ? Math.floor(perUser) : DEFAULT_USER_DAILY,
    global: Math.floor(
      (Number.isFinite(budget) && budget > 0 ? budget : DEFAULT_DAILY_BUDGET_USD) / COST_CAP_USD
    ),
  };
}

export interface Reservation {
  allowed: boolean;
  /** Why not, when not allowed. */
  reason?: "user" | "global" | "unavailable";
}

const db = () => createServiceRoleClient() as unknown as SupabaseClient;

/** Take one of today's questions for this user, if any are left. */
export async function reserveQuestion(userId: string): Promise<Reservation> {
  const { perUser, global } = dailyLimits();
  try {
    const { data, error } = await db().rpc("ask_albright_reserve", {
      p_user: userId,
      p_user_max: perUser,
      p_global_max: global,
    });
    if (error) throw error;
    const r = data as { allowed?: boolean; reason?: string } | null;
    if (r?.allowed) return { allowed: true };
    return { allowed: false, reason: r?.reason === "global" ? "global" : "user" };
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
