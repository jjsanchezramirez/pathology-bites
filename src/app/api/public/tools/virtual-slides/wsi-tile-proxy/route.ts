import { NextRequest } from "next/server";

// Fetch a WSI tile server-side and re-emit it with CORS, so DZI repos (tiles served without
// ACAO) become canvas-clean → enables WebGL + screenshot. The viewer routes tiles through here.

// SSRF guard: only the known WSI tile hosts.
const ALLOWED =
  /^([a-z0-9-]+\.)*(hematopathologyetutorial\.com|virtualpathology\.leeds\.ac\.uk|tumourclassification\.iarc\.who\.int|stjudecloudslides\.blob\.core\.windows\.net|learn\.mghpathology\.org|rosai\.secondslide\.com|image\.upmc\.edu|wirtualnymikroskop\.mostwiedzy\.pl|slides\.learnhaem\.com)$/i;

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
