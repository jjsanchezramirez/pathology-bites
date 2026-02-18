import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOST = "pub-a4bec7073d99465f99043c842be6318c.r2.dev";

/**
 * GET /api/admin/proxy-image?url=<encoded-r2-url>
 *
 * Server-side proxy that fetches an R2 image and streams it back to the
 * client. Needed because R2 doesn't return CORS headers, so client-side
 * fetch() / crossOrigin=anonymous are both blocked by the browser when
 * trying to draw images onto a canvas (canvas tainting / "Failed to fetch").
 *
 * Only allows URLs from our own R2 bucket to prevent open-proxy abuse.
 */
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  // Restrict to our own R2 bucket — never let this become an open proxy.
  if (parsed.hostname !== ALLOWED_HOST) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(rawUrl);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Allow the canvas to use this response — same-origin from the browser's perspective
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[proxy-image] fetch failed:", err);
    return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
  }
}
