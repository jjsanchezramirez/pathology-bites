// src/shared/utils/api/parse-body.ts
//
// Zod-validated request-body parsing for route handlers. Returns the parsed
// data, or the 400 NextResponse to send back. Narrow with `instanceof`, same
// idiom as api-guard (strict:false — {ok:false} unions don't narrow):
//
//   const body = await parseBody(request, updateSchema);
//   if (body instanceof NextResponse) return body;
//   // body is z.infer<typeof updateSchema>

import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * The one standardized error body for route handlers: `{ error }` (optionally
 * `{ error, details }`). Routes otherwise hand-roll `NextResponse.json({ error })`
 * — this helper exists for the parse path so the 400 shape matches everywhere.
 */
export function apiError(message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json(
    details === undefined ? { error: message } : { error: message, details },
    { status }
  );
}

export async function parseBody<Schema extends z.ZodTypeAny>(
  request: Request,
  schema: Schema
): Promise<z.infer<Schema> | NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return apiError("Validation failed", 400, result.error.flatten());
  }

  return result.data;
}

/**
 * Multipart form parsing for upload routes. `request.formData()` throws when the
 * body isn't multipart/form-data or urlencoded; that is the client's mistake, so
 * answer 400 rather than letting it surface as a 500.
 *
 *   const formData = await parseFormData(request);
 *   if (formData instanceof NextResponse) return formData;
 */
export async function parseFormData(request: Request): Promise<FormData | NextResponse> {
  try {
    return await request.formData();
  } catch {
    return apiError("Expected a multipart/form-data body", 400);
  }
}
