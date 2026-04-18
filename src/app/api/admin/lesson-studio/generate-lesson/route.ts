import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import type { ImageInput } from "../generate-sequence/prompt";
import type { GenerateLessonRequest } from "./types";
import { analyzeTranscript } from "./transcript-analysis";
import { analyzeImagesV2 } from "./vision-v2";
import { planLesson } from "./planner";
import { assembleLesson } from "./assembler-v2";

// Allow up to 2 minutes for the full pipeline
export const maxDuration = 120;

/**
 * @swagger
 * /api/admin/lesson-studio/generate-lesson:
 *   post:
 *     summary: Generate a complete lesson from images and audio using AI
 *     description: |
 *       Multi-pass AI pipeline that generates a complete Lesson object in native editor format.
 *       Pass 1-2 run in parallel: transcript analysis + image vision analysis.
 *       Pass 3: AI lesson planning (slide ordering + text slides only).
 *       Pass 4: Deterministic assembly (durations, annotations, camera — all computed, not AI).
 *       Uses Claude Sonnet 4 with fallback to Llama and Gemini.
 *     tags:
 *       - Admin - Lesson Studio
 *     security:
 *       - BearerAuth: []
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden — admin/creator access required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    const body: GenerateLessonRequest = await request.json();
    const { images, svgs, transcript, audioDuration, audioUrl, audioTitle } = body;

    // Validate inputs
    if (!images || images.length === 0) {
      return NextResponse.json({ error: "At least one image is required" }, { status: 400 });
    }
    if (!transcript || !transcript.trim()) {
      return NextResponse.json(
        { error: "Transcript is required for lesson generation" },
        { status: 400 }
      );
    }
    if (!audioDuration || audioDuration <= 0) {
      return NextResponse.json({ error: "Valid audioDuration is required" }, { status: 400 });
    }
    if (!audioUrl) {
      return NextResponse.json({ error: "audioUrl is required" }, { status: 400 });
    }

    const startTime = Date.now();
    console.log(
      `[generate-lesson] Starting pipeline for ${images.length} images, ${audioDuration.toFixed(1)}s audio`
    );

    // -----------------------------------------------------------------------
    // Pass 0: Enrich image metadata from DB
    // -----------------------------------------------------------------------
    const enrichedImages = await enrichImageMetadata(images);
    console.log(
      `[generate-lesson] Enriched ${enrichedImages.filter((img) => img.title).length}/${images.length} images with DB metadata`
    );

    const userSvgs = svgs ?? [];
    console.log(`[generate-lesson] User provided ${userSvgs.length} SVGs`);

    // -----------------------------------------------------------------------
    // Passes 1-2: run in parallel (transcript analysis + vision)
    // -----------------------------------------------------------------------
    const [transcriptAnalysis, visionResults] = await Promise.all([
      analyzeTranscript(transcript, enrichedImages, audioDuration),
      analyzeImagesV2(enrichedImages),
    ]);

    const parallelElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[generate-lesson] Passes 1-2 complete in ${parallelElapsed}s`);
    console.log(
      `[generate-lesson] Transcript: ${transcriptAnalysis.segments.length} segments, title="${transcriptAnalysis.episodeTitle}"`
    );
    console.log(
      `[generate-lesson] Vision: ${visionResults.filter((r) => r.canSeeImage).length}/${images.length} analysed`
    );
    visionResults.forEach((v, i) => {
      console.log(
        `  [${i}] tool=${v.annotationTool}, pos=${v.featurePosition ? `${v.featurePosition.x},${v.featurePosition.y}` : "none"}, label="${v.suggestedLabel}"`
      );
    });

    // -----------------------------------------------------------------------
    // Pass 3: Lesson planning (ordering + text slides + SVG placement)
    // -----------------------------------------------------------------------
    const plan = await planLesson(transcriptAnalysis, enrichedImages, audioDuration, userSvgs);

    const planElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[generate-lesson] Plan complete in ${planElapsed}s — order=[${plan.imageOrder}], ${plan.textSlides.length} text slides, ${plan.svgPlacements.length} SVG placements`
    );

    // -----------------------------------------------------------------------
    // Pass 4: Deterministic assembly
    // -----------------------------------------------------------------------
    const lesson = assembleLesson(
      plan,
      enrichedImages,
      visionResults,
      transcriptAnalysis,
      userSvgs,
      audioUrl,
      audioTitle,
      audioDuration,
      transcript
    );

    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[generate-lesson] Complete in ${totalElapsed}s — ${lesson.slides.length} slides, ${lesson.slides.reduce((n, s) => n + s.elements.length, 0)} elements`
    );

    return NextResponse.json({
      success: true,
      lesson,
      debug: {
        transcriptAnalysis,
        visionResults,
        plan,
        elapsed: totalElapsed,
      },
    });
  } catch (error) {
    console.error("[generate-lesson] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error during lesson generation" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Enrich image metadata from the images table
// ---------------------------------------------------------------------------

async function enrichImageMetadata(images: ImageInput[]): Promise<ImageInput[]> {
  if (images.length === 0) return images;

  try {
    const supabase = await createClient();
    const urls = images.map((img) => img.url);

    const { data, error } = await supabase
      .from("images")
      .select("url, description, alt_text, category, magnification, width, height")
      .in("url", urls);

    if (error || !data) {
      console.warn("[enrich] DB lookup failed:", error?.message);
      return images;
    }

    const byUrl = new Map<string, (typeof data)[number]>();
    for (const row of data) {
      byUrl.set(row.url, row);
    }

    return images.map((img) => {
      const db = byUrl.get(img.url);
      if (!db) return img;
      return {
        ...img,
        title: db.description || db.alt_text || img.title,
        description: db.alt_text || db.description || img.description,
        category: db.category || img.category,
        magnification: db.magnification || img.magnification,
        width: db.width || img.width,
        height: db.height || img.height,
      };
    });
  } catch (err) {
    console.warn("[enrich] Unexpected error:", err);
    return images;
  }
}
