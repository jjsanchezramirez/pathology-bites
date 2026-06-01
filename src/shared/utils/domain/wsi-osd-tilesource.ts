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
    // Aperio ImageServer region-crop. The two servers differ in coordinate convention
    // (verified empirically — do not "simplify" to one branch):
    //   - rosai (v14): left/top in DOWNSAMPLED coords (x*tileSize), 5th param = exponent.
    //   - aanp  (v12): left/top in LEVEL-0 coords (x*tileSize*factor), 5th param = factor,
    //                  with a literal "0" prefix on the coords (matches their viewer JS).
    const { flavor, tileSize, maxLevel, baseUrl, quality } = ts;
    return {
      width: ts.width,
      height: ts.height,
      tileSize,
      minLevel: 0,
      maxLevel,
      getTileUrl: (level: number, x: number, y: number) => {
        const exp = maxLevel - level;
        if (flavor === "rosai") {
          return `${baseUrl}?${x * tileSize}+${y * tileSize}+${tileSize}+${tileSize}+${exp}+${quality}`;
        }
        const factor = Math.pow(2, exp);
        return `${baseUrl}?0${x * tileSize * factor}+0${y * tileSize * factor}+${tileSize}+${tileSize}+${factor}`;
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
