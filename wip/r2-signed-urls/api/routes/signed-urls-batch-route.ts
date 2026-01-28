// wip/r2-signed-urls/api/routes/signed-urls-batch-route.ts
/**
 * ⚠️ WORK IN PROGRESS - NOT CURRENTLY USED ⚠️
 *
 * API route for generating batch R2 signed URLs
 *
 * THEORETICAL USE CASE:
 * Would be used at /api/r2/signed-urls/batch to generate multiple temporary
 * access URLs in a single request (max 100 URLs per batch). More efficient than
 * individual requests when loading galleries or multiple resources.
 *
 * CURRENT STATUS:
 * Not implemented because all R2 content is public. See r2-signed-urls.ts for details.
 *
 * ORIGINAL LOCATION: src/app/api/r2/signed-urls/batch/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
// Note: This import path would need to be updated if reintegrated
// import { signedUrlApi } from "@/shared/utils/r2-signed-urls";

export async function POST(request: NextRequest) {
  try {
    const { keys, options: _options = {} } = await request.json();

    if (!Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { error: "Invalid keys parameter - must be non-empty array" },
        { status: 400 }
      );
    }

    if (keys.length > 100) {
      return NextResponse.json({ error: "Too many keys - maximum 100 per batch" }, { status: 400 });
    }

    // Validate all keys are strings
    if (!keys.every((key) => typeof key === "string")) {
      return NextResponse.json({ error: "All keys must be strings" }, { status: 400 });
    }

    // Generate batch signed URLs
    // const result = await signedUrlApi.batch(keys, options);
    const result = { urls: {}, expiresAt: "", count: 0 }; // Placeholder

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=300", // 5 minutes
        "X-R2-Direct-Access": "true",
        "X-Batch-Size": keys.length.toString(),
      },
    });
  } catch (error) {
    console.error("Batch signed URL generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate batch signed URLs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
