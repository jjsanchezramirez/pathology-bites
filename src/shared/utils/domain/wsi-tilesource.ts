// Server-side resolver: turn a repo slide_url into a self-hostable OpenSeadragon
// tile-source descriptor, so we can render the slide in OUR OWN OSD viewer instead
// of iframing the repo's whole page (no nav/footer chrome, and bypasses the page's
// X-Frame-Options block since we never iframe it — we fetch tiles directly).
//
// Feasibility is per-repository (see memory project_wsi_repo_tile_protocols). For
// VIEW-ONLY OSD, tiles load as <img> (no CORS needed); only canvas pixel-reads do.
// We read manifests server-side here, so manifest-CORS is moot. Supported:
//   - DZI:    Hemepath, WHO, St. Jude, MGH (all DeepZoom; differ only in how the
//             manifest URL/dims are located).
//   - Aperio: Rosai, AANP (region-crop API, custom getTileUrl). Tile hosts send ACAO:*.
//   - Blocked: PathPresenter (SAS-token), Toronto (Shibboleth), Recut (login).
//
// MUST run server-side (route handler / server component): it fetches cross-origin
// manifests the browser's CORS policy would block.

export type WsiTileSource =
  | {
      kind: "dzi";
      width: number;
      height: number;
      tileSize: number;
      overlap: number;
      format: string;
      // Absolute base for tiles, ends in "_files/" (OSD appends "<level>/<x>_<y>.<format>")
      tilesUrl: string;
      mpp?: number; // microns/pixel at native res (for magnification readout)
    }
  | {
      kind: "leeds";
      width: number;
      height: number;
      tileSize: number;
      minLevel: number;
      maxLevel: number;
      zoomList: number[];
      tileHost: string;
      slidePath: string;
      mpp?: number;
    }
  | {
      // Aperio ImageServer region-crop API: ?<left>+<top>+<w>+<h>+<param>[+<quality>]
      kind: "aperio";
      flavor: "rosai" | "aanp";
      width: number;
      height: number;
      tileSize: number;
      maxLevel: number;
      baseUrl: string;
      quality: number;
      mpp?: number;
    }
  | {
      // IIIF Image API (Wirtualny Mikroskop). We DON'T hand the info.json to OSD's
      // IIIFTileSource — it assumes a power-of-2 pyramid, but this server's coarsest
      // scaleFactor is 509 (≈512), so OSD requests a 512 level the server lacks and the
      // region runs off the image (y past height → negative h → "Image load aborted").
      // Instead we build a custom tilesource (below) against the server's real pyramid.
      kind: "iiif";
      width: number;
      height: number;
      tileSize: number;
      scaleFactors: number[]; // ascending, e.g. [1,2,4,…,256,509]
      id: string; // IIIF image id; tiles at `${id}/{region}/{size}/0/default.jpg`
      mpp?: number;
    };

export type WsiTileSourceResult = WsiTileSource | { kind: "unsupported"; reason: string };

const UA = "Mozilla/5.0 (compatible; PathologyBitesWSI/1.0)";

// Bound metadata fetches so a dead/slow repo returns a prompt error instead of hanging the
// route (and the same-origin connection behind it) for Node's ~120s default.
async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

function num(re: RegExp, s: string): number | null {
  const m = s.match(re);
  return m ? Number(m[1]) : null;
}

// Parse a standard DZI XML <Image .../><Size .../> manifest into a tile descriptor.
async function parseDzi(
  dziUrl: string,
  tilesUrl: string,
  mpp?: number
): Promise<WsiTileSourceResult> {
  const xml = await fetchText(dziUrl);
  const width = num(/Width="(\d+)"/, xml);
  const height = num(/Height="(\d+)"/, xml);
  const tileSize = num(/TileSize="(\d+)"/, xml);
  const overlap = num(/Overlap="(\d+)"/, xml);
  const fmt = xml.match(/Format="([^"]+)"/);
  if (!width || !height || !tileSize) {
    return { kind: "unsupported", reason: `Could not parse DZI manifest at ${dziUrl}` };
  }
  return {
    kind: "dzi",
    width,
    height,
    tileSize,
    overlap: overlap ?? 1,
    format: fmt ? fmt[1] : "jpeg",
    tilesUrl,
    mpp,
  };
}

