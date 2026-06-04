import { NextRequest, NextResponse } from "next/server";

import { listRelatedSlides } from "@/shared/utils/domain/wsi-tilesource";

// MGH: list a case's related slides (H&E / special stains / levels) with thumbnails, for the
// viewer's related-slides panel. Other repos return []. Server-side (cross-origin /list fetch).
/**
 * @swagger
 * /api/public/tools/virtual-slides/wsi-related:
 *   get:
 *     summary: List related WSI slides for a case
 *     description: >
 *       For MGH slides, lists the case's related slides (H&E, special stains, levels) with
 *       thumbnails for the viewer's related-slides panel. Other repositories return an empty list.
 *       Fetched server-side to bypass cross-origin restrictions.
 *     tags:
 *       - Public - Tools
 *     parameters:
 *       - in: query
 *         name: slideUrl
 *         required: true
 *         description: The source slide URL whose related slides to list.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Related slides (empty array if slideUrl missing, unsupported repo, or on fetch error).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slides:
 *                   type: array
 *                   items:
 *                     type: object
 */
export async function GET(req: NextRequest) {
  const slideUrl = req.nextUrl.searchParams.get("slideUrl");
  if (!slideUrl) return NextResponse.json({ slides: [] });
  const slides = await listRelatedSlides(slideUrl).catch(() => []);
  return NextResponse.json({ slides });
}
