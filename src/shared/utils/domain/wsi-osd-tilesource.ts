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
    // left/top are LEVEL-0 (base) pixel coords; outW/outH are the OUTPUT tile size; the
    // server reads the base region [left, left+outW*factor) and downsamples to outW. So a
    // tile (x,y) at downsample `factor` = 2^(maxLevel-level) maps to base origin
    // x*tileSize*factor. (Verified empirically against rosai.secondslide.com — the old
    // rosai branch used unscaled coords + an exponent, which mis-placed every non-native
    // level, panning the image per zoom.) aanp keeps its literal "0" coord prefix.
    const { flavor, tileSize, maxLevel, baseUrl, quality } = ts;
    return {
      width: ts.width,
      height: ts.height,
      tileSize,
      minLevel: 0,
      maxLevel,
      getTileUrl: (level: number, x: number, y: number) => {
        const factor = Math.pow(2, maxLevel - level);
        const left = x * tileSize * factor;
        const top = y * tileSize * factor;
        if (flavor === "rosai") {
          return `${baseUrl}?${left}+${top}+${tileSize}+${tileSize}+${factor}+${quality}`;
        }
        return `${baseUrl}?0${left}+0${top}+${tileSize}+${tileSize}+${factor}`;
      },
    };
  }

  if (ts.kind === "iiif") {
    // IIIF info.json object — OSD's IIIFTileSource consumes it directly; tiles load as <img>.
    return ts.info;
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
