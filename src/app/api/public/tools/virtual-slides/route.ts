import { NextResponse } from "next/server";
import {
  VIRTUAL_SLIDES_JSON_URL,
  VIRTUAL_SLIDES_MANIFEST_URL,
} from "@/shared/config/virtual-slides";
import {
  hiddenSlidePrefixesFromManifest,
  isHiddenSlideId,
} from "@/shared/utils/domain/hidden-sources";

export const dynamic = "force-dynamic"; // Prevent pre-rendering during build

// The native app's corpus feed (the web app loads the corpus from R2 in the browser).
// It used to read a fixed legacy key, virtual-slides-v8-min.json.br, which stopped being
// republished in May 2026 and so served ~28k slides while the live corpus grew past 66k.
// Now it resolves the corpus the same way the web loader does: virtual-slides/manifest.json
// names the current content-addressed object, so a republish reaches the app with no
// redeploy. The compiled URL is only the degraded-mode fallback.
//
// Two changes to the payload, both matching what the web shows: slides from sources the
// liveness probe has hidden are dropped, and the `groups` map (unused by the app, ~10% of
// the bytes) is omitted. Entry and `bases` shapes are unchanged.

/**
 * @swagger
 * /api/public/tools/virtual-slides:
 *   get:
 *     summary: Get virtual slides dataset
 *     description: Retrieve the current virtual slides corpus (abbreviated-key format) from Cloudflare R2, resolved through virtual-slides/manifest.json. Slides from sources marked hidden in the manifest are omitted. Cached at the CDN for an hour.
 *     tags:
 *       - Public - Tools
 *     responses:
 *       200:
 *         description: Successfully retrieved virtual slides dataset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Virtual slides corpus { version, generated, total_count, bases, data }
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: public, s-maxage=3600, stale-while-revalidate=86400
 *       500:
 *         description: Internal server error or proxy fetch error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Proxy fetch error
 *                 message:
 *                   type: string
 *       502:
 *         description: Bad gateway - upstream fetch failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Upstream fetch failed
 *                 status:
 *                   type: number
 */
type Corpus = {
  version?: string;
  generated?: string;
  total_count?: number;
  bases?: unknown;
  data?: { x?: string }[];
  groups?: unknown;
};

// Fluid Compute reuses instances, so keep the last built payload per corpus hash: parsing
// the ~28 MB corpus is the expensive part and it only changes on a republish.
let memo: { key: string; body: string } | null = null;

async function resolveCorpus(): Promise<{ url: string; key: string; hidden: string[] }> {
  try {
    const res = await fetch(VIRTUAL_SLIDES_MANIFEST_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const manifest = await res.json();
      if (typeof manifest?.url === "string") {
        const hidden = hiddenSlidePrefixesFromManifest(manifest);
        return { url: manifest.url, key: `${manifest.hash}:${hidden.join(",")}`, hidden };
      }
    }
  } catch {
    // Manifest unreachable: fall through to the compiled URL.
  }
  return { url: VIRTUAL_SLIDES_JSON_URL, key: VIRTUAL_SLIDES_JSON_URL, hidden: [] };
}

export async function GET() {
  try {
    const { url, key, hidden } = await resolveCorpus();

    if (memo?.key !== key) {
      // no-store: the corpus is far over Next's 2 MB data-cache limit; the CDN caches the
      // response instead (Cache-Control below).
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
      if (!res.ok) {
        return NextResponse.json(
          { error: "Upstream fetch failed", status: res.status },
          { status: 502 }
        );
      }
      const corpus = (await res.json()) as Corpus;
      const data = (corpus.data ?? []).filter((e) => !isHiddenSlideId(e.x, hidden));
      memo = {
        key,
        body: JSON.stringify({
          version: corpus.version,
          generated: corpus.generated,
          total_count: data.length,
          bases: corpus.bases,
          data,
        }),
      };
    }

    return new NextResponse(memo.body, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Proxy fetch error", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
