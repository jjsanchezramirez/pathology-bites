import { DEMO_QUESTION_AVIF_OPTIMIZED } from "@/shared/config/demo-question-avif-manifest";
import { DEMO_QUESTION_RESIZED } from "@/shared/config/demo-question-resized-manifest";

const R2_PUBLIC_HOST = "pub-a4bec7073d99465f99043c842be6318c.r2.dev";

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
    if (parsed.host !== R2_PUBLIC_HOST) return { url };
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
