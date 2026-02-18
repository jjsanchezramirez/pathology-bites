import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/shared/config/ai-models";
import type { ExplainerSequence, CaptionChunk } from "@/shared/types/explainer";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { ImageInput } from "./prompt";
import { analyzeImages } from "./vision";

// Tell Next.js to allow up to 150 seconds for this route (vision pass + assembly pass)
export const maxDuration = 150;

// ---------------------------------------------------------------------------
// Meta Llama API call
// ---------------------------------------------------------------------------

async function callMetaAPI(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<string> {
  const controller = new AbortController();
  // Sequence generation is complex — allow 110s (under Next.js maxDuration of 120s)
  const timeoutId = setTimeout(() => controller.abort(), 110000);

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
        // Llama 4 Scout: 10M context, faster inference than Maverick
        model: "Llama-4-Scout-17B-16E-Instruct-FP8",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: 6000,
        temperature: 0.3, // Lower = more consistent JSON structure
      }),
    });
    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Meta Llama API timeout after 110 seconds");
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

  // Handle both response formats (Meta API has changed formats across versions)
  let content = "";
  if (data.completion_message?.content?.text) {
    content = data.completion_message.content.text;
  } else if (data.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content;
  }

  return content;
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

    // ---------------------------------------------------------------------------
    // Pass 1: Vision — analyse each image in parallel to get feature positions
    // This is non-blocking on failure; vision results are best-effort.
    // ---------------------------------------------------------------------------
    console.log(`[generate-sequence] Pass 1 — vision analysis for ${images.length} images`);
    const visionResults = await analyzeImages(images, apiKey);

    // ---------------------------------------------------------------------------
    // Pass 2: Build prompts (enriched with vision data) and call assembly model
    // ---------------------------------------------------------------------------
    const userPrompt = buildUserPrompt(images, captions, audioDuration, audioUrl, visionResults);

    console.log(
      `[generate-sequence] Pass 2 — sequence assembly for ${images.length} images, ${audioDuration.toFixed(1)}s audio`
    );

    // Call Meta Llama API
    const rawContent = await callMetaAPI(SYSTEM_PROMPT, userPrompt, apiKey);

    if (!rawContent) {
      return NextResponse.json({ error: "AI model returned empty response" }, { status: 500 });
    }

    // Parse the returned JSON
    let sequence: ExplainerSequence;
    try {
      sequence = extractJSON(rawContent) as ExplainerSequence;
    } catch (parseError) {
      console.error("[generate-sequence] JSON parse failed:", parseError);
      return NextResponse.json(
        {
          error: `Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : "Parse error"}`,
        },
        { status: 500 }
      );
    }

    // Basic validation — ensure the result looks like a sequence
    if (!sequence.segments || !Array.isArray(sequence.segments)) {
      return NextResponse.json(
        { error: "AI returned invalid sequence structure (missing segments array)" },
        { status: 500 }
      );
    }

    // Normalise captions: model sometimes returns arrays [text, start, end] instead of objects
    if (sequence.captions && Array.isArray(sequence.captions)) {
      sequence.captions = sequence.captions.map((c: unknown) => {
        if (Array.isArray(c)) {
          return { text: String(c[0] ?? ""), start: Number(c[1] ?? 0), end: Number(c[2] ?? 0) };
        }
        return c as CaptionChunk;
      });
    }

    return NextResponse.json({ success: true, sequence });
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
