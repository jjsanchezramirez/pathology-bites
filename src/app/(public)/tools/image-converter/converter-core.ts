/**
 * The actual pixel work, deliberately free of both DOM-specific and
 * Worker-specific globals.
 *
 * The caller supplies a `CanvasFactory`, so the same code runs inside a Web
 * Worker against `OffscreenCanvas` and on the main thread against a plain
 * `<canvas>` for browsers that lack `OffscreenCanvas`.
 *
 * Nothing here touches the network — every byte stays in the tab.
 */

import {
  MAX_CANVAS_DIMENSION,
  MAX_PIXELS,
  formatSpec,
  stripExtension,
  type ConvertOptions,
  type ConvertedPage,
} from "./converter-types";

export interface CanvasSurface {
  image: CanvasImageSource;
  ctx: CanvasRenderingContext2D;
  encode(type: string, quality?: number): Promise<Blob>;
  /** Drop the backing store so the next page isn't decoded alongside this one. */
  release(): void;
}

export type CanvasFactory = (width: number, height: number) => CanvasSurface;

/* -------------------------------------------------------------------------- */
/* TIFF support (lazy — the decoder is ~100 KB and most sessions never load it) */
/* -------------------------------------------------------------------------- */

interface UtifIfd {
  width: number;
  height: number;
  data: Uint8Array;
  [tag: string]: unknown;
}

interface UtifModule {
  decode(buffer: ArrayBuffer): UtifIfd[];
  decodeImage(buffer: ArrayBuffer, ifd: UtifIfd, ifds: UtifIfd[]): void;
  toRGBA8(ifd: UtifIfd): Uint8Array;
  encodeImage(
    rgba: Uint8Array,
    width: number,
    height: number,
    metadata?: Record<string, unknown>
  ): ArrayBuffer;
}

let utifPromise: Promise<UtifModule> | null = null;

function loadUtif(): Promise<UtifModule> {
  if (!utifPromise) {
    utifPromise = import("utif2").then(
      (mod) => ((mod as { default?: unknown }).default ?? mod) as unknown as UtifModule
    );
  }
  return utifPromise;
}

function tagValue(ifd: UtifIfd, tag: string): number | undefined {
  const raw = ifd[tag];
  return Array.isArray(raw) && typeof raw[0] === "number" ? raw[0] : undefined;
}

/* -------------------------------------------------------------------------- */
/* Input sniffing                                                             */
/* -------------------------------------------------------------------------- */

type SourceKind = "tiff" | "bigtiff" | "bitmap";

/**
 * Decide by magic bytes rather than file extension — TIFFs routinely arrive
 * with the wrong extension or an empty MIME type out of scanner software.
 */
function sniff(bytes: Uint8Array): SourceKind {
  if (bytes.length < 4) return "bitmap";
  const littleEndian = bytes[0] === 0x49 && bytes[1] === 0x49;
  const bigEndian = bytes[0] === 0x4d && bytes[1] === 0x4d;
  if (littleEndian || bigEndian) {
    const magic = littleEndian ? bytes[2] | (bytes[3] << 8) : (bytes[2] << 8) | bytes[3];
    if (magic === 42) return "tiff";
    if (magic === 43) return "bigtiff";
  }
  return "bitmap";
}

/* -------------------------------------------------------------------------- */
/* Decoding                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One emittable page, not yet rasterised. `open()` is what allocates memory, so
 * a 40-page TIFF holds one page at a time rather than all forty at once.
 */
interface PageSource {
  /** 1-based page number as it appears in the source file. */
  index: number;
  width: number;
  height: number;
  open(): Promise<OpenPage>;
}

interface OpenPage {
  image: CanvasImageSource;
  /** Set when the raster already lives on a correctly sized canvas. */
  surface: CanvasSurface | null;
  release(): void;
}

/**
 * `imageOrientation: "from-image"` applies the EXIF rotation that phone
 * cameras rely on. Older engines reject the enum value with a TypeError, which
 * is how we tell "unsupported option" apart from "undecodable image".
 */
let orientationSupported: boolean | null = null;

async function decodeBitmap(blob: Blob): Promise<ImageBitmap> {
  if (orientationSupported !== false) {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      orientationSupported = true;
      return bitmap;
    } catch (err) {
      if (orientationSupported !== null || !(err instanceof TypeError)) throw err;
      orientationSupported = false;
    }
  }
  return createImageBitmap(blob);
}

function assertWithinBudget(width: number, height: number, label: string): void {
  if (width * height > MAX_PIXELS) {
    const megapixels = Math.round((width * height) / 1_000_000);
    throw new Error(
      `${label} is ${width}\u00d7${height} (${megapixels} MP), past the ${Math.round(
        MAX_PIXELS / 1_000_000
      )} MP this tool can hold in memory. Whole-slide images belong in the virtual slide viewer.`
    );
  }
}

