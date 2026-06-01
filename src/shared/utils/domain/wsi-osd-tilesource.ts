// Client-safe (no fetch): turn a resolved WsiTileSource descriptor into an
// OpenSeadragon `tileSources` value. Shared by the native React OSD viewer and
// the minimal CDN-OSD iframe route.
import type { WsiTileSource } from "./wsi-tilesource";

// Route a DZI tile base through our CORS-adding proxy. OSD appends "<level>/<x>_<y>.fmt"
// to Url by string concat, so it lands inside the ?url= value — proxy reads it raw.
const TILE_PROXY = "/api/debug/wsi-tile-proxy?url=";

export function buildOsdTileSource(ts: WsiTileSource, opts?: { proxy?: boolean }): unknown {
  if (ts.kind === "dzi") {
    // Legacy DZI descriptor — avoids OSD's XHR read of the .dzi (which would be
    // CORS-blocked); tiles load as <img> from the absolute Url base.
    return {
      Image: {
        xmlns: "http://schemas.microsoft.com/deepzoom/2008",
        Url: opts?.proxy ? `${TILE_PROXY}${ts.tilesUrl}` : ts.tilesUrl,
        Format: ts.format,
        Overlap: String(ts.overlap),
        TileSize: String(ts.tileSize),
        Size: { Width: ts.width, Height: ts.height },
      },
    };
  }
  if (ts.kind === "aperio") {
    // Aperio ImageServer region-crop: ?<left>+<top>+<outW>+<outH>+<factor>[+<quality>].
    // left/top are in the DOWNSAMPLED level's pixel space (x*tileSize, NOT scaled by factor);
    // outW/outH are the OUTPUT tile size; the 5th param is the downsample FACTOR
    // = 2^(maxLevel-level), selecting which pyramid level to read. The server returns an
    // outW×outH crop of that level. (Verified empirically against rosai.secondslide.com:
    // ?256+0+256+256+2 == native base[512,1024) downscaled; the earlier x*tileSize*factor
    // coords mis-placed every non-native level, leaving only the native level — factor 1 —
    // aligned.) aanp keeps its literal "0" coord prefix (numerically a no-op).
    const { flavor, tileSize, maxLevel, baseUrl, quality } = ts;
    return {
      width: ts.width,
      height: ts.height,
      tileSize,
      minLevel: 0,
      maxLevel,
      getTileUrl: (level: number, x: number, y: number) => {
        const factor = Math.pow(2, maxLevel - level);
        const left = x * tileSize;
        const top = y * tileSize;
        if (flavor === "rosai") {
          return `${baseUrl}?${left}+${top}+${tileSize}+${tileSize}+${factor}+${quality}`;
        }
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
        return `${id}/${x0},${y0},${w},${h}/${tw},/0/default.jpg`;
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
