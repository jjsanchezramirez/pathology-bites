/**
 * Canvas backends for `convertImage`.
 *
 * `OffscreenCanvas` is the fast path and the only one usable from a Worker.
 * The DOM factory exists for browsers without it (Safari < 16.4), where the
 * whole pipeline runs on the main thread instead.
 */

import type { CanvasFactory, CanvasSurface } from "./converter-core";

export function supportsOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== "undefined" && "convertToBlob" in OffscreenCanvas.prototype;
}

export const offscreenCanvasFactory: CanvasFactory = (width, height): CanvasSurface => {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(`Could not allocate a ${width}×${height} canvas.`);
  return {
    image: canvas as unknown as CanvasImageSource,
    ctx: ctx as unknown as CanvasRenderingContext2D,
    encode: (type, quality) => canvas.convertToBlob({ type, quality }),
    release: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
};

export const domCanvasFactory: CanvasFactory = (width, height): CanvasSurface => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  // Browsers clamp rather than throw when a canvas is too large to allocate.
  if (!ctx || canvas.width !== width || canvas.height !== height) {
    throw new Error(`Could not allocate a ${width}×${height} canvas.`);
  }
  return {
    image: canvas,
    ctx,
    encode: (type, quality) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Encoding produced no data."))),
          type,
          quality
        );
      }),
    release: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
};

/**
 * Ask the browser which output formats it can actually encode. Canvas encoders
 * silently fall back to PNG for unknown types, so the only reliable test is to
 * encode a pixel and read back the MIME type it hands you.
 */
export async function detectEncodableFormats(candidates: string[]): Promise<Set<string>> {
  const supported = new Set<string>();
  const probe = domCanvasFactory(1, 1);
  try {
    for (const type of candidates) {
      try {
        const blob = await probe.encode(type, 0.5);
        if (blob.type === type) supported.add(type);
      } catch {
        // Unsupported type — leave it out.
      }
    }
  } finally {
    probe.release();
  }
  return supported;
}
