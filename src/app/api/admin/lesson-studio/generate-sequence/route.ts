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
