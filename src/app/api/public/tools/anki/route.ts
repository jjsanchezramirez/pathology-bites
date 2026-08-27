import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 300;

/**
 * Serve the ankoma deck data as plain JSON for clients that cannot decompress
 * brotli (the native iOS app — URLSession has no br support). The browser
 * web client keeps reading the .json.br object directly.
 *
 * Indirection is the same pattern as /api/public/tools/virtual-slides: read
 * the short-TTL manifest, fetch the immutable content-addressed object it
 * points at, and return it decompressed (Node's fetch auto-decompresses
 * Content-Encoding: br).
 */

const ANKI_BASE = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";

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
