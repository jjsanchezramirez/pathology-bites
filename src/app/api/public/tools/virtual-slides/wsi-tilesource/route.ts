import { NextRequest, NextResponse } from "next/server";

import { resolveTileSource } from "@/shared/utils/domain/wsi-tilesource";

// Resolve a repo slide_url into a self-hostable OSD tile-source descriptor. Server-side so
// cross-origin manifests (CORS-blocked in the browser) can be read. Powers the in-house viewer.
export async function GET(req: NextRequest) {
  const slideUrl = req.nextUrl.searchParams.get("slideUrl");
  const repository = req.nextUrl.searchParams.get("repository") ?? undefined;
  const slide = req.nextUrl.searchParams.get("slide") ?? undefined; // MGH related-slide pick
  if (!slideUrl) {
    return NextResponse.json({ kind: "unsupported", reason: "missing slideUrl" }, { status: 400 });
  }
  const result = await resolveTileSource(slideUrl, repository, slide);
  return NextResponse.json(result);
}
