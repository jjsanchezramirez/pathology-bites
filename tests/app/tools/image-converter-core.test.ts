/**
 * Exercises the image converter's decode pipeline against real TIFF files.
 *
 * Fixtures are generated with sharp at run time rather than checked in, so the
 * suite covers the compression schemes scanners actually emit (LZW, Deflate,
 * uncompressed, tiled/pyramidal) instead of one hand-rolled sample.
 *
 * A stub canvas records what the pipeline draws, which lets the test assert on
 * decoded pixel values, output sizing and page selection without a real canvas.
 */
import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { convertImage, fitWithin } from "@/app/(public)/tools/image-converter/converter-core";
import { DEFAULT_OPTIONS } from "@/app/(public)/tools/image-converter/converter-types";

/* --------------------------------------------------------------- polyfills */

if (typeof (globalThis as any).ImageData === "undefined") {
  (globalThis as any).ImageData = class {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };
}

// happy-dom has no image decoder; sharp stands in for the browser's.
(globalThis as any).createImageBitmap = async (blob: Blob) => {
  const meta = await sharp(Buffer.from(await blob.arrayBuffer())).metadata();
  return { width: meta.width!, height: meta.height!, close: () => {} };
};

/* ------------------------------------------------------------- stub canvas */

interface StubSurface {
  width: number;
  height: number;
  pixels: { data: Uint8ClampedArray; width: number; height: number } | null;
  fills: number[][];
  draws: Array<{ width: number; height: number }>;
  fillStyle: string | null;
  image: unknown;
  ctx: any;
  encode(type: string): Promise<Blob>;
  release(): void;
}

function stubCanvas() {
  const created: StubSurface[] = [];
  const live = { current: 0, peak: 0 };
  const factory = (width: number, height: number) => {
    live.current += 1;
    live.peak = Math.max(live.peak, live.current);
    let released = false;
    const surface: StubSurface = {
      width,
      height,
      pixels: null,
      fills: [],
      draws: [],
      fillStyle: null,
      image: null,
      ctx: null,
      encode: async (type: string) => new Blob([new Uint8Array([0, 1, 2, 3])], { type }),
      release: () => {
        if (released) return;
        released = true;
        live.current -= 1;
      },
    };
    surface.image = { surface };
    surface.ctx = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      get fillStyle() {
        return surface.fillStyle;
      },
      set fillStyle(value: string) {
        surface.fillStyle = value;
      },
      fillRect: (...args: number[]) => surface.fills.push(args),
      putImageData: (data: StubSurface["pixels"]) => {
        surface.pixels = data;
      },
      drawImage: (_src: unknown, _x: number, _y: number, w: number, h: number) =>
        surface.draws.push({ width: w, height: h }),
      getImageData: () =>
        surface.pixels ?? {
          data: new Uint8ClampedArray(surface.width * surface.height * 4),
          width: surface.width,
          height: surface.height,
        },
    };
    created.push(surface);
    return surface;
  };
  return { factory: factory as any, created, live };
}

/* ---------------------------------------------------------------- fixtures */

/** Magenta/teal 32px checker; the left third is transparent when `alpha`. */
function pattern(width: number, height: number, alpha: boolean) {
  const px = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const light = ((x >> 5) + (y >> 5)) % 2 === 0;
      px[i] = light ? 220 : 20;
      px[i + 1] = light ? 30 : 180;
      px[i + 2] = light ? 160 : 190;
      px[i + 3] = alpha && x < width / 3 ? 0 : 255;
    }
  }
  return sharp(px, { raw: { width, height, channels: 4 } });
}

const fixtures: Record<string, ArrayBuffer> = {};

