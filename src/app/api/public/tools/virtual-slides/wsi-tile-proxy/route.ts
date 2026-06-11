import { NextRequest } from "next/server";

// Fetch a WSI tile server-side and re-emit it with CORS, so DZI repos (tiles served without
// ACAO) become canvas-clean → enables WebGL + screenshot. The viewer routes tiles through here.

// SSRF guard: only the known WSI tile hosts.
const ALLOWED =
  /^([a-z0-9-]+\.)*(hematopathologyetutorial\.com|virtualpathology\.leeds\.ac\.uk|tumourclassification\.iarc\.who\.int|stjudecloudslides\.blob\.core\.windows\.net|learn\.mghpathology\.org|rosai\.secondslide\.com|image\.upmc\.edu|wirtualnymikroskop\.mostwiedzy\.pl|slides\.learnhaem\.com|slides\.kikoxp\.com|objektyv-production\.s3\.amazonaws\.com)$/i;

/**
 * @swagger
 * /api/public/tools/virtual-slides/wsi-tile-proxy:
 *   get:
 *     summary: Proxy a WSI tile with CORS headers
 *     description: >
 *       Fetches a single WSI tile image from an allow-listed upstream tile host server-side and
 *       re-emits it with `Access-Control-Allow-Origin: *`, making DZI tiles (often served without
 *       CORS) canvas-clean to enable WebGL rendering and screenshots. Upstream hosts are restricted
 *       by an SSRF allowlist. The upstream fetch is bounded to an 8s timeout. Responses are cached
 *       for 24h.
 *     tags:
 *       - Public - Tools
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         description: >
 *           Absolute upstream tile URL (parsed manually so `+` in paths is preserved). Host must
 *           match the WSI SSRF allowlist.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The proxied tile image (content-type forwarded from upstream, defaults to image/jpeg).
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing, malformed, or unparseable url parameter.
 *       403:
 *         description: Host is not in the WSI SSRF allowlist.
 *       502:
 *         description: Upstream tile host unreachable, timed out, or returned a non-OK status.
 */
export async function GET(req: NextRequest) {
  // Parse the target manually so "+" in paths (e.g. Hemepath filenames) is NOT
  // turned into a space the way URLSearchParams would.
  const search = req.nextUrl.search;
  const i = search.indexOf("url=");
  if (i < 0) return new Response("missing url", { status: 400 });
  let target: string;
  try {
    target = decodeURIComponent(search.slice(i + 4));
  } catch {
    return new Response("bad url", { status: 400 });
  }

  let host: string;
  try {
    host = new URL(target).hostname;
  } catch {
    return new Response("invalid url", { status: 400 });
  }
  if (!ALLOWED.test(host)) return new Response(`host not allowed: ${host}`, { status: 403 });

  // Bound the upstream wait. A dead/slow tile host would otherwise hang this fetch until
  // Node's ~120s default, holding a SAME-ORIGIN connection open the whole time (tiles are
  // proxied same-origin). Repeated failed slide opens stranded those connections + their
  // buffers and progressively starved the browser's per-origin pool → eventual freeze.
  const upstream = await fetch(target, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PathologyBitesWSI/1.0)" },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!upstream || !upstream.ok) {
    return new Response("upstream error", { status: 502 });
  }

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=86400",
    },
  });
}
