import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { log } from "@/shared/utils/logging";
import { COST_CAP_USD } from "./cost";
import { type BudgetPeriod, asPeriod } from "./usage";

/**
 * Free questions for signed-out visitors (the homepage teaser), in
 * public.ask_albright_anon_usage. Three buckets must all have room:
 *
 * - Browser: ASK_ALBRIGHT_ANON_FREE questions, lifetime (default 3), keyed by
 *   an httpOnly cookie the status call issues. This is the number the visitor
 *   sees ("2 free questions left").
 * - Network: ASK_ALBRIGHT_ANON_IP_DAILY per IP per UTC day (default 10) — the
 *   backstop for clearing cookies. Higher than 3 on purpose: a hospital puts
 *   every pathologist behind one address. IPv6 is counted per /64 (one
 *   household or phone gets a whole /64). Stored only as a day-salted HMAC.
 * - Teaser share: ASK_ALBRIGHT_ANON_DAILY_BUDGET_USD (default $0.50 = 250
 *   answers at the 0.20¢ cap) — at most half of the $1/day, so a bot run can
 *   never lock members out. Set it to 0 to switch the teaser off.
 * - And the site-wide spend caps every answer shares ($1/day, $5/week,
 *   $15/month; public.ask_albright_budget, see lib/usage.ts).
 *
 * Not one of the per-action rate limiters removed in the Apr–May 2026 audit:
 * those guarded Supabase auth endpoints that Supabase already limits. This
 * guards a paid AI call that nothing else limits. Fails CLOSED.
 */

export const ANON_COOKIE = "pb_albright_visitor";
export const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const DEFAULTS = { free: 3, ipDaily: 10, budgetUsd: 0.5 };

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function anonLimits(): { free: number; ipDaily: number; global: number } {
  const budget = Number(process.env.ASK_ALBRIGHT_ANON_DAILY_BUDGET_USD);
  const usd = Number.isFinite(budget) && budget >= 0 ? budget : DEFAULTS.budgetUsd;
  return {
    free: envInt("ASK_ALBRIGHT_ANON_FREE", DEFAULTS.free),
    ipDaily: envInt("ASK_ALBRIGHT_ANON_IP_DAILY", DEFAULTS.ipDaily),
    global: Math.floor(usd / COST_CAP_USD),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The visitor id from the cookie, if it is one we could have issued. */
export function readVisitor(request: NextRequest): string | null {
  const v = request.cookies.get(ANON_COOKIE)?.value;
  return v && UUID.test(v) ? v : null;
}

export const newVisitorId = (): string => randomUUID();

/**
 * The client address. Cloudflare sits in front of Vercel and sets
 * cf-connecting-ip itself (overwriting anything the client sent); behind it,
 * Vercel's x-forwarded-for is a Cloudflare edge, not the visitor. Requests
 * that bypass Cloudflare fall back to Vercel's x-real-ip. A forged header can
 * only move a bot between network buckets — the global budget still holds.
 */
export function clientNetwork(request: NextRequest): string | null {
  const raw =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0];
  const ip = raw?.trim().toLowerCase();
  if (!ip) return null;
  if (!ip.includes(":")) return ip;
  // IPv6: the first four hextets (/64), with "::" expanded.
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return `${full.slice(0, 4).join(":")}::/64`;
}

const utcDay = () => new Date().toISOString().slice(0, 10);

function networkBucket(network: string): string {
  const key = process.env.ASK_ALBRIGHT_ANON_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const mac = createHmac("sha256", key).update(`${utcDay()}|${network}`).digest("base64url");
  return `ip:${mac.slice(0, 32)}`;
}

const visitorBucket = (visitor: string) => `v:${visitor}`;

const db = () => createServiceRoleClient() as unknown as SupabaseClient;

export interface AnonReservation {
  allowed: boolean;
  /** Free questions this browser has left after this one. */
  remaining: number;
  reason?: "visitor" | "ip" | "global" | "unavailable";
  /** For reason "global": which spend cap. */
  period?: BudgetPeriod;
}

/** How many free questions this browser has left (no reservation). */
export async function anonRemaining(visitor: string | null): Promise<number> {
  const { free } = anonLimits();
  if (!visitor) return free;
  try {
    const { data, error } = await db()
      .from("ask_albright_anon_usage")
      .select("questions")
      .eq("bucket", visitorBucket(visitor))
      .maybeSingle();
    if (error) throw error;
    return Math.max(0, free - (data?.questions ?? 0));
  } catch (err) {
    log.warn("[ask-albright] anon status lookup failed", err);
    return free;
  }
}

/** Take one free question, if the browser, its network and today's budget all allow it. */
export async function reserveAnon(visitor: string, network: string): Promise<AnonReservation> {
  const { free, ipDaily, global } = anonLimits();
  try {
    const { data, error } = await db().rpc("ask_albright_anon_reserve", {
      p_visitor: visitorBucket(visitor),
      p_ip: networkBucket(network),
      p_visitor_max: free,
      p_ip_max: ipDaily,
      p_global_max: global,
    });
    if (error) throw error;
    const r = data as { allowed?: boolean; reason?: string; used?: number; period?: string } | null;
    const remaining = Math.max(0, free - (r?.used ?? free));
    if (r?.allowed) return { allowed: true, remaining };
    if (r?.reason === "global")
      return { allowed: false, remaining, reason: "global", period: asPeriod(r.period) };
    return { allowed: false, remaining, reason: r?.reason === "ip" ? "ip" : "visitor" };
  } catch (err) {
    log.error("[ask-albright] anon reservation failed; refusing the question", err);
    return { allowed: false, remaining: 0, reason: "unavailable" };
  }
}

/** Give the question back: declines, "nothing found" and failures don't count. */
export async function refundAnon(visitor: string, network: string): Promise<void> {
  try {
    const { error } = await db().rpc("ask_albright_anon_refund", {
      p_visitor: visitorBucket(visitor),
      p_ip: networkBucket(network),
    });
    if (error) throw error;
  } catch (err) {
    log.warn("[ask-albright] anon refund failed", err);
  }
}

/** Reporting only; never fails the answer. */
export async function recordAnonCost(visitor: string, usd: number): Promise<void> {
  if (!(usd > 0)) return;
  try {
    const { error } = await db().rpc("ask_albright_anon_record_cost", {
      p_visitor: visitorBucket(visitor),
      p_cost: Number(usd.toFixed(6)),
    });
    if (error) throw error;
  } catch (err) {
    log.warn("[ask-albright] anon cost record failed", err);
  }
}
