// Client-safe (no fetch): turn a resolved WsiTileSource descriptor into an
// OpenSeadragon `tileSources` value. Shared by the native React OSD viewer and
// the minimal CDN-OSD iframe route.
import type { WsiTileSource } from "./wsi-tilesource";

// Route a DZI tile base through our CORS-adding proxy. OSD appends "<level>/<x>_<y>.fmt"
// to Url by string concat, so it lands inside the ?url= value — proxy reads it raw.
// Served by a Cloudflare Worker (wsi.pathologybites.com) rather than a Vercel
// route: Cloudflare bills per-request not per-GB and edge-caches immutable tiles, so
// tile traffic no longer burns Vercel origin transfer. Cross-origin now, so the host is
// allow-listed in next.config.ts connect-src (img-src already permits https:).
const TILE_PROXY = "https://wsi.pathologybites.com/?url=";

export function buildOsdTileSource(ts: WsiTileSource, opts?: { proxy?: boolean }): unknown {
  if (ts.kind === "dzi") {
    // Build the DZI tile URL ourselves instead of handing OSD a Microsoft
    // {Image} descriptor. OSD's native DziTileSource appends `this.queryParams`
    // to every tile (`...<fmt>` + queryParams); since we construct the descriptor
    // in memory there's no source URL for OSD to derive query params from, so the
    // value is `undefined` and stringifies onto the URL → "0_0.jpegundefined".
    // Strict static tile hosts (WHO, LearnHaem) 404 on that → proxy 502. A custom
    // getTileUrl gives full control; `tileOverlap` preserves DZI's edge overlap and
    // `maxLevel = ceil(log2(max(w,h)))` reproduces OSD's native DZI level math, so
    // tile requests are identical to the previously working path minus the suffix.
    const { tilesUrl, format, tileSize, overlap, width, height } = ts;
    const maxLevel = Math.ceil(Math.log2(Math.max(width, height)));
    return {
      width,
      height,
      tileSize,
      tileOverlap: overlap,
      minLevel: 0,
      maxLevel,
      getTileUrl: (level: number, x: number, y: number) => {
        const tile = `${tilesUrl}${level}/${x}_${y}.${format}`;
        return opts?.proxy ? `${TILE_PROXY}${tile}` : tile;
      },
    };
  }
  if (ts.kind === "aperio") {
    // Aperio ImageServer region-crop: ?<left>+<top>+<outW>+<outH>+<factor>[+<quality>].
    // outW/outH are the OUTPUT tile size; the 5th param is the downsample FACTOR
    // = 2^(maxLevel-level), selecting which pyramid level to read. The server returns an
    // outW×outH crop of that level. **left/top coordinate space differs per server:**
    //  - rosai (secondslide): DOWNSAMPLED level pixel space → x*tileSize. Verified:
    //    ?256+0+256+256+2 == native base[512,1024) downscaled (mean-abs-diff 3.56).
    //  - aanp (image.upmc.edu): LEVEL-0 (base) pixel space → x*tileSize*factor. Verified
    //    against image.upmc.edu: a factor-4 tile at left=16000 (out of bounds in level-4
    //    space, valid in base space) returns the base-16000 region, matching the native
    //    factor-1 tile at base 16000 (mean-abs-diff 8.5). Using level-space coords here
    //    mis-placed every non-native level, leaving only the native level — factor 1 —
    //    aligned (the scattered-fragments bug). aanp keeps its literal "0" coord prefix
    //    (numerically a no-op).
    // These conventions are genuinely different per host — do NOT unify them. A prior fix
    // (4a2425b) flattened both onto rosai's level-space scheme and broke aanp.
    const { flavor, tileSize, maxLevel, baseUrl, quality } = ts;
    return {
      width: ts.width,
      height: ts.height,
      tileSize,
      minLevel: 0,
      maxLevel,
      getTileUrl: (level: number, x: number, y: number) => {
        const factor = Math.pow(2, maxLevel - level);
        if (flavor === "rosai") {
          const left = x * tileSize;
          const top = y * tileSize;
          return `${baseUrl}?${left}+${top}+${tileSize}+${tileSize}+${factor}+${quality}`;
        }
        const left = x * tileSize * factor;
        const top = y * tileSize * factor;
        return `${baseUrl}?0${left}+0${top}+${tileSize}+${tileSize}+${factor}`;
      },
    };
  }

  if (ts.kind === "iiif") {
    // Custom IIIF source against the server's REAL pyramid (see wsi-tilesource.ts for why we
    // don't use OSD's IIIFTileSource). Level 0 = coarsest scaleFactor, maxLevel = full res.
    // For tile (x,y) at downsample s the IIIF region is [x·tile·s, y·tile·s, w, h] in full-res
    // coords (w/h clamped to the image edge), requested at output width ceil(w/s).
    const { width, height, tileSize, scaleFactors, id } = ts;
    const asc = [...scaleFactors].sort((a, b) => a - b);
    const maxLevel = asc.length - 1;
    return {
      width,
      height,
      tileSize,
      minLevel: 0,
      maxLevel,
      getTileUrl: (level: number, x: number, y: number) => {
        const s = asc[Math.max(0, Math.min(maxLevel, maxLevel - level))];
        const x0 = x * tileSize * s;
        const y0 = y * tileSize * s;
        const w = Math.min(tileSize * s, width - x0);
        const h = Math.min(tileSize * s, height - y0);
        if (w <= 0 || h <= 0) return ""; // out of bounds — OSD treats as a missing tile
        const tw = Math.ceil(w / s);
        const url = `${id}/${x0},${y0},${w},${h}/${tw},/0/default.jpg`;
        // Through our CORS proxy → canvas-clean (WebGL + screenshot + cross-fade snapshot).
        // We build the full absolute URL ourselves, so encode it as the ?url= value.
        return opts?.proxy ? `${TILE_PROXY}${encodeURIComponent(url)}` : url;
      },
    };
  }

  // leeds: custom tile endpoint, public + CORS '*'
  return {
    width: ts.width,
    height: ts.height,
    tileSize: ts.tileSize,
    minLevel: ts.minLevel,
    maxLevel: ts.maxLevel,
    getTileUrl: (level: number, x: number, y: number) =>
      `${ts.tileHost}${ts.slidePath}?${x * ts.tileSize}+${y * ts.tileSize}+${ts.tileSize}+${
        ts.tileSize
      }+${ts.zoomList[level]}+100`,
  };
}
