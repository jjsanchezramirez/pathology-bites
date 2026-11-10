import { DEMO_QUESTION_AVIF_OPTIMIZED } from "@/shared/config/demo-question-avif-manifest";
import { DEMO_QUESTION_RESIZED } from "@/shared/config/demo-question-resized-manifest";
import { R2_IMAGES_HOSTS } from "@/shared/config/r2-public-urls";

export interface DemoImageUrls {
  /** What the carousel renders inline. */
  url: string;
  /** Full-resolution original, set only when `url` lost resolution. */
  fullUrl?: string;
}

/**
 * If the image lives in our R2 `library/` bucket and we've pre-uploaded a
 * smaller sibling under `library/demo-optimized/`, swap the URL so the demo
 * question ships the smaller file. Falls through for any URL we don't
 * recognise — the demo questions API serves arbitrary user-uploaded images and
 * we shouldn't rewrite anything we don't have a manifest entry for.
 *
 * Two manifests, checked in order:
 *  - DEMO_QUESTION_RESIZED — a downscaled JPEG. Because resolution is lost, the
 *    untouched original comes back as `fullUrl` so the carousel's fullscreen
 *    view keeps full diagnostic detail.
 *  - DEMO_QUESTION_AVIF_OPTIMIZED — a same-resolution AVIF, so no `fullUrl` is
 *    needed; nothing is lost by using it everywhere.
 */
export function optimizeDemoImageUrl(url: string): DemoImageUrls {
  if (!url) return { url };
  try {
    const parsed = new URL(url);
    if (!R2_IMAGES_HOSTS.has(parsed.host)) return { url };
    const key = parsed.pathname.replace(/^\/+/, "");

    const resizedKey = DEMO_QUESTION_RESIZED.get(key);
    if (resizedKey) return { url: `${parsed.origin}/${resizedKey}`, fullUrl: url };

    if (DEMO_QUESTION_AVIF_OPTIMIZED.has(key)) {
      const filename = key.replace(/^library\//, "");
      return { url: `${parsed.origin}/library/demo-optimized/${filename}.avif` };
    }

    return { url };
  } catch {
    return { url };
  }
}
