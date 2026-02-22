import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/shared/config/ai-models";
import type { CaptionChunk } from "@/shared/types/explainer";
import type { ImageInput } from "./prompt";
import { analyzeImages } from "./vision";
import { computeAllCameraKeyframes } from "./camera";
import { segmentByAI } from "./segmenter";
import { assembleSequenceDeterministically } from "./assembler";

// Tell Next.js to allow up to 60 seconds for this route (vision pass + segmentation pass)
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

interface GenerateSequenceRequest {
  images: ImageInput[];
  captions: CaptionChunk[];
  audioDuration: number;
  audioUrl: string;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/admin/lesson-studio/generate-sequence:
 *   post:
 *     summary: Generate a complete lesson sequence from images and audio
 *     description: Generates a complete animated lesson sequence by analyzing pathology images with AI vision, performing intelligent segmentation based on captions, computing camera keyframes, and assembling everything into a synchronized multimedia sequence. This is the core endpoint for the lesson studio. Requires admin or creator role.
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
 *             required:
 *               - images
 *               - captions
 *               - audioDuration
 *               - audioUrl
 *             properties:
 *               images:
 *                 type: array
 *                 minItems: 1
 *                 description: Array of pathology images to include in the sequence
 *                 items:
 *                   type: object
 *                   required:
 *                     - url
 *                     - title
 *                     - description
 *                     - category
 *                     - width
 *                     - height
 *                   properties:
 *                     url:
 *                       type: string
 *                       format: uri
 *                       description: URL of the image
 *                     title:
 *                       type: string
 *                       description: Title of the image
 *                     description:
 *                       type: string
 *                       description: Description of the image content
 *                     category:
 *                       type: string
 *                       enum: [microscopic, gross, figure, table]
 *                       description: Category of the pathology image
 *                     magnification:
 *                       type: string
 *                       enum: [low, medium, high, very_high]
 *                       nullable: true
 *                       description: Microscopic magnification level (guides annotation strategy)
 *                     width:
 *                       type: integer
 *                       description: Image width in pixels
 *                     height:
 *                       type: integer
 *                       description: Image height in pixels
 *               captions:
 *                 type: array
 *                 minItems: 1
 *                 description: Timed transcript chunks that sync with the audio narration
 *                 items:
 *                   type: object
 *                   required:
 *                     - text
 *                     - start
 *                     - end
 *                   properties:
 *                     text:
 *                       type: string
 *                       description: Subtitle text content
 *                     start:
 *                       type: number
 *                       format: float
 *                       description: Start time in seconds from sequence start
 *                     end:
 *                       type: number
 *                       format: float
 *                       description: End time in seconds from sequence start
 *               audioDuration:
 *                 type: number
 *                 format: float
 *                 minimum: 0.1
 *                 description: Total duration of the audio track in seconds
 *               audioUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL of the audio narration track
 *     responses:
 *       200:
 *         description: Sequence generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 sequence:
 *                   type: object
 *                   description: Complete explainer sequence with segments, captions, and timing
 *                   properties:
 *                     version:
 *                       type: integer
 *                       example: 1
 *                     duration:
 *                       type: number
 *                       format: float
 *                       description: Total sequence duration in seconds
 *                     aspectRatio:
 *                       type: string
 *                       enum: [16:9, 16:10, 4:3]
 *                     segments:
 *                       type: array
 *                       description: Array of animated segments with camera movements
 *                       items:
 *                         type: object
 *                     audioUrl:
 *                       type: string
 *                       format: uri
 *                     captions:
 *                       type: array
 *                       items:
 *                         type: object
 *                 debug:
 *                   type: object
 *                   description: Debug information including vision analysis results, timing data, and camera keyframes
 *                   properties:
 *                     visionResults:
 *                       type: array
 *                       description: AI vision analysis results for each image
 *                     timings:
 *                       type: array
 *                       description: AI-generated segment timing assignments
 *                     cameraKeyframes:
 *                       type: object
 *                       description: Computed camera movement keyframes for each image
 *       400:
 *         description: Bad request - missing required fields, empty arrays, or invalid values
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - admin or creator access required
 *       500:
 *         description: Internal server error - API key not configured or sequence generation failed
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check — admin only (lesson studio is admin-only)
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden — admin/creator access required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    const body: GenerateSequenceRequest = await request.json();
    const { images, captions, audioDuration, audioUrl } = body;

    // Validate inputs
    if (!images || images.length === 0) {
      return NextResponse.json({ error: "At least one image is required" }, { status: 400 });
    }
    if (!captions || captions.length === 0) {
      return NextResponse.json(
        { error: "Captions (timed transcript) are required for sequence generation" },
        { status: 400 }
      );
    }
    if (!audioDuration || audioDuration <= 0) {
      return NextResponse.json({ error: "Valid audioDuration is required" }, { status: 400 });
    }
    if (!audioUrl) {
      return NextResponse.json({ error: "audioUrl is required" }, { status: 400 });
    }

    // Get API key
    const apiKey = getApiKey("llama");
    if (!apiKey) {
      return NextResponse.json({ error: "Llama API key not configured" }, { status: 500 });
    }

    const startTime = Date.now();

    // ---------------------------------------------------------------------------
    // Log input images with magnification data
    // ---------------------------------------------------------------------------
    console.log("[generate-sequence] Input images:");
    images.forEach((img, i) => {
      console.log(`  [${i}] ${img.title}`);
      console.log(`      category: ${img.category}, magnification: ${img.magnification ?? "null"}`);
      console.log(`      url: ${img.url.slice(-60)}`);
    });

    // ---------------------------------------------------------------------------
    // AI pass: Vision analysis + AI segmentation — run in parallel
    // Both are best-effort; failures fall back gracefully.
    // ---------------------------------------------------------------------------
    console.log(
      `[generate-sequence] AI pass — vision analysis + segmentation for ${images.length} images`
    );
    const [visionResults, segmentTimings] = await Promise.all([
      analyzeImages(images, apiKey),
      segmentByAI(images, captions, audioDuration, apiKey),
    ]);

    const aiElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[generate-sequence] AI pass complete in ${aiElapsed}s`);

    // ---------------------------------------------------------------------------
    // Deterministic assembly: build sequence from vision + timing data
    // ---------------------------------------------------------------------------
    const cameraKeyframes = computeAllCameraKeyframes(images, visionResults);

    console.log(
      `[generate-sequence] Deterministic assembly for ${images.length} images, ${audioDuration.toFixed(1)}s audio`
    );

    const sequence = assembleSequenceDeterministically(
      images,
      captions,
      audioDuration,
      audioUrl,
      visionResults,
      segmentTimings,
      cameraKeyframes
    );

    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[generate-sequence] Complete in ${totalElapsed}s`);

    return NextResponse.json({
      success: true,
      sequence,
      debug: {
        visionResults,
        timings: segmentTimings,
        cameraKeyframes,
      },
    });
  } catch (error) {
    console.error("[generate-sequence] Unexpected error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error during sequence generation",
      },
      { status: 500 }
    );
  }
}
