import { NextResponse } from "next/server";
import { R2_DATA_PUBLIC_URL } from "@/shared/config/r2-public-urls";

export const dynamic = "force-dynamic";
export const revalidate = 300;

/**
 * Serve the ankoma deck data as plain JSON for clients that cannot decompress
 * brotli (the native iOS app — URLSession has no br support). The browser
 * web client keeps reading the .json.br object directly.
 *
 * Indirection: read
 * the short-TTL manifest, fetch the immutable content-addressed object it
 * points at, and return it decompressed (Node's fetch auto-decompresses
 * Content-Encoding: br).
 */

const ANKI_BASE = R2_DATA_PUBLIC_URL;

/**
 * @swagger
 * /api/public/tools/anki:
 *   get:
 *     summary: Get the ankoma deck as plain JSON
 *     description: Resolves the current ankoma deck through the R2 manifest and returns it as uncompressed JSON, for clients that cannot decode brotli (the native iOS app). The web client reads the .json.br object directly.
 *     tags:
 *       - Public - Tools
 *     responses:
 *       200:
 *         description: Ankoma deck data (structure varies)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: public, max-age=300, stale-while-revalidate=600
 *       502:
 *         description: Manifest or deck fetch failed, or the manifest has no ankoma URL
 *       500:
 *         description: Proxy fetch error
 */

export async function GET() {
  try {
    const manifestRes = await fetch(`${ANKI_BASE}/anki/manifest.json`, {
      next: { revalidate: 300 },
    });
    if (!manifestRes.ok) {
      return NextResponse.json(
        { error: "Manifest fetch failed", status: manifestRes.status },
        { status: 502 }
      );
    }
    const manifest = (await manifestRes.json()) as { ankoma?: { url?: string } };
    const url = manifest.ankoma?.url;
    if (!url) {
      return NextResponse.json({ error: "Manifest missing ankoma url" }, { status: 502 });
    }

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream fetch failed", status: res.status },
        { status: 502 }
      );
    }
    const data = await res.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Proxy fetch error", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
