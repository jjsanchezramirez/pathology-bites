// src/shared/utils/cookie-consent.ts
//
// One place for the visitor's cookie choice.
//
// The choice lives in a first-party cookie, not localStorage, because:
//  - sign-out and "clear data" call localStorage.clear(), which used to wipe
//    the choice and bring the banner back;
//  - the unified cache's start-up cleanup deleted the old localStorage key
//    ("pathology-bites-cookie-consent" sat inside its "pathology-bites-cookie-"
//    namespace and failed its version check), so the banner reappeared on
//    every full page load.
//
// Essential cookies (Supabase sign-in, admin mode) never depend on this.
// Only Google Analytics does: it is not loaded at all until the visitor
// chooses "Accept".

export type ConsentChoice = "granted" | "denied";

export const CONSENT_COOKIE = "pb_cookie_consent";
/** Bump to ask everyone again (e.g. after adding a new kind of tracking). */
export const CONSENT_VERSION = "2";
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // one year

/** Old localStorage key from the first banner; read once to carry the choice over. */
export const LEGACY_CONSENT_KEY = "pathology-bites-cookie-consent";

/** Fired on window whenever the choice changes (detail: ConsentChoice | null). */
export const CONSENT_CHANGED_EVENT = "pb:cookie-consent-changed";
/** Fired on window to reopen the banner from "Cookie settings". */
export const OPEN_COOKIE_SETTINGS_EVENT = "pb:open-cookie-settings";

function readRawCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/** Parse "<version>.<choice>". Anything else (or an old version) counts as no choice. */
export function parseConsentCookie(raw: string | null | undefined): ConsentChoice | null {
  if (!raw) return null;
  const [version, choice] = raw.split(".");
  if (version !== CONSENT_VERSION) return null;
  return choice === "granted" || choice === "denied" ? choice : null;
}

function writeCookie(value: string, maxAge: number): void {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

/** Carry a choice made with the old banner over to the cookie, then drop the old key. */
function migrateLegacyConsent(): ConsentChoice | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_CONSENT_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(LEGACY_CONSENT_KEY);
    const parsed = JSON.parse(raw) as { analytics?: unknown };
    const choice: ConsentChoice = parsed?.analytics === true ? "granted" : "denied";
    writeCookie(`${CONSENT_VERSION}.${choice}`, CONSENT_MAX_AGE_SECONDS);
    return choice;
  } catch {
    return null;
  }
}

/** The visitor's choice, or null if they have not chosen yet. */
export function readConsent(): ConsentChoice | null {
  if (typeof document === "undefined") return null;
  const fromCookie = parseConsentCookie(readRawCookie(CONSENT_COOKIE));
  if (fromCookie) return fromCookie;
  return migrateLegacyConsent();
}

/** Google Analytics cookie names start with these; removed when consent is withdrawn. */
const GA_COOKIE_PREFIXES = ["_ga", "_gid", "_gat"];

function removeAnalyticsCookies(): void {
  if (typeof document === "undefined") return;
  const host = window.location.hostname;
  // GA sets its cookies on the registrable domain (".pathologybites.com"), so
  // try the host and each parent domain.
  const parts = host.split(".");
  const domains: (string | null)[] = [null];
  for (let i = 0; i < parts.length - 1; i++) domains.push("." + parts.slice(i).join("."));

  document.cookie
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter((name) => GA_COOKIE_PREFIXES.some((p) => name.startsWith(p)))
    .forEach((name) => {
      for (const domain of domains) {
        const d = domain ? `; domain=${domain}` : "";
        document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT${d}`;
      }
    });
}

/** Tell an already-loaded gtag about the choice (no-op if GA never loaded). */
export function applyConsentToGtag(choice: ConsentChoice): void {
  if (typeof window === "undefined") return;
  window.gtag?.("consent", "update", { analytics_storage: choice });
}

/** Save the visitor's choice and let the page react to it. */
export function saveConsent(choice: ConsentChoice): void {
  if (typeof document === "undefined") return;
  writeCookie(`${CONSENT_VERSION}.${choice}`, CONSENT_MAX_AGE_SECONDS);
  try {
    window.localStorage.removeItem(LEGACY_CONSENT_KEY);
  } catch {
    // Storage blocked (private mode on some browsers): the cookie is enough.
  }
  applyConsentToGtag(choice);
  if (choice === "denied") removeAnalyticsCookies();
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: choice }));
}

/** Reopen the banner so the visitor can change their mind. */
export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT));
}
