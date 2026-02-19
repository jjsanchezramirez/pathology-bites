import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/shared/config/ai-models";
import { parseSegmenterResponse, indicesToTimings } from "../generate-sequence/segmenter";
import type { ImageInput } from "../generate-sequence/prompt";
import type { CaptionChunk } from "@/shared/types/explainer";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { images, captions, audioDuration } = (await request.json()) as {
      images: ImageInput[];
      captions: CaptionChunk[];
      audioDuration: number;
    };

    if (!images?.length) {
      return NextResponse.json({ error: "images required" }, { status: 400 });
    }
    if (!captions?.length) {
      return NextResponse.json({ error: "captions required" }, { status: 400 });
    }

    const apiKey = getApiKey("llama");
    if (!apiKey) {
      return NextResponse.json({ error: "Llama API key not configured" }, { status: 500 });
    }

    // Build the prompt the same way the real segmenter does, then make the call
    // and return both the raw model response and the parsed result.

    // Re-build the prompt for display (mirrors segmenter.ts internals)
    const imageList = images
      .map(
        (img, i) =>
          `[${i}] ${img.title}${img.description ? ` — ${img.description}` : ""} (${img.category ?? "unknown"})`
      )
      .join("\n");

    const captionList = captions
      .map((c, i) => `[${i}] ${c.start.toFixed(2)}s–${c.end.toFixed(2)}s: "${c.text}"`)
      .join("\n");

    const userPrompt = `You are given a list of pathology images and a timed caption transcript.
Your task: identify the caption index at which the narration FIRST begins discussing each image.

## Images (${images.length} total)
${imageList}

## Caption chunks (${captions.length} total, 0-indexed)
${captionList}

## Rules
- Image 0 always starts at caption index 0.
- For each subsequent image (1, 2, …), find the caption index where the speaker FIRST shifts to discussing that image.
- Choose the earliest caption where the narration mentions content clearly matching that image's title or description.
- If unsure, prefer later rather than earlier (give the previous image more time).
- Each image must get at least one caption chunk.

## Output
Respond with ONLY a JSON array of ${images.length} integers (one per image, in order).
Example for 3 images: [0, 4, 11]
No explanation, no prose — just the JSON array.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let rawModelResponse = "";
    let apiError: string | null = null;

    try {
      const response = await fetch("https://api.llama.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "Llama-4-Scout-17B-16E-Instruct-FP8",
          messages: [
            {
              role: "system",
              content:
                "You are a precise transcript analyser. Return only the JSON array requested — no explanation.",
            },
            { role: "user", content: userPrompt },
          ],
          max_completion_tokens: 200,
          temperature: 0.1,
        }),
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        apiError = `API error ${response.status}: ${text.slice(0, 200)}`;
      } else {
        const data = await response.json();
        rawModelResponse =
          data.completion_message?.content?.text ?? data.choices?.[0]?.message?.content ?? "";
      }
    } catch (err) {
      clearTimeout(timeoutId);
      apiError = err instanceof Error ? err.message : String(err);
    }

    // Parse the response
    const parsedIndices = apiError
      ? null
      : parseSegmenterResponse(rawModelResponse, images.length, captions.length);

    const timings = parsedIndices ? indicesToTimings(parsedIndices, captions, audioDuration) : null;

    return NextResponse.json({
      success: true,
      prompt: userPrompt,
      rawModelResponse,
      apiError,
      parsedIndices,
      timings,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
