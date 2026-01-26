/**
 * Development Environment Logger
 *
 * Provides enhanced logging capabilities for development environment
 * Automatically disabled in production to reduce noise
 */

import { secureLog } from "./secure-logging";

const isDevelopment = process.env.NODE_ENV === "development";
const isVerbose = process.env.LOG_LEVEL === "verbose" || process.env.LOG_LEVEL === "debug";

export interface RequestLogContext {
  method: string;
  path: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export interface ResponseLogContext extends RequestLogContext {
  status: number;
  duration: number;
  error?: string;
}

export interface DatabaseLogContext {
  query: string;
  duration: number;
  rows?: number;
  error?: string;
}

/**
 * Development logger that wraps secure logging with environment awareness
 */
export const devLog = {
  /**
   * Log API request details (only in development)
   */
  request: (context: RequestLogContext) => {
    if (!isDevelopment) return;

    const { method, path, userId, ip, requestId } = context;
    console.log(`[API Request] ${method} ${path}`, {
      userId: userId || "anonymous",
      ip: ip || "unknown",
      requestId: requestId || "N/A",
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log API response details (only in development)
   */
  response: (context: ResponseLogContext) => {
    if (!isDevelopment) return;

    const { method, path, status, duration, userId, error, requestId } = context;
    const statusEmoji = status >= 500 ? "❌" : status >= 400 ? "⚠️" : "✅";

    console.log(`[API Response] ${statusEmoji} ${method} ${path} - ${status} (${duration}ms)`, {
      userId: userId || "anonymous",
      requestId: requestId || "N/A",
      error: error || undefined,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log database query details (only in development with verbose logging)
   */
  database: (context: DatabaseLogContext) => {
    if (!isDevelopment || !isVerbose) return;

    const { query, duration, rows, error } = context;
    console.log(`[Database Query] ${query.substring(0, 100)}${query.length > 100 ? "..." : ""}`, {
      duration: `${duration}ms`,
      rows: rows || 0,
      error: error || undefined,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log debug information (only in development with verbose logging)
   */
  debug: (message: string, data?: unknown) => {
    if (!isDevelopment || !isVerbose) return;

    console.log(
      `[Debug] ${message}`,
      data
        ? typeof data === "object" && data !== null
          ? { ...data, timestamp: new Date().toISOString() }
          : { value: data, timestamp: new Date().toISOString() }
        : ""
    );
  },

  /**
   * Log info (development only, always uses secureLog in production)
   */
  info: (message: string, data?: unknown) => {
    if (isDevelopment) {
      console.log(`[Info] ${message}`, data || "");
    }
    // Always use secure logging for info level
    secureLog.info(message, data);
  },

  /**
   * Log warnings (always logged, uses secureLog)
   */
  warn: (message: string, data?: unknown) => {
    if (isDevelopment) {
      console.warn(`[Warning] ${message}`, data || "");
    }
    secureLog.warn(message, data);
  },

  /**
   * Log errors (always logged, uses secureLog)
   */
  error: (message: string, error?: unknown) => {
    if (isDevelopment) {
      console.error(`[Error] ${message}`, error || "");
    }
    secureLog.error(message, error);
  },

  /**
   * Log rate limit events (only in development)
   */
  rateLimit: (ip: string, endpoint: string, remaining: number, reset: Date) => {
    if (!isDevelopment) return;

    console.log(`[Rate Limit] ${ip} - ${endpoint}`, {
      remaining,
      resetAt: reset.toISOString(),
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log authentication events (only in development)
   */
  auth: (
    event: "login" | "logout" | "token_refresh" | "auth_check",
    userId?: string,
    success: boolean = true
  ) => {
    if (!isDevelopment) return;

    const eventEmoji = success ? "🔓" : "🔒";
    console.log(`[Auth] ${eventEmoji} ${event}`, {
      userId: userId || "unknown",
      success,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log cache operations (only in development with verbose logging)
   */
  cache: (operation: "hit" | "miss" | "set" | "delete", key: string, ttl?: number) => {
    if (!isDevelopment || !isVerbose) return;

    console.log(`[Cache] ${operation.toUpperCase()} - ${key}`, {
      ttl: ttl ? `${ttl}s` : undefined,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log performance metrics (only in development)
   */
  performance: (operation: string, duration: number, metadata?: unknown) => {
    if (!isDevelopment) return;

    const performanceEmoji = duration > 1000 ? "🐌" : duration > 500 ? "⚡" : "🚀";
    console.log(`[Performance] ${performanceEmoji} ${operation} - ${duration}ms`, metadata || "");
  },
};

/**
 * Create a request ID for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get client IP from request headers
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * Measure execution time of async operations
 */
export async function measureTime<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;

    if (isDevelopment) {
      devLog.performance(operation, duration);
    }

    return { result, duration };
  } catch (error) {
    const duration = Date.now() - start;
    devLog.error(`Operation failed: ${operation}`, { duration, error });
    throw error;
  }
}
