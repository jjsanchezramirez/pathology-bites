/**
 * Guards that keep a stuck Supabase session from hanging the app.
 *
 * Supabase serialises session reads/refreshes across tabs with a Web Lock and
 * waits for it with NO timeout. If any tab of the site stalls while holding it
 * (Safari freezes background tabs mid-refresh), every page in every tab waits
 * forever on getSession() — the dashboard sits on skeletons with no error.
 * A saved session that never resolves does the same and survives closing all
 * tabs (seen Nov 2026: a Safari profile stuck while a Private window worked).
 */

import { NavigatorLockAcquireTimeoutError, navigatorLock } from "@supabase/supabase-js";
import { log } from "@/shared/utils/logging";

/** How long to wait for another tab's lock before going ahead without it. */
export const LOCK_WAIT_MS = 5_000;
/** How long the first session check may take before the saved session is treated as broken. */
export const SESSION_CHECK_MS = 10_000;

export class AuthTimeoutError extends Error {
  constructor(what: string, ms: number) {
    super(`${what} did not finish within ${ms} ms`);
    this.name = "AuthTimeoutError";
  }
}

/**
 * Supabase's navigator lock, but an unbounded wait (acquireTimeout < 0) gives
 * up after LOCK_WAIT_MS and runs `fn` anyway. Running unlocked risks two tabs
 * refreshing at once (one refresh may fail and sign that tab out); waiting
 * forever hangs the whole site, which is worse. Immediate (0) and bounded
 * waits keep Supabase's own behaviour.
 */
export async function boundedLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
  waitMs = LOCK_WAIT_MS
): Promise<R> {
  if (typeof navigator === "undefined" || !navigator.locks) return fn();
  if (acquireTimeout >= 0) return navigatorLock(name, acquireTimeout, fn);
  let started = false;
  try {
    return await navigatorLock(name, waitMs, () => {
      started = true;
      return fn();
    });
  } catch (err) {
    // A timed-out request rejects with the abort signal's AbortError (a
    // DOMException, so match by name). An error from fn itself is rethrown.
    const timedOut =
      !started &&
      (err instanceof NavigatorLockAcquireTimeoutError ||
        (err as { name?: string } | null)?.name === "AbortError");
    if (!timedOut) throw err;
    log.warn(
      `[auth] lock "${name}" held for over ${waitMs} ms by another tab; continuing without it`
    );
    return fn();
  }
}

/** Reject with AuthTimeoutError if `promise` takes longer than `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AuthTimeoutError(what, ms)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Remove this browser's copy of the Supabase session (sb-* cookies and
 * storage keys) without a network call or the lock — both may be what is
 * stuck. The person signs in again; the server-side session is untouched.
 */
export function clearLocalAuthStorage(): void {
  if (typeof document === "undefined") return;
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name?.startsWith("sb-")) continue;
    const host = location.hostname;
    const parent = host.split(".").slice(-2).join(".");
    for (const domain of ["", `; domain=${host}`, `; domain=.${parent}`]) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
    }
  }
  for (const store of [localStorage, sessionStorage]) {
    const keys = Array.from({ length: store.length }, (_, i) => store.key(i) ?? "");
    for (const key of keys) {
      if (key.startsWith("sb-") || key === "auth-state") store.removeItem(key);
    }
  }
}