// Maximum OSD level so the most-zoomed-out level fits the image in ~one tile.
function maxLevelFor(width: number, height: number, tileSize: number): number {
  return Math.ceil(Math.log2(Math.max(width, height) / tileSize));
}

// --- DZI repos ---------------------------------------------------------------

// Hemepath: page at <origin>/files/<name>.svs; OSD roots at <origin>/<name>.svs.dzi
// with tiles under <origin>/<name>.svs_files/.
async function resolveHemepath(slideUrl: string): Promise<WsiTileSourceResult> {
  const u = new URL(slideUrl);
  const filename = u.pathname.split("/").pop() ?? "";
  const root = `${u.origin}/${filename}`;
  return parseDzi(`${root}.dzi`, `${root}_files/`);
}

// LearnHaem: the slideUrl passed here is the DZI itself ("<root>.dzi.dzi", derived from the
// preview path client-side — see use-client-virtual-slides). Tiles live under "<root>.dzi_files/".
async function resolveLearnhaem(dziUrl: string): Promise<WsiTileSourceResult> {
  // "<root>.dzi.dzi" → tiles base "<root>.dzi_files/". Strip the trailing ".dzi" only.
  const tiles = dziUrl.replace(/\.dzi$/, "_files/");
  return parseDzi(dziUrl, tiles);
}

// KiKoXP (kikoxp.com) dynamic tiler. slides.kikoxp.com lazily tiles each slide on demand: a cold
// slide's .dzi 404s ("Slide not available") until a GET to "<dzi-url>.status" triggers tiling. The
// status endpoint transitions "Starting to Fetch Slide" → "Fetching Slide..." → "Slide Active", at
// which point the .dzi + tiles return 200 (~2s). Public — no auth/cookies/CSRF needed. We poll
// .status (cheap JSON) rather than hammering the .dzi, exiting on "Slide Active".
// NOTE: capability only — KiKoXP is intentionally NOT in the live virtual-slides corpus (crowd-
// sourced, per-contributor rights / consent unclear). This resolver stays dormant unless a KiKoXP
// slide URL is explicitly passed in (e.g. the /debug/kikoxp-viewer dev page).
async function warmKikoxpSlide(dziUrl: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    let msg = "";
    try {
      const r = await fetch(`${dziUrl}.status`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      msg = ((await r.json().catch(() => null)) as { message?: string } | null)?.message ?? "";
    } catch {
      /* network blip — retry */
    }
    if (msg === "Slide Active") return;
    await new Promise((res) => setTimeout(res, 700));
  }
  // Fall through even if unconfirmed: parseDzi surfaces a clear error if the slide is still cold.
}

// KiKoXP: the slideUrl IS the DZI. Two hosts: the objektyv-production S3 bucket (static, always
// available) and slides.kikoxp.com (dynamic — warm via .status first). Tiles sit at
// "<dzi - .dzi>_files/" (standard DZI), same as LearnHaem.
async function resolveKikoxp(slideUrl: string): Promise<WsiTileSourceResult> {
  const u = new URL(slideUrl);
  let dziUrl = slideUrl;
  // Normalize path-style S3 → virtual-hosted so the tile-proxy SSRF allowlist can stay
  // bucket-scoped (objektyv-production.s3.amazonaws.com) instead of blanket-allowing s3.amazonaws.com.
  if (u.hostname === "s3.amazonaws.com" && u.pathname.startsWith("/objektyv-production/")) {
    dziUrl = `https://objektyv-production.s3.amazonaws.com${u.pathname.slice(
      "/objektyv-production".length
    )}`;
  }
  if (new URL(dziUrl).hostname === "slides.kikoxp.com") {
    await warmKikoxpSlide(dziUrl);
  }
  return parseDzi(dziUrl, dziUrl.replace(/\.dzi$/, "_files/"));
}

// WHO/IARC: static DZI keyed by ?fid=, at /static/dzi/<fid>.dzi
async function resolveWho(slideUrl: string): Promise<WsiTileSourceResult> {
  const u = new URL(slideUrl);
  const fid = u.searchParams.get("fid");
  if (!fid) return { kind: "unsupported", reason: "WHO slide URL missing fid param" };
  const root = `${u.origin}/static/dzi/${fid}`;
  return parseDzi(`${root}.dzi`, `${root}_files/`);
}

