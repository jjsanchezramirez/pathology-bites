// src/shared/utils/jwt-utils.ts
// Client-side JWT utilities for reducing API calls

/**
 * Decode JWT payload without verification
 * This is safe for client-side expiry checking since we're not trusting the data,
 * just using it to avoid unnecessary API calls
 */
export function decodeJWT(token: string): unknown | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch (error) {
    console.error("[JWT] Failed to decode token:", error);
    return null;
  }
}

/**
 * Check if JWT is expired (client-side only)
 * Returns true if expired or invalid
 *
 * Note: This is NOT a security check - it's an optimization to avoid
 * calling getSession() when we know the token is still valid
 */
export function isJWTExpired(token: string, bufferSeconds: number = 60): boolean {
  const payload = decodeJWT(token);

  if (!payload || !payload.exp) {
    return true; // Treat invalid tokens as expired
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = payload.exp;

  // Add buffer to refresh before actual expiry
  return now >= expiresAt - bufferSeconds;
}

/**
 * Get JWT expiry time in milliseconds
 */
export function getJWTExpiry(token: string): number | null {
  const payload = decodeJWT(token);

  if (!payload || !payload.exp) {
    return null;
  }

  return payload.exp * 1000; // Convert to milliseconds
}

/**
 * Get time until JWT expires in seconds
 */
export function getTimeUntilExpiry(token: string): number | null {
  const expiryMs = getJWTExpiry(token);

  if (!expiryMs) {
    return null;
  }

  const now = Date.now();
  const secondsUntilExpiry = Math.floor((expiryMs - now) / 1000);

  return Math.max(0, secondsUntilExpiry);
}

/**
 * Extract user ID from JWT (client-side only, not for security)
 */
export function getUserIdFromJWT(token: string): string | null {
  const payload = decodeJWT(token);
  return payload?.sub || null;
}

/**
 * Check if session needs refresh based on JWT expiry
 * Returns true if token will expire within the threshold
 */
export function shouldRefreshSession(
  token: string,
  thresholdSeconds: number = 5 * 60 // 5 minutes
): boolean {
  const timeUntilExpiry = getTimeUntilExpiry(token);

  if (timeUntilExpiry === null) {
    return true; // Refresh if we can't determine expiry
  }

  return timeUntilExpiry <= thresholdSeconds;
}

/**
 * Get session token from cookies (client-side)
 * This reads the Supabase auth cookie to check expiry without API call
 */
export function getSessionTokenFromCookies(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  // Supabase stores the session in cookies with this pattern
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");

    // Look for Supabase auth token cookie
    // The exact name depends on your Supabase project
    if (name.includes("auth-token") || (name.includes("sb-") && name.includes("-auth-token"))) {
      try {
        const decoded = decodeURIComponent(value);
        const parsed = JSON.parse(decoded);
        return parsed.access_token || parsed.token || null;
      } catch {
        continue;
      }
    }
  }

  return null;
}
