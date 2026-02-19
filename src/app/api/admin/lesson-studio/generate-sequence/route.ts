import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/shared/config/ai-models";
import type { ExplainerSequence, CaptionChunk } from "@/shared/types/explainer";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { ImageInput } from "./prompt";
import { analyzeImages } from "./vision";
import { computeAllCameraKeyframes } from "./camera";
import { segmentByAI } from "./segmenter";
import { assembleSequenceDeterministically } from "./assembler";

// Tell Next.js to allow up to 150 seconds for this route (vision pass + assembly pass)
export const maxDuration = 150;

// 10-second buffer reserved for Next.js overhead + JSON parsing
const NEXT_OVERHEAD_S = 10;

// ---------------------------------------------------------------------------
// Meta Llama API call — dynamic timeout, single attempt
// ---------------------------------------------------------------------------

async function callMetaAPI(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  timeoutMs: number
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch("https://api.llama.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "Llama-4-Scout-17B-16E-Instruct-FP8",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: 6000,
        temperature: 0.3,
      }),
    });
    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Meta Llama API timeout after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Meta Llama API error: ${response.status} ${response.statusText}`;
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error?.message) errorMessage = errorData.error.message;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();

  let content = "";
  if (data.completion_message?.content?.text) {
    content = data.completion_message.content.text;
  } else if (data.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content;
  }

  return content;
}

// ---------------------------------------------------------------------------
// Assembly with retry — tries once, retries with remaining budget on failure
// ---------------------------------------------------------------------------

async function callAssemblyWithRetry(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  startTime: number
): Promise<string> {
  const budgetMs = (maxDuration - NEXT_OVERHEAD_S) * 1000;

  const elapsed = () => Date.now() - startTime;
  const remainingMs = () => Math.max(0, budgetMs - elapsed());

  // First attempt — use the full remaining budget
  const firstTimeout = Math.max(30_000, remainingMs());
  console.log(
    `[generate-sequence] Assembly attempt 1 — timeout ${Math.round(firstTimeout / 1000)}s`
  );

  try {
    return await callMetaAPI(systemPrompt, userPrompt, apiKey, firstTimeout);
  } catch (firstErr) {
    const retryBudget = remainingMs() - 5_000; // 5s buffer before giving up
    if (retryBudget < 10_000) {
      // Not enough time to retry meaningfully
      throw firstErr;
    }

    console.warn(
      `[generate-sequence] Assembly attempt 1 failed (${firstErr instanceof Error ? firstErr.message : firstErr}) — retrying with ${Math.round(retryBudget / 1000)}s`
    );

    return await callMetaAPI(systemPrompt, userPrompt, apiKey, retryBudget);
  }
}

// ---------------------------------------------------------------------------
// JSON extraction (same multi-strategy approach as ai-generate route)
// ---------------------------------------------------------------------------

function sanitizeJSONString(jsonStr: string): string {
  return jsonStr
    .replace(/(?<!\\)\n/g, "\\n")
    .replace(/(?<!\\)\t/g, "\\t")
    .replace(/(?<!\\)\r/g, "\\r")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\\"/g, "___ESCAPED_QUOTE___")
    .replace(/"/g, '\\"')
    .replace(/___ESCAPED_QUOTE___/g, '\\"');
}

function extractJSON(text: string): unknown {
  // Strategy 1: Smart brace counting
  const firstBrace = text.indexOf("{");
  if (firstBrace !== -1) {
    let braceCount = 0;
    let i = firstBrace;
    let inString = false;
    let escapeNext = false;

    while (i < text.length) {
      const char = text[i];
      if (escapeNext) {
        escapeNext = false;
      } else if (char === "\\" && inString) {
        escapeNext = true;
      } else if (char === '"' && !escapeNext) {
        inString = !inString;
      } else if (!inString) {
        if (char === "{") braceCount++;
        else if (char === "}") {
          braceCount--;
          if (braceCount === 0) {
            const jsonStr = text.substring(firstBrace, i + 1);
            try {
              return JSON.parse(sanitizeJSONString(jsonStr));
            } catch {
              try {
                return JSON.parse(jsonStr);
              } catch {
                break;
              }
            }
          }
        }
      }
      i++;
    }
  }

  // Strategy 2: Code block
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(sanitizeJSONString(codeBlockMatch[1]));
    } catch {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch {
        // fall through
      }
    }
  }

  // Strategy 3: Greedy match
  const greedyMatch = text.match(/\{[\s\S]*\}/);
  if (greedyMatch) {
    try {
      return JSON.parse(sanitizeJSONString(greedyMatch[0]));
    } catch {
      try {
        return JSON.parse(greedyMatch[0]);
      } catch {
        const fixedJson = greedyMatch[0]
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
          .replace(/:\s*'([^']*)'/g, ': "$1"')
          .replace(/,(\s*[}\]])/g, "$1")
          .trim();
        try {
          return JSON.parse(sanitizeJSONString(fixedJson));
        } catch {
          return JSON.parse(fixedJson);
        }
      }
    }
  }

  throw new Error(
    "No JSON found in AI response. The model may have returned plain text instead of JSON."
  );
}

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

    // Record start time for dynamic timeout budgeting
    const startTime = Date.now();

    // ---------------------------------------------------------------------------
    // Pass 1: Vision analysis + AI segmentation — run in parallel
    // Both are best-effort; failures fall back gracefully.
    // ---------------------------------------------------------------------------
    console.log(
      `[generate-sequence] Pass 1 — vision analysis + AI segmentation for ${images.length} images`
    );
    const [visionResults, segmentTimings] = await Promise.all([
      analyzeImages(images, apiKey),
      segmentByAI(images, captions, audioDuration, apiKey),
    ]);

    const pass1Elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[generate-sequence] Pass 1 complete in ${pass1Elapsed}s`);

    // Pre-compute camera keyframes (for assembly prompt + debug panel)
    const cameraKeyframes = computeAllCameraKeyframes(images, visionResults);

    // ---------------------------------------------------------------------------
    // Pass 2: Assembly — with dynamic timeout + retry + deterministic fallback
    // ---------------------------------------------------------------------------
    const userPrompt = buildUserPrompt(
      images,
      captions,
      audioDuration,
      audioUrl,
      visionResults,
      segmentTimings
    );

    console.log(
      `[generate-sequence] Pass 2 — sequence assembly for ${images.length} images, ${audioDuration.toFixed(1)}s audio`
    );

    let sequence: ExplainerSequence;
    let degraded = false;

    try {
      const rawContent = await callAssemblyWithRetry(SYSTEM_PROMPT, userPrompt, apiKey, startTime);

      if (!rawContent) throw new Error("AI model returned empty response");

      const parsed = extractJSON(rawContent) as ExplainerSequence;
      if (!parsed.segments || !Array.isArray(parsed.segments)) {
        throw new Error("AI returned invalid sequence structure (missing segments array)");
      }

      // Normalise captions: model sometimes returns arrays [text, start, end] instead of objects
      if (parsed.captions && Array.isArray(parsed.captions)) {
        parsed.captions = parsed.captions.map((c: unknown) => {
          if (Array.isArray(c)) {
            return { text: String(c[0] ?? ""), start: Number(c[1] ?? 0), end: Number(c[2] ?? 0) };
          }
          return c as CaptionChunk;
        });
      }

      sequence = parsed;
    } catch (assemblyError) {
      // Assembly failed (timeout, parse error, invalid JSON) — use deterministic fallback
      console.warn(
        `[generate-sequence] Assembly failed — using deterministic fallback. Reason: ${assemblyError instanceof Error ? assemblyError.message : assemblyError}`
      );
      sequence = assembleSequenceDeterministically(
        images,
        captions,
        audioDuration,
        audioUrl,
        visionResults,
        segmentTimings,
        cameraKeyframes
      );
      degraded = true;
    }

    return NextResponse.json({
      success: true,
      sequence,
      degraded,
      debug: {
        visionResults,
        timings: segmentTimings,
        cameraKeyframes,
        userPrompt,
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