// St. Jude: folder slug isn't guessable — read histology_image_index from the API.
async function resolveStJude(slideUrl: string): Promise<WsiTileSourceResult> {
  const id = new URL(slideUrl).pathname.split("/").pop();
  if (!id) return { kind: "unsupported", reason: "St. Jude slide URL missing sample id" };
  const json = (await fetchJson(`https://pecan.stjude.cloud/api/slides/samples/${id}`)) as {
    data?: {
      sample?: {
        histology_image_index?: string;
        histology_tile_images?: string;
        histology_image_microns_per_pixel?: number | string;
      };
    };
  };
  const sample = json.data?.sample;
  const dziUrl = sample?.histology_image_index;
  const tiles = sample?.histology_tile_images;
  if (!dziUrl || !tiles) {
    return { kind: "unsupported", reason: "St. Jude API returned no histology image index" };
  }
  const mpp = Number(sample?.histology_image_microns_per_pixel) || undefined;
  return parseDzi(dziUrl, tiles.endsWith("/") ? tiles : `${tiles}/`, mpp);
}

// Whether an MGH /list slide is an H&E. The stain sits in the displayName parenthetical
// (e.g. "Slide 2 - (HE Surf. Recut 5u)" → H&E; "Slide 1 - (H3K27me3 (TC) B1)" → not).
// Keep this regex identical to the JS copy in dev/resources/scrapers/enrich_mgh.mjs.
export function isHeStain(displayName?: string | null): boolean {
  if (!displayName) return false;
  return /\bh\s*&\s*e\b|\bh\s*\+\s*e\b|\bhe\b|hematoxylin/i.test(displayName);
}

// MGH: page name is the specimen id; resolve a slide file via /list, then DZI.
// `slide` selects a specific slide within the case (for related-slide navigation);
// with no explicit pick, default to the H&E slide (the natural "front door") if the case
// has one, else the first slide.
async function resolveMgh(slideUrl: string, slide?: string): Promise<WsiTileSourceResult> {
  const u = new URL(slideUrl);
  const specimen = u.pathname.split("/").pop();
  if (!specimen) return { kind: "unsupported", reason: "MGH slide URL missing specimen id" };
  const list = (await fetchJson(`${u.origin}/pv-http/wsi/case/${specimen}/list`)) as {
    names?: { name?: string; displayName?: string }[];
  };
  const names = list.names ?? [];
  const name =
    (slide && names.find((n) => n.name === slide)?.name) ||
    names.find((n) => isHeStain(n.displayName))?.name ||
    names[0]?.name;
  if (!name) return { kind: "unsupported", reason: "MGH /list returned no slide name" };
  const root = `${u.origin}/pv-http/${name}`;
  return parseDzi(`${root}.dzi`, `${root}_files/`);
}

// --- Aperio region-crop repos ------------------------------------------------

// Rosai: Aperio ImageServer at /imageserver<pathname>; dims via ?INFO -> "W|H|tw|th|...".
async function resolveRosai(slideUrl: string): Promise<WsiTileSourceResult> {
  const u = new URL(slideUrl);
  const baseUrl = `${u.origin}/imageserver${u.pathname}`;
  const info = await fetchText(`${baseUrl}?INFO`);
  const parts = info.split("|");
  const width = Number(parts[0]);
  const height = Number(parts[1]);
  const tileSize = Number(parts[2]) || 256;
  if (!width || !height) {
    return { kind: "unsupported", reason: `Could not parse Rosai ?INFO: ${info.slice(0, 80)}` };
  }
  return {
    kind: "aperio",
    flavor: "rosai",
    width,
    height,
    tileSize,
    maxLevel: maxLevelFor(width, height, tileSize),
    baseUrl,
    quality: 90,
    mpp: Number(info.match(/MPP\s*=\s*([\d.]+)/)?.[1]) || undefined,
  };
}

