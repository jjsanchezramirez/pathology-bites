/**
 * Shared vocabulary for the image converter.
 *
 * Everything here is used by both the main thread and the Web Worker, so it
 * must stay free of DOM/React imports.
 */

export type OutputFormat = "image/png" | "image/jpeg" | "image/webp" | "image/avif" | "image/tiff";

export interface OutputFormatSpec {
  value: OutputFormat;
  label: string;
  ext: string;
  /** Encoder honours the 0–1 quality setting. */
  lossy: boolean;
  /** Format can carry an alpha channel; if not, transparency is flattened. */
  alpha: boolean;
  note?: string;
}

export const OUTPUT_FORMATS: OutputFormatSpec[] = [
  { value: "image/png", label: "PNG", ext: "png", lossy: false, alpha: true },
  { value: "image/jpeg", label: "JPEG", ext: "jpg", lossy: true, alpha: false },
  { value: "image/webp", label: "WebP", ext: "webp", lossy: true, alpha: true },
  { value: "image/avif", label: "AVIF", ext: "avif", lossy: true, alpha: true },
  {
    value: "image/tiff",
    label: "TIFF",
    ext: "tif",
    lossy: false,
    alpha: true,
    note: "uncompressed — expect large files",
  },
];

export function formatSpec(format: OutputFormat): OutputFormatSpec {
  return OUTPUT_FORMATS.find((f) => f.value === format) ?? OUTPUT_FORMATS[0];
}

/** How to treat a multi-page (or pyramidal) TIFF. */
export type PageSelection = "first" | "largest" | "all";

export interface ConvertOptions {
  format: OutputFormat;
  /** 0–1. Ignored by lossless encoders. */
  quality: number;
  /** Longest edge, in px. Null keeps the original size; never upscales. */
  maxDimension: number | null;
  pages: PageSelection;
  /** Painted under the image when the target format has no alpha channel. */
  background: string;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  format: "image/png",
  quality: 0.9,
  maxDimension: null,
  pages: "first",
  background: "#ffffff",
};

/**
 * Decoding a TIFF means holding the full RGBA raster in memory (4 bytes per
 * pixel) plus a canvas backing store of the same size, so a gigapixel slide
 * would take the tab down. Refuse anything past this with a clear message
 * instead of crashing.
 */
export const MAX_PIXELS = 80_000_000;

/** Beyond this, browsers start failing to allocate the canvas backing store. */
export const MAX_CANVAS_DIMENSION = 16_384;

export interface ConvertedPage {
  name: string;
  blob: Blob;
  width: number;
  height: number;
}

export interface WorkerRequest {
  id: string;
  name: string;
  buffer: ArrayBuffer;
  options: ConvertOptions;
}

export type WorkerResponse =
  | { id: string; status: "ok"; pages: ConvertedPage[] }
  | { id: string; status: "error"; error: string };

/** Input types we can decode. SVG is deliberately excluded — see README note. */
export const ACCEPTED_INPUT = ".tif,.tiff,.png,.jpg,.jpeg,.jfif,.webp,.gif,.bmp,.avif,.ico,image/*";

export function stripExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
