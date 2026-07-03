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
import { apiError } from "./api-response";

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
