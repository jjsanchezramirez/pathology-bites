/**
 * Centralized application logger
 *
 * A small, variadic facade over console that:
 *  - silences debug noise in production (`log.debug`)
 *  - sanitizes data in production via `sanitizeForLogging` (`log.info/warn/error`)
 *
 * This is the migration target for raw `console.*` calls. The richer, structured
 * helpers (`request`, `response`, `auth`, `cache`, `performance`, …) still live on
 * `devLog` in ./dev-logger and remain available for their existing callers.
 *
 * Mapping used during the console → logger migration:
 *   console.log   → log.debug   (silenced in production)
 *   console.debug → log.debug   (silenced in production)
 *   console.info  → log.info    (sanitized in production)
 *   console.warn  → log.warn    (sanitized in production)
 *   console.error → log.error   (sanitized in production)
 */

import { sanitizeForLogging } from "./secure-logging";

const isDev = process.env.NODE_ENV === "development";

function sanitizeArgs(args: unknown[]): unknown[] {
  return args.map((arg) =>
    arg instanceof Error
      ? { name: arg.name, message: arg.message, stack: arg.stack }
      : sanitizeForLogging(arg)
  );
}

export const log = {
  /** Dev-only diagnostics. Silenced entirely in production. */
  debug: (...args: unknown[]): void => {
    if (isDev) console.log(...args);
  },

  /** Informational. Logged everywhere; sanitized in production. */
  info: (...args: unknown[]): void => {
    if (isDev) {
      console.info(...args);
    } else {
      console.info(...sanitizeArgs(args));
    }
  },

  /** Warnings. Logged everywhere; sanitized in production. */
  warn: (...args: unknown[]): void => {
    if (isDev) {
      console.warn(...args);
    } else {
      console.warn(...sanitizeArgs(args));
    }
  },

  /** Errors. Logged everywhere; sanitized in production. */
  error: (...args: unknown[]): void => {
    if (isDev) {
      console.error(...args);
    } else {
      console.error(...sanitizeArgs(args));
    }
  },
};

export type Logger = typeof log;
