// wip/r2-signed-urls/api/routes/signed-url-route.ts
/**
 * ⚠️ WORK IN PROGRESS - NOT CURRENTLY USED ⚠️
 *
 * API route for generating single R2 signed URLs
 *
 * THEORETICAL USE CASE:
 * Would be used at /api/r2/signed-url to generate temporary access URLs
 * for private R2 content. Supports both POST (with options) and GET (simple) methods.
 *
 * CURRENT STATUS:
 * Not implemented because all R2 content is public. See r2-signed-urls.ts for details.
 *
 * ORIGINAL LOCATION: src/app/api/r2/signed-url/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
// Note: This import path would need to be updated if reintegrated
// import { signedUrlApi } from "@/shared/utils/r2-signed-urls";

export async function POST(request: NextRequest) {
  try {
    const { key, options: _options = {} } = await request.json();

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Invalid key parameter" }, { status: 400 });
    }

    // Generate signed URL
    // const result = await signedUrlApi.single(key, options);
    const result = { url: "", expiresAt: "" }; // Placeholder

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=300", // 5 minutes
        "X-R2-Direct-Access": "true",
      },
    });
  } catch (error) {
    console.error("Signed URL generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate signed URL",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET method for simple key-based requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const _expiresIn = parseInt(searchParams.get("expiresIn") || "3600");

    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    // const result = await signedUrlApi.single(key, { expiresIn });
    const result = { url: "", expiresAt: "" }; // Placeholder

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "X-R2-Direct-Access": "true",
      },
    });
  } catch (error) {
    console.error("Signed URL generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate signed URL",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
