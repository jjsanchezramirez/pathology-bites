// src/shared/utils/route-helpers.ts
/**
 * Shared routing utilities to prevent code duplication
 */

/**
 * Validate a user-supplied post-auth redirect target, returning a safe
 * same-origin path.
 *
 * The `next` (email confirm) and `redirect` (login) params come from the query
 * string / form data, so an attacker can set them. Naively concatenating the
 * origin (`${origin}${next}`) is an open redirect: `next=//evil.com` yields
 * `Location: //evil.com`, which browsers resolve to the attacker origin — a
 * phishing vector on a trusted domain.
 *
 * Safe = a single-leading-slash path (allows `/dashboard?x=1`, rejects `//`,
 * `https://`, `/\`, backslash-smuggling, and control chars). Anything else
 * falls back to `fallback`.
 *
 * @param target   The untrusted redirect target (may be null/undefined).
 * @param fallback Path to use when `target` is missing or unsafe. Default `/`.
 */
export function getSafeRedirectPath(
  target: string | null | undefined,
  fallback: string = "/"
): string {
  if (!target) return fallback;
  // Must start with exactly one "/", and the second char must not be "/" or "\"
  // (blocks "//evil.com" and "/\\evil.com"). Reject any backslash or control char.
  if (!/^\/[^/\\\s][^\\\u0000-\u001f]*$/.test(target)) return fallback;
  return target;
}

/**
 * Check if a route is public (doesn't require authentication)
 */
export function isPublicRoute(pathname: string): boolean {
  const publicPatterns = [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/check-email",
    "/auth-error",
    "/email-verified",
    "/email-already-verified",
    "/link-expired",
    "/reset-success",
    "/about",
    "/faq",
    "/contact",
    "/privacy",
    "/terms",
    "/maintenance",
  ];

  // Exact matches
  if (publicPatterns.includes(pathname)) {
    return true;
  }

  // Pattern matches
  if (pathname.startsWith("/tools/") || pathname.startsWith("/debug/")) {
    return true;
  }

  return false;
}