async function prepareTiffPages(
  buffer: ArrayBuffer,
  options: ConvertOptions,
  createCanvas: CanvasFactory
): Promise<PageSource[]> {
  const utif = await loadUtif();
  const ifds = utif.decode(buffer);

  // `decode` also returns EXIF/GPS directories, which carry no raster.
  const imageIfds = ifds.filter((ifd) => !!tagValue(ifd, "t256") && !!tagValue(ifd, "t257"));
  if (imageIfds.length === 0) throw new Error("No image data found in this TIFF.");

  const area = (ifd: UtifIfd) => (tagValue(ifd, "t256") ?? 0) * (tagValue(ifd, "t257") ?? 0);
  let chosen: UtifIfd[];
  switch (options.pages) {
    case "all":
      chosen = imageIfds;
      break;
    case "largest":
      chosen = [imageIfds.reduce((best, ifd) => (area(ifd) > area(best) ? ifd : best))];
      break;
    default:
      chosen = [imageIfds[0]];
  }

  const multiPage = chosen.length > 1;

  return chosen.map((ifd) => {
    const index = imageIfds.indexOf(ifd) + 1;
    const width = tagValue(ifd, "t256") ?? 0;
    const height = tagValue(ifd, "t257") ?? 0;
    return {
      index,
      width,
      height,
      async open(): Promise<OpenPage> {
        assertWithinBudget(width, height, multiPage ? `Page ${index}` : "This image");
        let surface: CanvasSurface | null = null;
        try {
          utif.decodeImage(buffer, ifd, ifds);
          const rgba = utif.toRGBA8(ifd);
          surface = createCanvas(ifd.width, ifd.height);
          surface.ctx.putImageData(
            new ImageData(new Uint8ClampedArray(rgba.buffer as ArrayBuffer), ifd.width, ifd.height),
            0,
            0
          );
        } finally {
          // UTIF caches the decoded raster on the IFD; drop it either way.
          delete (ifd as { data?: Uint8Array }).data;
        }
        const opened = surface;
        return {
          image: opened.image,
          surface: opened,
          release: () => opened.release(),
        };
      },
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Rendering + encoding                                                       */
/* -------------------------------------------------------------------------- */

/** Fit inside a box without upscaling, and inside what a canvas can allocate. */
export function fitWithin(
  width: number,
  height: number,
  maxDimension: number | null
): { width: number; height: number } {
  const limit = Math.min(maxDimension ?? Number.POSITIVE_INFINITY, MAX_CANVAS_DIMENSION);
  const longest = Math.max(width, height);
  if (longest <= limit) return { width, height };
  const scale = limit / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function encodeSurface(
  surface: CanvasSurface,
  width: number,
  height: number,
  options: ConvertOptions
): Promise<Blob> {
  const spec = formatSpec(options.format);

  if (options.format === "image/tiff") {
    const utif = await loadUtif();
    const pixels = surface.ctx.getImageData(0, 0, width, height);
    // t338 = ExtraSamples; 2 marks the alpha as unassociated, which is what
    // canvas hands back. UTIF's default of 1 (premultiplied) would be a lie.
    const encoded = utif.encodeImage(new Uint8Array(pixels.data.buffer), width, height, {
      t338: [2],
    });
    return new Blob([encoded], { type: "image/tiff" });
  }

  const blob = await surface.encode(options.format, spec.lossy ? options.quality : undefined);
  // Canvas encoders fall back to PNG rather than failing when they don't know
  // a format, so check what actually came back instead of trusting the request.
  if (blob.type && blob.type !== options.format) {
    throw new Error(`This browser can't encode ${spec.label}. Pick another output format.`);
  }
  return blob;
}

/**
 * Convert one file. Returns one entry per emitted page.
 *
 * @param buffer  Raw bytes of the source file.
 * @param name    Original filename, used to derive output names.
 */
export async function convertImage(
  buffer: ArrayBuffer,
  name: string,
  options: ConvertOptions,
  createCanvas: CanvasFactory
): Promise<ConvertedPage[]> {
  const spec = formatSpec(options.format);
  const kind = sniff(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4)));

  if (kind === "bigtiff") {
    throw new Error("BigTIFF (64-bit TIFF) isn't supported. Save as a standard TIFF first.");
  }

  let sources: PageSource[];
  if (kind === "tiff") {
    sources = await prepareTiffPages(buffer, options, createCanvas);
  } else {
    let bitmap: ImageBitmap;
    try {
      bitmap = await decodeBitmap(new Blob([buffer]));
    } catch {
      throw new Error("This browser couldn't decode the file \u2014 is it a supported image?");
    }
    assertWithinBudget(bitmap.width, bitmap.height, "This image");
    sources = [
      {
        index: 1,
        width: bitmap.width,
        height: bitmap.height,
        open: async () => ({
          image: bitmap,
          surface: null,
          release: () => bitmap.close(),
        }),
      },
    ];
  }

  const base = stripExtension(name);
  const multiPage = sources.length > 1;
  const outputs: ConvertedPage[] = [];
  const failures: string[] = [];

  for (const source of sources) {
    try {
      const opened = await source.open();
      const target = fitWithin(source.width, source.height, options.maxDimension);
      const resized = target.width !== source.width || target.height !== source.height;
      const flatten = !spec.alpha;

      // A TIFF page needing neither resizing nor flattening is already sitting
      // on a correctly sized canvas \u2014 encode it in place rather than copying.
      let scratch: CanvasSurface | null = null;
      try {
        let surface = opened.surface;
        if (!surface || resized || flatten) {
          scratch = createCanvas(target.width, target.height);
          if (flatten) {
            scratch.ctx.fillStyle = options.background;
            scratch.ctx.fillRect(0, 0, target.width, target.height);
          }
          scratch.ctx.imageSmoothingEnabled = true;
          scratch.ctx.imageSmoothingQuality = "high";
          scratch.ctx.drawImage(opened.image, 0, 0, target.width, target.height);
          surface = scratch;
        }

        const blob = await encodeSurface(surface, target.width, target.height, options);
        outputs.push({
          name: `${base}${multiPage ? `-p${source.index}` : ""}.${spec.ext}`,
          blob,
          width: target.width,
          height: target.height,
        });
      } finally {
        scratch?.release();
        opened.release();
      }
    } catch (err) {
      failures.push(`page ${source.index}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (outputs.length === 0) {
    throw new Error(
      failures.length === 1
        ? failures[0].replace(/^page \d+: /, "")
        : `Could not convert this file (${failures.join("; ")}).`
    );
  }
  return outputs;
}
