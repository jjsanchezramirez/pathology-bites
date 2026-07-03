// src/shared/utils/api/api-response.ts
//
// Standard JSON response helpers for route handlers.
//
// Error bodies are standardized on the dominant `{ error }` shape (optionally
// `{ error, details }`). Success shapes are intentionally NOT standardized —
// existing clients read route-specific payloads (some check `result.success`),
// so apiSuccess just wraps NextResponse.json without reshaping.

import { NextResponse } from "next/server";

/** `{ error, details? }` with the given status. */
export function apiError(message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json(
    details === undefined ? { error: message } : { error: message, details },
    { status }
  );
}

export function apiSuccess<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}
