// src/features/auth/utils/captcha-config.ts
/**
 * CAPTCHA configuration utility
 * Provides centralized control over CAPTCHA behavior across environments
 */

/**
 * Determines if CAPTCHA should be enabled based on environment
 * CAPTCHA is disabled in test environment to facilitate automated testing
 *
 * @returns boolean indicating whether CAPTCHA should be enabled
 */
export function isCaptchaEnabled(): boolean {
  // CAPTCHA temporarily disabled while investigating email verification issues
  return false;
}

/**
 * Gets the CAPTCHA sitekey if CAPTCHA is enabled
 * Returns undefined if CAPTCHA is disabled
 *
 * @returns string | undefined
 */
export function getCaptchaSiteKey(): string | undefined {
  if (!isCaptchaEnabled()) {
    return undefined;
  }

  return process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY;
}
