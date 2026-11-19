// src/shared/utils/analytics/signup-source.ts
// First-touch attribution for signups.
//
// On a visitor's first landing we record where they came from (the external
// referrer's hostname, utm_source/medium/campaign and the landing path) in a
// small first-party cookie. At signup that value is copied into the new user's
// auth metadata as `signup_source`, so signups can be grouped by source.
//
// It is a cookie (not localStorage) so the server-side OAuth callback can read
// it for Google signups too. Nothing personal is stored: hostnames, utm tags
// and a path, each length-capped.

export const SIGNUP_SOURCE_COOKIE = "pb_signup_source";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days
const MAX_LEN = 100;

export interface SignupSource {
  referrer: string | null; // external referrer hostname, null for direct
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_path: string | null;
  first_seen: string; // ISO timestamp of first landing
}

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, MAX_LEN);
  return trimmed.length > 0 ? trimmed : null;
}

/** Parse the cookie value; returns null when absent or malformed. */
export function parseSignupSource(raw: string | null | undefined): SignupSource | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<SignupSource>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.first_seen !== "string") {
      return null;
    }
    return {
      referrer: clean(parsed.referrer),
      utm_source: clean(parsed.utm_source),
      utm_medium: clean(parsed.utm_medium),
      utm_campaign: clean(parsed.utm_campaign),
      landing_path: clean(parsed.landing_path),
      first_seen: parsed.first_seen.slice(0, 40),
    };
  } catch {
    return null;
  }
}

/** Build a source record from a landing URL and referrer. Exported for tests. */
export function buildSignupSource(
  landingUrl: string,
  referrer: string,
  now: Date = new Date()
): SignupSource {
  const url = new URL(landingUrl);
  let referrerHost: string | null = null;
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, "");
      const ownHost = url.hostname.replace(/^www\./, "");
      if (host && host !== ownHost) referrerHost = host;
    } catch {
      // Non-URL referrer (e.g. android-app://…) — keep nothing.
    }
  }
  return {
    referrer: clean(referrerHost),
    utm_source: clean(url.searchParams.get("utm_source")),
    utm_medium: clean(url.searchParams.get("utm_medium")),
    utm_campaign: clean(url.searchParams.get("utm_campaign")),
    landing_path: clean(url.pathname),
    first_seen: now.toISOString(),
  };
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

/** Record the first-touch source once per browser. Safe to call on every page. */
export function captureSignupSource(): void {
  if (typeof window === "undefined") return;
  if (readCookie(SIGNUP_SOURCE_COOKIE)) return;
  try {
    const source = buildSignupSource(window.location.href, document.referrer);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${SIGNUP_SOURCE_COOKIE}=${encodeURIComponent(JSON.stringify(source))}` +
      `; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  } catch {
    // Attribution is best-effort; never break the page over it.
  }
}

/** Read the stored source in the browser (for the email signup form). */
export function getSignupSource(): SignupSource | null {
  return parseSignupSource(readCookie(SIGNUP_SOURCE_COOKIE));
}
