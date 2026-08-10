"use client";

/**
 * Saving results to disk. Everything is assembled from Blobs already in memory
 * — no request ever leaves the tab.
 */

import type { ConvertedPage } from "./converter-types";

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Safari needs the URL to outlive the click handler.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Appends " (2)", " (3)"… so a batch can't silently drop same-named outputs. */
function uniqueNamer() {
  const seen = new Set<string>();
  return (name: string): string => {
    if (!seen.has(name)) {
      seen.add(name);
      return name;
    }
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let counter = 2;
    let candidate = `${base} (${counter})${ext}`;
    while (seen.has(candidate)) {
      counter += 1;
      candidate = `${base} (${counter})${ext}`;
    }
    seen.add(candidate);
    return candidate;
  };
}

/**
 * Streams the outputs into a stored (uncompressed) ZIP. Stored rather than
 * deflated because PNG/JPEG/WebP/AVIF payloads are already compressed, and
 * streaming keeps peak memory to one file rather than the whole batch.
 */
export async function zipPages(pages: ConvertedPage[]): Promise<Blob> {
  const { Zip, ZipPassThrough } = await import("fflate");
  const chunks: Uint8Array[] = [];
  const nameFor = uniqueNamer();

  let zip!: InstanceType<typeof Zip>;
  const finished = new Promise<void>((resolve, reject) => {
    zip = new Zip((err, chunk, final) => {
      if (err) {
        reject(err);
        return;
      }
      if (chunk) chunks.push(chunk);
      if (final) resolve();
    });
  });

  for (const page of pages) {
    const entry = new ZipPassThrough(nameFor(page.name));
    zip.add(entry);
    entry.push(new Uint8Array(await page.blob.arrayBuffer()), true);
  }
  zip.end();
  await finished;

  return new Blob(chunks as BlobPart[], { type: "application/zip" });
}
