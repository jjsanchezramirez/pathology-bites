/**
 * Logging barrel.
 *
 * Prefer `log` (variadic facade) for general logging:
 *   import { log } from "@/shared/utils/logging";
 *   log.debug("...");  // dev-only
 *   log.error("...");  // always, sanitized in prod
 *
 * `devLog` exposes structured helpers (request/response/auth/cache/performance/…).
 * `secureLog` + `sanitizeForLogging` are the low-level sanitizing primitives.
 */

export { log } from "./logger";
export type { Logger } from "./logger";
export {
  devLog,
  generateRequestId,
  measureTime,
  type RequestLogContext,
  type ResponseLogContext,
  type DatabaseLogContext,
} from "./dev-logger";
export { secureLog, sanitizeForLogging } from "./secure-logging";
