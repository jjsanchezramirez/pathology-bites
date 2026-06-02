import { NextRequest, NextResponse } from "next/server";

import { listRelatedSlides } from "@/shared/utils/domain/wsi-tilesource";

// MGH: list a case's related slides (H&E / special stains / levels) with thumbnails, for the
// viewer's related-slides panel. Other repos return []. Server-side (cross-origin /list fetch).
export async function GET(req: NextRequest) {
  const slideUrl = req.nextUrl.searchParams.get("slideUrl");
  if (!slideUrl) return NextResponse.json({ slides: [] });
  const slides = await listRelatedSlides(slideUrl).catch(() => []);
  return NextResponse.json({ slides });
}