async function store(name: string, buffer: Buffer) {
  fixtures[name] = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

beforeAll(async () => {
  await store("lzw.tif", await pattern(640, 480, false).tiff({ compression: "lzw" }).toBuffer());
  await store(
    "deflate-alpha.tif",
    await pattern(400, 300, true).tiff({ compression: "deflate" }).toBuffer()
  );
  await store("raw.tif", await pattern(320, 240, false).tiff({ compression: "none" }).toBuffer());
  await store(
    "pyramid.tif",
    await pattern(1024, 768, false)
      .tiff({ compression: "lzw", pyramid: true, tile: true, tileWidth: 256, tileHeight: 256 })
      .toBuffer()
  );
  await store("photo.jpg", await pattern(500, 500, false).jpeg({ quality: 92 }).toBuffer());
}, 60_000);

/** The full-size surface the decoder wrote the source raster into. */
function decodedSurface(created: StubSurface[]) {
  return created.find((surface) => surface.pixels !== null);
}

function pixelAt(surface: StubSurface, x: number, y: number) {
  const { data, width } = surface.pixels!;
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

/* ------------------------------------------------------------------- tests */

describe("fitWithin", () => {
  it("scales the longest edge down and never enlarges", () => {
    expect(fitWithin(1000, 500, 250)).toEqual({ width: 250, height: 125 });
    expect(fitWithin(200, 400, 100)).toEqual({ width: 50, height: 100 });
    expect(fitWithin(300, 200, 5000)).toEqual({ width: 300, height: 200 });
    expect(fitWithin(300, 200, null)).toEqual({ width: 300, height: 200 });
  });

  it("clamps to what a canvas can allocate even with no user limit", () => {
    expect(fitWithin(40_000, 20_000, null)).toEqual({ width: 16_384, height: 8_192 });
  });
});

describe("convertImage — TIFF decoding", () => {
  it.each([
    ["lzw.tif", 640, 480],
    ["deflate-alpha.tif", 400, 300],
    ["raw.tif", 320, 240],
  ])("decodes %s at full size with correct pixels", async (name, width, height) => {
    const { factory, created } = stubCanvas();
    const pages = await convertImage(fixtures[name], name, DEFAULT_OPTIONS, factory);

    expect(pages).toHaveLength(1);
    expect(pages[0].name).toBe(`${name.replace(/\.tif$/, "")}.png`);
    expect(pages[0].blob.type).toBe("image/png");
    expect([pages[0].width, pages[0].height]).toEqual([width, height]);

    // The checker starts light at x=0 and flips at x=32.
    const surface = decodedSurface(created)!;
    expect(pixelAt(surface, 5, 5).slice(0, 3)).toEqual([220, 30, 160]);
    expect(pixelAt(surface, 40, 5).slice(0, 3)).toEqual([20, 180, 190]);
  });

  it("keeps transparency when the target format supports alpha", async () => {
    const { factory, created } = stubCanvas();
    await convertImage(fixtures["deflate-alpha.tif"], "a.tif", DEFAULT_OPTIONS, factory);

    const surface = decodedSurface(created)!;
    expect(pixelAt(surface, 5, 5)[3]).toBe(0); // left third is transparent
    expect(pixelAt(surface, 300, 5)[3]).toBe(255);
    // PNG at native size needs no second canvas — nothing is flattened.
    expect(created.every((s) => s.fills.length === 0)).toBe(true);
  });

  it("flattens onto the chosen background for alpha-less formats", async () => {
    const { factory, created } = stubCanvas();
    const pages = await convertImage(
      fixtures["deflate-alpha.tif"],
      "a.tif",
      { ...DEFAULT_OPTIONS, format: "image/jpeg", background: "#ff0000" },
      factory
    );

    expect(pages[0].name).toBe("a.jpg");
    expect(pages[0].blob.type).toBe("image/jpeg");
    const flattened = created.find((surface) => surface.fills.length > 0)!;
    expect(flattened.fillStyle).toBe("#ff0000");
    expect(flattened.fills[0]).toEqual([0, 0, 400, 300]);
    expect(flattened.draws[0]).toEqual({ width: 400, height: 300 });
  });

  it("resizes to the requested longest edge", async () => {
    const { factory } = stubCanvas();
    const pages = await convertImage(
      fixtures["lzw.tif"],
      "big.tif",
      { ...DEFAULT_OPTIONS, maxDimension: 160 },
      factory
    );
    expect([pages[0].width, pages[0].height]).toEqual([160, 120]);
  });
});

describe("convertImage — multi-page TIFFs", () => {
  it("takes only the first page by default", async () => {
    const { factory } = stubCanvas();
    const pages = await convertImage(fixtures["pyramid.tif"], "p.tif", DEFAULT_OPTIONS, factory);
    expect(pages).toHaveLength(1);
    expect(pages[0].name).toBe("p.png");
    expect([pages[0].width, pages[0].height]).toEqual([1024, 768]);
  });

  it("emits every page with numbered filenames", async () => {
    const { factory } = stubCanvas();
    const pages = await convertImage(
      fixtures["pyramid.tif"],
      "p.tif",
      { ...DEFAULT_OPTIONS, pages: "all" },
      factory
    );

    expect(pages.length).toBeGreaterThan(1);
    expect(pages.map((page) => page.name)).toEqual(
      pages.map((_page, index) => `p-p${index + 1}.png`)
    );
    // A pyramid halves each level, so pages get progressively smaller.
    expect(pages[0].width).toBeGreaterThan(pages[1].width);
  });

  it("decodes pages one at a time instead of all at once", async () => {
    const { factory, created, live } = stubCanvas();
    const pages = await convertImage(
      fixtures["pyramid.tif"],
      "p.tif",
      { ...DEFAULT_OPTIONS, pages: "all" },
      factory
    );

    // Every page gets its own canvas...
    expect(created.length).toBeGreaterThanOrEqual(pages.length);
    // ...but only one is held at a time, so a long multi-page TIFF can't
    // accumulate every full-size raster in memory before encoding starts.
    expect(live.peak).toBe(1);
    expect(live.current).toBe(0);
  });

  it("picks the full-resolution level with 'largest'", async () => {
    const { factory } = stubCanvas();
    const pages = await convertImage(
      fixtures["pyramid.tif"],
      "p.tif",
      { ...DEFAULT_OPTIONS, pages: "largest" },
      factory
    );
    expect(pages).toHaveLength(1);
    expect([pages[0].width, pages[0].height]).toEqual([1024, 768]);
  });
});

describe("convertImage — non-TIFF inputs", () => {
  it("routes JPEG through the browser decoder and re-encodes", async () => {
    const { factory, created } = stubCanvas();
    const pages = await convertImage(fixtures["photo.jpg"], "photo.jpg", DEFAULT_OPTIONS, factory);

    expect(pages).toHaveLength(1);
    expect(pages[0].name).toBe("photo.png");
    expect([pages[0].width, pages[0].height]).toEqual([500, 500]);
    // No putImageData: the bitmap is drawn, not blitted.
    expect(created[0].draws[0]).toEqual({ width: 500, height: 500 });
  });
});

describe("convertImage — rejections", () => {
  it("refuses BigTIFF with an actionable message", async () => {
    const bigTiff = new Uint8Array(64);
    bigTiff.set([0x49, 0x49, 0x2b, 0x00]);
    const { factory } = stubCanvas();
    await expect(
      convertImage(bigTiff.buffer as ArrayBuffer, "huge.tif", DEFAULT_OPTIONS, factory)
    ).rejects.toThrow(/BigTIFF/);
  });

  it("reports undecodable files rather than throwing raw decoder errors", async () => {
    const junk = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44]);
    const { factory } = stubCanvas();
    await expect(
      convertImage(junk.buffer as ArrayBuffer, "junk.png", DEFAULT_OPTIONS, factory)
    ).rejects.toThrow(/couldn't decode/);
  });
});

describe("zipPages", () => {
  it("packs every output into a readable archive", async () => {
    const { zipPages } = await import("@/app/(public)/tools/image-converter/converter-download");
    const { unzipSync } = await import("fflate");

    const pages = [
      { name: "a.png", blob: new Blob([new Uint8Array([1, 2, 3])]), width: 1, height: 1 },
      { name: "b.png", blob: new Blob([new Uint8Array([4, 5])]), width: 1, height: 1 },
    ];
    const archive = await zipPages(pages);
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()));

    expect(archive.type).toBe("application/zip");
    expect(Object.keys(entries).sort()).toEqual(["a.png", "b.png"]);
    expect(Array.from(entries["a.png"])).toEqual([1, 2, 3]);
    expect(Array.from(entries["b.png"])).toEqual([4, 5]);
  });

  it("renames collisions so a batch can't silently drop a file", async () => {
    const { zipPages } = await import("@/app/(public)/tools/image-converter/converter-download");
    const { unzipSync } = await import("fflate");

    const dupe = (byte: number) => ({
      name: "scan.png",
      blob: new Blob([new Uint8Array([byte])]),
      width: 1,
      height: 1,
    });
    const archive = await zipPages([dupe(1), dupe(2), dupe(3)]);
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()));

    expect(Object.keys(entries).sort()).toEqual(["scan (2).png", "scan (3).png", "scan.png"]);
    expect(Array.from(entries["scan.png"])).toEqual([1]);
    expect(Array.from(entries["scan (3).png"])).toEqual([3]);
  });
});
