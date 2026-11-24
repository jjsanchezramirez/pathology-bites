#!/usr/bin/env node
/* eslint-disable no-console -- a command-line script; its output is the report */
/**
 * Builds the home page hero gallery images.
 *
 * The gallery shows each picture in a fixed 280x220 CSS box (scaled 0.9-1.1),
 * so every original is cropped to that box once, here, instead of shipping a
 * full-size picture and letting the browser shrink it:
 *
 *   <slug>-<hash>-280.avif / -560.avif   AVIF, 1x and 2x (every current browser)
 *   <slug>-<hash>-280.jpg  / -560.jpg    mozjpeg JPEG, 1x and 2x (Safari before 16.4)
 *
 * No WebP: at these sizes and settings it came out larger than mozjpeg JPEG
 * (2x set: 501 KB WebP against 449 KB JPEG), so it bought older Safari nothing.
 *
 * The hash is of the output bytes, so a rebuild gets new names and the files
 * can keep the one-year immutable cache that next.config.ts gives /images/*.
 *
 * Usage:
 *   node scripts/build-hero-images.mjs            # originals from img.pathologybites.com/library
 *   node scripts/build-hero-images.mjs <dir>      # originals from a local folder (same file names)
 *
 * Writes public/images/hero/ (cleared first) and
 * src/shared/components/common/hero-gallery-images.ts.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import prettier from "prettier";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_DIR = path.join(ROOT, "public/images/hero");
const DATA_FILE = path.join(ROOT, "src/shared/components/common/hero-gallery-images.ts");
const LIBRARY = "https://img.pathologybites.com/library";

// CSS box the gallery draws each picture in.
const W = 280;
const H = 220;

// The originals, all in the R2 image library. Order is display-pool order only.
const SOURCES = [
  [
    "20251022143356-cervical-cytology-with-adenocarcinoma-in-situ-ais-feathering-high-power",
    "Cervical cytology with adenocarcinoma in situ",
  ],
  ["20251012190948-foveolar-type-adenoma-low-power", "Foveolar type adenoma, low power"],
  [
    "20251022143357-cervical-cytology-with-herpes-changes-multinucleation-margination-and-molding-very-high-power",
    "Cervical cytology with herpes changes",
  ],
  [
    "20251012190947-foveolar-type-adenoma-apical-mucin-cap-high-power",
    "Foveolar type adenoma, high power",
  ],
  [
    "20251015012457-paget-disease-with-secondary-osteosarcoma-low-power",
    "Paget disease with secondary osteosarcoma",
  ],
  ["20251015012431-paget-disease-low-power", "Paget disease, low power"],
  [
    "20251015012432-paget-disease-thickened-trabeculae-osteoblastic-rimming-and-osteoclasts-high-power",
    "Paget disease, high power",
  ],
  [
    "20251011011234-cogenital-mesoblastic-nephroma-fat-infiltration-medium-power",
    "Congenital mesoblastic nephroma",
  ],
  [
    "20251011011235-cogenital-mesoblastic-nephroma-cellular-type-high-power",
    "Congenital mesoblastic nephroma, cellular type",
  ],
  [
    "20251015012456-paget-disease-with-secondary-osteosarcoma-fat-infiltration-low-power",
    "Paget disease with fat infiltration",
  ],
];

const ENCODERS = {
  avif: (img) => img.avif({ quality: 45, effort: 9, chromaSubsampling: "4:2:0" }),
  jpg: (img) => img.jpeg({ quality: 72, mozjpeg: true, progressive: true }),
};
const VARIANTS = [
  ["avif", 1],
  ["avif", 2],
  ["jpg", 1],
  ["jpg", 2],
];

async function loadOriginal(name, localDir) {
  if (localDir) {
    const files = await readdir(localDir);
    const file = files.find((f) => f.startsWith(name + "."));
    if (!file) throw new Error(`no original for ${name} in ${localDir}`);
    return readFile(path.join(localDir, file));
  }
  const res = await fetch(`${LIBRARY}/${name}.png`);
  if (!res.ok) throw new Error(`${res.status} fetching ${name}.png`);
  return Buffer.from(await res.arrayBuffer());
}

function slugOf(name) {
  // Drop the timestamp; keep it short but recognisable.
  return name.replace(/^\d+-/, "").split("-").slice(0, 6).join("-");
}

async function main() {
  const localDir = process.argv[2];
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const slugs = SOURCES.map(([name]) => slugOf(name));
  if (new Set(slugs).size !== slugs.length) throw new Error("two sources share a slug");

  const entries = [];
  let originalBytes = 0;
  let builtBytes = 0;
  for (const [name, alt] of SOURCES) {
    const original = await loadOriginal(name, localDir);
    originalBytes += original.length;
    const slug = slugOf(name);
    const files = {};
    for (const [format, density] of VARIANTS) {
      const pipeline = sharp(original)
        .rotate()
        .resize(W * density, H * density, { fit: "cover", position: "centre" })
        .toColorspace("srgb");
      const buf = await ENCODERS[format](pipeline).toBuffer();
      const hash = createHash("sha256").update(buf).digest("hex").slice(0, 8);
      const file = `${slug}-${hash}-${W * density}.${format}`;
      await writeFile(path.join(OUT_DIR, file), buf);
      files[`${format}${density}x`] = `/images/hero/${file}`;
      builtBytes += buf.length;
      console.log(`${file}\t${buf.length}`);
    }
    entries.push({ id: slug, alt, ...files });
  }

  const body = `// Generated by scripts/build-hero-images.mjs. Do not edit by hand; rerun the script.
export interface HeroGalleryImage {
  id: string;
  alt: string;
  avif1x: string;
  avif2x: string;
  jpg1x: string;
  jpg2x: string;
}

export const HERO_GALLERY_IMAGES: HeroGalleryImage[] = ${JSON.stringify(entries, null, 2)};
`;
  const options = (await prettier.resolveConfig(DATA_FILE)) ?? {};
  await writeFile(DATA_FILE, await prettier.format(body, { ...options, filepath: DATA_FILE }));
  console.log(`originals ${originalBytes} bytes -> built ${builtBytes} bytes (all variants)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
