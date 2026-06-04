import { NextRequest, NextResponse } from "next/server";

import { resolveTileSource } from "@/shared/utils/domain/wsi-tilesource";

// Resolve a repo slide_url into a self-hostable OSD tile-source descriptor. Server-side so
// cross-origin manifests (CORS-blocked in the browser) can be read. Powers the in-house viewer.
/**
 * @swagger
 * /api/public/tools/virtual-slides/wsi-tilesource:
 *   get:
 *     summary: Resolve a slide URL into an OSD tile-source descriptor
 *     description: >
 *       Resolves a repository slide URL into an OpenSeadragon tile-source descriptor for the
 *       in-house viewer. Runs server-side so cross-origin slide manifests (CORS-blocked in the
 *       browser) can be read.
 *     tags:
 *       - Public - Tools
 *     parameters:
 *       - in: query
 *         name: slideUrl
 *         required: true
 *         description: The repository slide URL to resolve.
 *         schema:
 *           type: string
 *       - in: query
 *         name: repository
 *         required: false
 *         description: Repository hint used to select the resolver.
 *         schema:
 *           type: string
 *       - in: query
 *         name: slide
 *         required: false
 *         description: Specific related-slide selection (MGH related-slide pick).
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A tile-source descriptor (kind plus resolver-specific fields).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing slideUrl (returns kind "unsupported").
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 kind:
 *                   type: string
 *                 reason:
 *                   type: string
 */
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