// AANP/Pitt: tile host is image.upmc.edu (Aperio); dims + tile base come from the
// inline `wsiData` blob on the Pitt viewer page.
async function resolveAanp(slideUrl: string): Promise<WsiTileSourceResult> {
  const html = await fetchText(slideUrl);
  const urlMatch = html.match(/"url":"([^"]+\.svs[^"]*)"/);
  const appmag = html.match(/"appmag":"(\d+)"/);
  // Aperio description carries the bounded dims: "... [0,100 36000x18966] (256x256) ..."
  const dims = html.match(/\[\d+,\d+\s+(\d+)x(\d+)\]/);
  const tile = html.match(/\((\d+)x(\d+)\)/);
  if (!urlMatch || !dims) {
    return { kind: "unsupported", reason: "Could not parse AANP wsiData (url/dims)" };
  }
  // http://image.upmc.edu:8080/.../<name>.svs/view.apml? -> https://image.upmc.edu/.../<name>.svs
  const baseUrl =
    urlMatch[1]
      .replace(/^http:\/\/image\.upmc\.edu:8080/, "https://image.upmc.edu")
      .split(".svs")[0] + ".svs";
  const width = Number(dims[1]);
  const height = Number(dims[2]);
  const tileSize = tile ? Number(tile[1]) : 256;
  const mag = appmag ? appmag[1] : "20";
  const maxLevel = mag === "40" ? 7 : 6;
  const mpp = Number(html.match(/MPP\s*=\s*([\d.]+)/)?.[1]) || undefined;
  return {
    kind: "aperio",
    flavor: "aanp",
    width,
    height,
    tileSize,
    maxLevel,
    baseUrl,
    quality: 90,
    mpp,
  };
}

// Wirtualny Mikroskop (MOST Wiedzy): standard IIIF Image API. info.json has no CORS
// header, so we fetch it here (server-side) and hand OSD the object directly.
async function resolveWirtualny(slideUrl: string): Promise<WsiTileSourceResult> {
  const m = slideUrl.match(/\/(?:show-image|iiif)\/([0-9a-fA-F-]+)/);
  if (!m) return { kind: "unsupported", reason: "Wirtualny: no image id in URL" };
  const origin = new URL(slideUrl).origin;
  const info = (await fetchJson(`${origin}/image/iiif/${m[1]}/info.json`)) as {
    width?: number;
    height?: number;
    "@id"?: string;
    id?: string;
    tiles?: { width?: number; height?: number; scaleFactors?: number[] }[];
  };
  if (!info.width || !info.height) {
    return { kind: "unsupported", reason: "Wirtualny: bad IIIF info.json" };
  }
  const tile = info.tiles?.[0];
  const tileSize = tile?.width || 256;
  // Server-declared pyramid; fall back to a power-of-2 ladder if absent.
  let scaleFactors = (tile?.scaleFactors || []).filter((s) => s > 0).sort((a, b) => a - b);
  if (scaleFactors.length === 0) {
    scaleFactors = [1];
    while (Math.max(info.width, info.height) / scaleFactors[scaleFactors.length - 1] > tileSize) {
      scaleFactors.push(scaleFactors[scaleFactors.length - 1] * 2);
    }
  }
  const id = info["@id"] || info.id || `${origin}/image/iiif/${m[1]}`;
  return { kind: "iiif", width: info.width, height: info.height, tileSize, scaleFactors, id };
}

export async function resolveTileSource(
  slideUrl: string,
  _repository?: string,
  slide?: string // MGH: select a specific slide within the case (related-slide nav)
): Promise<WsiTileSourceResult> {
  let host: string;
  try {
    host = new URL(slideUrl).hostname.toLowerCase();
  } catch {
    return { kind: "unsupported", reason: "Invalid slide URL" };
  }
  try {
    if (host.includes("hematopathologyetutorial.com")) return await resolveHemepath(slideUrl);
    if (host.includes("virtualpathology.leeds.ac.uk")) return await resolveLeeds(slideUrl);
    if (host.includes("tumourclassification.iarc.who.int")) return await resolveWho(slideUrl);
    if (host.includes("pecan.stjude.cloud")) return await resolveStJude(slideUrl);
    if (host.includes("learn.mghpathology.org")) return await resolveMgh(slideUrl, slide);
    if (host.includes("rosai.secondslide.com")) return await resolveRosai(slideUrl);
    if (host.includes("neuro2.pathology.pitt.edu")) return await resolveAanp(slideUrl);
    if (host.includes("wirtualnymikroskop.mostwiedzy.pl")) return await resolveWirtualny(slideUrl);
    if (host.includes("slides.learnhaem.com")) return await resolveLearnhaem(slideUrl);
    // KiKoXP — capability only; not in the live corpus (see resolveKikoxp note).
    if (host === "slides.kikoxp.com" || host === "objektyv-production.s3.amazonaws.com")
      return await resolveKikoxp(slideUrl);
    if (
      host === "s3.amazonaws.com" &&
      new URL(slideUrl).pathname.startsWith("/objektyv-production/")
    )
      return await resolveKikoxp(slideUrl);
    return { kind: "unsupported", reason: `No self-hosted tile-source resolver for ${host}` };
  } catch (e) {
    return { kind: "unsupported", reason: e instanceof Error ? e.message : "resolver error" };
  }
}

