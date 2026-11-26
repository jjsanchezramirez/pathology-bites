import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/services/server";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";
import { analyzeImages, type ImageInput } from "./vision";
import { writeScript } from "./writer";

// Vision (parallel, one deadline) + the writer: see the lesson-vision and
// lesson-writer budgets in ai-models.ts. Needs Fluid Compute for > 60 s.
export const maxDuration = 120;

const MAX_IMAGES = 8;

const schema = z.object({
  topic: z.string().trim().min(3).max(300),
  notes: z.string().trim().max(6000).optional(),
  minutes: z.number().min(1).max(10).default(3),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().max(500).optional(),
        description: z.string().max(2000).optional(),
        category: z.string().max(40).optional(),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
      })
    )
    .max(MAX_IMAGES)
    .default([]),
  modelOverride: z.string().max(120).optional(),
});

/**
 * @swagger
 * /api/admin/lesson-studio/generate-lesson:
 *   post:
 *     summary: Draft a lesson script with AI
 *     description: |
 *       Writes a narrated lesson in the script format (scenes of the five
 *       templates, one sentence per beat) from a topic, optional notes and up
 *       to 8 library images. Each image goes through vision first, so image
 *       scenes point at real features. The client turns the script into
 *       editable canvas scenes (lessonFromScript), then narrates it as usual.
 *       Requires admin role.
 *     tags:
 *       - Admin - Lesson Studio
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [topic]
 *             properties:
 *               topic: { type: string }
 *               notes: { type: string, description: "Outline or points the lesson must cover" }
 *               minutes: { type: number, default: 3 }
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url: { type: string }
 *                     title: { type: string }
 *     responses:
 *       200:
 *         description: "{ script, warnings, model }"
 *       502:
 *         description: Every model failed to produce a usable script
 */
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(request, schema);
  if (body instanceof NextResponse) return body;

  const started = Date.now();
  try {
    const images = await enrichImageMetadata(
      body.images.map((img) => ({
        url: img.url,
        title: img.title ?? "",
        description: img.description ?? "",
        category: img.category ?? "microscopic",
        magnification: null,
        width: img.width ?? 0,
        height: img.height ?? 0,
      }))
    );
    const vision = images.length ? await analyzeImages(images, body.modelOverride) : [];
    const { script, warnings, model } = await writeScript(
      { topic: body.topic, notes: body.notes, minutes: body.minutes, images, vision },
      body.modelOverride
    );
    log.info(
      `[generate-lesson] ${script.scenes.length} scenes from ${images.length} images in ${Date.now() - started}ms (${model})`
    );
    return NextResponse.json({ script, warnings, model });
  } catch (error) {
    log.error("[generate-lesson] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lesson generation failed" },
      { status: 502 }
    );
  }
}

/** Fill in title, description, category, magnification and size from the images table. */
async function enrichImageMetadata(images: ImageInput[]): Promise<ImageInput[]> {
  if (images.length === 0) return images;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("images")
      .select("url, description, alt_text, category, magnification, width, height")
      .in(
        "url",
        images.map((img) => img.url)
      );
    if (error || !data) {
      log.warn("[generate-lesson] image lookup failed:", error?.message);
      return images;
    }
    const byUrl = new Map(data.map((row) => [row.url, row]));
    return images.map((img) => {
      const db = byUrl.get(img.url);
      if (!db) return img;
      return {
        ...img,
        title: db.description || db.alt_text || img.title,
        description: db.alt_text || db.description || img.description,
        category: db.category || img.category,
        // images.magnification is free text; vision normalises it.
        magnification: (db.magnification as ImageInput["magnification"]) || img.magnification,
        width: db.width || img.width,
        height: db.height || img.height,
      };
    });
  } catch (err) {
    log.warn("[generate-lesson] image lookup error:", err);
    return images;
  }
}
