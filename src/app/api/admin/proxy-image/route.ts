import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOST = "pub-a4bec7073d99465f99043c842be6318c.r2.dev";

/**
 * @swagger
 * /api/admin/proxy-image:
 *   get:
 *     summary: Proxy R2 images for CORS-free canvas access
 *     description: Server-side proxy that fetches an R2 image and streams it back to the client. Needed because R2 doesn't return CORS headers, preventing client-side fetch() and canvas operations. Only allows URLs from the configured R2 bucket to prevent open-proxy abuse.
 *     tags:
 *       - Admin - System
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 *           format: uri
 *         description: Full URL to the R2 image (must be from allowed R2 bucket)
 *         example: https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/image.jpg
 *     responses:
 *       200:
 *         description: Image successfully fetched and returned
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *           image/webp:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Type:
 *             schema:
 *               type: string
 *             description: Image MIME type
 *           Cache-Control:
 *             schema:
 *               type: string
 *             description: Cache control header (public, max-age=3600)
 *       400:
 *         description: Bad request - missing or invalid URL parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [Missing url param, Invalid url]
 *       403:
 *         description: Forbidden - URL not from allowed R2 bucket
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: URL not allowed
 *       502:
 *         description: Bad gateway - upstream R2 fetch failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Upstream fetch failed
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