// MGH only: list a case's related slides (H&E, special stains, levels) with thumbnails.
export type RelatedSlide = { name: string; label: string; thumbUrl: string };
export async function listRelatedSlides(slideUrl: string): Promise<RelatedSlide[]> {
  let u: URL;
  try {
    u = new URL(slideUrl);
  } catch {
    return [];
  }
  if (!u.hostname.toLowerCase().includes("learn.mghpathology.org")) return [];
  const specimen = u.pathname.split("/").pop();
  if (!specimen) return [];
  const list = (await fetchJson(`${u.origin}/pv-http/wsi/case/${specimen}/list`).catch(
    () => null
  )) as { names?: { name?: string; displayName?: string }[] } | null;
  const names = (list?.names ?? []).filter((n) => n.name).slice(0, 20);
  const slides = await Promise.all(
    names.map(async (n, i) => {
      const root = `${u.origin}/pv-http/${n.name}`;
      let thumbUrl = "";
      try {
        const xml = await fetchText(`${root}.dzi`);
        const w = num(/Width="(\d+)"/, xml) ?? 0;
        const h = num(/Height="(\d+)"/, xml) ?? 0;
        const tile = num(/TileSize="(\d+)"/, xml) ?? 256;
        const fmt = xml.match(/Format="([^"]+)"/)?.[1] ?? "jpeg";
        const maxLevel = Math.ceil(Math.log2(Math.max(w, h)));
        // Level where the whole image fits in one tile = a single-tile overview.
        const thumbLevel = Math.max(0, maxLevel - Math.ceil(Math.log2(Math.max(w, h) / tile)));
        thumbUrl = `${root}_files/${thumbLevel}/0_0.${fmt}`;
      } catch {
        /* leave thumb blank on failure */
      }
      return {
        name: n.name as string,
        label: n.displayName || `Slide ${i + 1}`,
        thumbUrl,
      };
    })
  );
  // H&E first (matches the representative slide the viewer opens on); otherwise keep /list order.
  return slides
    .map((s, i) => ({ s, i }))
    .sort((a, b) => Number(isHeStain(b.s.label)) - Number(isHeStain(a.s.label)) || a.i - b.i)
    .map((x) => x.s);
}

// Leeds: view.php injects per-slide dims into inline JS; tile host is public + CORS.
async function resolveLeeds(slideUrl: string): Promise<WsiTileSourceResult> {
  const html = await fetchText(slideUrl);
  const width = num(/var\s+slide_width\s*=\s*(\d+)/, html);
  const height = num(/var\s+slide_height\s*=\s*(\d+)/, html);
  const tileSize = num(/var\s+slide_tile\s*=\s*(\d+)/, html);
  const levels = num(/var\s+display_levels\s*=\s*(\d+)/, html);
  const pathMatch = html.match(/var\s+slide_path\s*=\s*'([^']+)'/);
  if (!width || !height || !tileSize || !levels || !pathMatch) {
    return { kind: "unsupported", reason: "Could not parse Leeds view.php slide vars" };
  }
  return {
    kind: "leeds",
    width,
    height,
    tileSize,
    minLevel: 0,
    maxLevel: levels,
    zoomList: [256, 128, 64, 32, 16, 8, 4, 2, 1],
    tileHost: "https://images.virtualpathology.leeds.ac.uk",
    slidePath: pathMatch[1],
  };
}
