// Rate limiting utility for authentication endpoints
//
// TODO: PRODUCTION SCALING CONSIDERATION
// This implementation uses in-memory storage (Map) which works for:
// - Development environments
// - Single-server deployments
// - Low to moderate traffic
//
// For production at scale with serverless/Vercel, consider:
// - Option A: Vercel KV (Redis) - Best performance, ~$0.25/100K requests after free tier
// - Option B: Supabase table - Free, slightly slower, already in your stack
// - Option C: Upstash Redis - Serverless-friendly Redis alternative
//
// Current implementation provides basic protection but won't work across
// multiple serverless function instances. Each instance has its own memory.
//
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxAttempts: number; // Maximum attempts per window
  blockDurationMs: number; // How long to block after exceeding limit
}

interface RateLimitEntry {
  attempts: number;
  windowStart: number;
  blockedUntil?: number;
}

class RateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  private getKey(identifier: string, action: string): string {
    return `${identifier}:${action}`;
  }

  private isWithinWindow(entry: RateLimitEntry): boolean {
    return Date.now() - entry.windowStart < this.config.windowMs;
  }

  private isBlocked(entry: RateLimitEntry): boolean {
    return entry.blockedUntil ? Date.now() < entry.blockedUntil : false;
  }

  private cleanupExpiredEntries(): void {
    for (const [key, entry] of this.attempts.entries()) {
      if (!this.isWithinWindow(entry) && !this.isBlocked(entry)) {
        this.attempts.delete(key);
      }
    }
  }

  checkLimit(identifier: string, action: string): { allowed: boolean; retryAfter?: number } {
    this.cleanupExpiredEntries();

    const key = this.getKey(identifier, action);
    const entry = this.attempts.get(key);

    if (!entry) {
      // First attempt
      this.attempts.set(key, {
        attempts: 1,
        windowStart: Date.now(),
      });
      return { allowed: true };
    }

    // Check if currently blocked
    if (this.isBlocked(entry)) {
      return {
        allowed: false,
        retryAfter: entry.blockedUntil! - Date.now(),
      };
    }

    // Block has been lifted — start fresh window so the user gets full maxAttempts again
    // rather than re-blocking on the next failure.
    if (entry.blockedUntil && Date.now() >= entry.blockedUntil) {
      entry.attempts = 1;
      entry.windowStart = Date.now();
      entry.blockedUntil = undefined;
      return { allowed: true };
    }

    // Check if we need to reset the window
    if (!this.isWithinWindow(entry)) {
      entry.attempts = 1;
      entry.windowStart = Date.now();
      entry.blockedUntil = undefined;
      return { allowed: true };
    }

    // Increment attempts
    entry.attempts++;

    // Check if limit exceeded
    if (entry.attempts > this.config.maxAttempts) {
      entry.blockedUntil = Date.now() + this.config.blockDurationMs;
      return {
        allowed: false,
        retryAfter: this.config.blockDurationMs,
      };
    }

    return { allowed: true };
  }

  reset(identifier: string, action: string): void {
    const key = this.getKey(identifier, action);
    this.attempts.delete(key);
  }

  getAttempts(identifier: string, action: string): number {
    const key = this.getKey(identifier, action);
    const entry = this.attempts.get(key);
    return entry?.attempts || 0;
  }
}

// Rate limiting configuration constants
const RATE_LIMIT_CONFIG = {
  LOGIN: {
    WINDOW_MINUTES: 15,
    MAX_ATTEMPTS: 10, // Increased from 5 to 10
    BLOCK_MINUTES_DEV: 1, // Reduced from 2 to 1
    BLOCK_MINUTES_PROD: 5, // Reduced from 10 to 5
  },
} as const;

// Pre-configured rate limiters for different auth actions
export const loginRateLimiter = new RateLimiter({
  windowMs: RATE_LIMIT_CONFIG.LOGIN.WINDOW_MINUTES * 60 * 1000,
  maxAttempts: RATE_LIMIT_CONFIG.LOGIN.MAX_ATTEMPTS,
  blockDurationMs:
    process.env.NODE_ENV === "development"
      ? RATE_LIMIT_CONFIG.LOGIN.BLOCK_MINUTES_DEV * 60 * 1000
      : RATE_LIMIT_CONFIG.LOGIN.BLOCK_MINUTES_PROD * 60 * 1000,
});
