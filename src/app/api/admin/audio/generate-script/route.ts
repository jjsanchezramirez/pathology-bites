import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";
import { getApiKey, getModelProvider, ACTIVE_AI_MODELS } from "@/shared/config/ai-models";

const AVAILABLE_AI_MODELS = ACTIVE_AI_MODELS.filter((model) => model.available).map(
  (model) => model.id
);

interface EducationalContent {
  category: string;
  subject: string;
  lesson: string;
  topic: string;
  content: unknown;
}

interface TextGenerationRequest {
  content: EducationalContent;
  additionalInstructions?: string;
  model?: string;
}

async function callAIService(
  provider: string,
  prompt: string,
  modelId: string,
  apiKey: string
): Promise<{ content: string }> {
  switch (provider) {
    case "llama":
      return await callMetaAPI(prompt, modelId, apiKey);
    case "google":
      return await callGoogleAPI(prompt, modelId, apiKey);
    case "mistral":
      return await callMistralAPI(prompt, modelId, apiKey);
    default:
      throw new Error(`Unsupported model provider: ${provider}`);
  }
}

async function callMetaAPI(
  prompt: string,
  model: string,
  apiKey: string
): Promise<{ content: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

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
        model: model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert medical educator creating concise, engaging educational audio scripts for students. Your scripts should be clear, accurate, and suitable for text-to-speech conversion.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_completion_tokens: 500,
        temperature: 0.7,
      }),
    });
    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Meta LLAMA API timeout after 20 seconds");
    }
    throw error;
  }

  if (!response.ok) {
    await response.text(); // Consume response body
    throw new Error(`Meta LLAMA API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  let content = "";
  if (data.completion_message?.content?.text) {
    content = data.completion_message.content.text;
  } else if (data.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content;
  }

  return { content: content || "" };
}

async function callGoogleAPI(
  prompt: string,
  model: string,
  apiKey: string
): Promise<{ content: string }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
  };
}

async function callMistralAPI(
  prompt: string,
  model: string,
  apiKey: string
): Promise<{ content: string }> {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content:
            "You are an expert medical educator creating concise, engaging educational audio scripts for students. Your scripts should be clear, accurate, and suitable for text-to-speech conversion.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || "",
  };
}

function buildTTSPrompt(
  content: EducationalContent,
  additionalInstructions: string
): string {
  return `Topic: ${content.topic}

Task: Write a script for an audio segment covering the following:

1. Definition and classification of the entity or spectrum
2. Key morphologic features distinguishing each entity
3. Relevant molecular or immunohistochemical profile
4. Related entities and where this fits within a broader pathologic pathway or continuum

Educational Context:
Category: ${content.category}
Subject: ${content.subject}
Lesson: ${content.lesson}

${additionalInstructions ? `Additional Instructions:\n${additionalInstructions}\n\n` : ""}Constraints:

1. NO hyphens (text will be read aloud - use "to" instead of ranges like "5 to 10" not "5-10")
2. Use precise pathology terminology but keep sentence structure flowing for narration
3. Avoid vague clinical advice like "warrants follow up"; anchor concepts instead
4. Target length: 150 to 180 words (approximately 1 minute when spoken)
5. Write in flowing paragraphs - NO bullet points, lists, or special formatting
6. Follow the four-beat framework: what is it → what does it look like → what drives it molecularly → where does it sit in the bigger picture

Return ONLY the script text with no additional commentary, metadata, titles, or formatting. The text should be ready for direct text-to-speech conversion.`;
}

/**
 * @swagger
 * /api/admin/audio/generate-script:
 *   post:
 *     summary: Generate audio script using AI
 *     description: Generate an educational audio script using AI based on educational content metadata. Supports multiple AI models (Llama, Google Gemini, Mistral). Requires admin role.
 *     tags:
 *       - Admin - Audio
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: object
 *                 required:
 *                   - category
 *                   - subject
 *                   - lesson
 *                   - topic
 *                 properties:
 *                   category:
 *                     type: string
 *                     description: Educational category
 *                     example: "Pathology"
 *                   subject:
 *                     type: string
 *                     description: Subject area
 *                     example: "Gastrointestinal"
 *                   lesson:
 *                     type: string
 *                     description: Lesson name
 *                     example: "Inflammatory Bowel Disease"
 *                   topic:
 *                     type: string
 *                     description: Specific topic
 *                     example: "Crohn's Disease"
 *               additionalInstructions:
 *                 type: string
 *                 description: Additional instructions for the AI
 *                 example: "Focus on microscopic features"
 *               model:
 *                 type: string
 *                 description: AI model to use
 *                 default: "gemini-2.5-flash"
 *                 enum: ["gemini-2.5-flash", "llama-3.1-405b", "mistral-large"]
 *     responses:
 *       200:
 *         description: Script generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 text:
 *                   type: string
 *                   description: Generated script text
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     generated_at:
 *                       type: string
 *                       format: date-time
 *                     generation_time_ms:
 *                       type: number
 *                     model:
 *                       type: string
 *                     provider:
 *                       type: string
 *                     word_count:
 *                       type: number
 *       400:
 *         description: Bad request - missing or invalid content
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - admin privileges required
 *       500:
 *         description: Internal server error - AI service failure
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (roleError || !userData || userData.role !== "admin") {
      return NextResponse.json({ error: "Administrator privileges required." }, { status: 403 });
    }

    const body: TextGenerationRequest = await request.json();
    const { content, additionalInstructions = "", model } = body;

    if (!content) {
      return NextResponse.json(
        { success: false, error: "Educational content is required" },
        { status: 400 }
      );
    }

    if (!content.category || !content.subject || !content.lesson || !content.topic) {
      return NextResponse.json(
        {
          success: false,
          error: "Educational content must include category, subject, lesson, and topic",
        },
        { status: 400 }
      );
    }

    const selectedModel = model || "gemini-2.5-flash";

    if (!AVAILABLE_AI_MODELS.includes(selectedModel)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported model: ${selectedModel}. Supported: ${AVAILABLE_AI_MODELS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const provider = getModelProvider(selectedModel);
    const apiKey = getApiKey(provider);

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: `No API key found for provider: ${provider}` },
        { status: 500 }
      );
    }

    console.log(
      `[TTS Text Gen] Generating text using ${selectedModel} (${provider}) for ${content.subject} > ${content.lesson} > ${content.topic}`
    );

    const prompt = buildTTSPrompt(content, additionalInstructions);
    const startTime = Date.now();
    const aiResponse = await callAIService(provider, prompt, selectedModel, apiKey);
    const generationTime = Date.now() - startTime;

    console.log(
      `[TTS Text Gen] Generated text in ${generationTime}ms (${aiResponse.content.length} chars, ${aiResponse.content.trim().split(/\s+/).length} words)`
    );

    return NextResponse.json({
      success: true,
      text: aiResponse.content.trim(),
      metadata: {
        generated_at: new Date().toISOString(),
        generation_time_ms: generationTime,
        model: selectedModel,
        provider: provider,
        word_count: aiResponse.content.trim().split(/\s+/).length,
        educational_content: {
          category: content.category,
          subject: content.subject,
          lesson: content.lesson,
          topic: content.topic,
        },
      },
    });
  } catch (error) {
    console.error("[TTS Text Gen] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
