// WSI question generation — AI provider calls (Groq/Cerebras/Google/Mistral/Claude dispatch)
// with per-provider token tracking. callAIService routes to the right provider.
import { callClaudeText } from "@/shared/services/claude-api";
import { callOpenAICompatText } from "@/shared/services/openai-compat";
import { VirtualSlide } from "@/shared/types/virtual-slides";

const WSI_SYSTEM_PROMPT =
  "You are an expert pathologist creating educational multiple-choice questions for medical students and residents. Focus on clinical correlation, diagnosis, and educational value.";

export function normalizeWSI(wsi: VirtualSlide): VirtualSlide {
  return {
    ...wsi,
    // Ensure image_url is available (prefer slide_url, then case_url, then image_url)
    image_url: wsi.image_url || wsi.slide_url || wsi.case_url || "",
  };
}

// API call functions with token usage tracking

async function callGoogleAPI(
  prompt: string,
  model: string,
  apiKey: string
): Promise<{ content: string; tokenUsage?: unknown }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000,
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
    tokenUsage: data.usageMetadata
      ? {
          prompt_tokens: data.usageMetadata.promptTokenCount || 0,
          completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
          total_tokens: data.usageMetadata.totalTokenCount || 0,
        }
      : undefined,
  };
}

// Fast AI service dispatcher - eliminates switch statement overhead
export async function callAIService(
  provider: string,
  prompt: string,
  modelId: string,
  apiKey: string
): Promise<{ content: string; tokenUsage?: unknown }> {
  switch (provider) {
    case "groq":
    case "cerebras":
      return await callOpenAICompatText(provider, modelId, apiKey, prompt, {
        system: WSI_SYSTEM_PROMPT,
        maxTokens: 4000,
        temperature: 0.7,
        timeoutMs: 20_000,
      });
    case "google":
      return await callGoogleAPI(prompt, modelId, apiKey);
    case "mistral":
      return await callMistralAPI(prompt, modelId, apiKey);
    case "claude": {
      const res = await callClaudeText(prompt, modelId, apiKey, {
        system: WSI_SYSTEM_PROMPT,
        maxTokens: 2048,
        temperature: 0.3,
      });
      return { content: res.content, tokenUsage: res.tokenUsage };
    }
    default:
      throw new Error(`Unsupported model provider: ${provider}`);
  }
}

async function callMistralAPI(
  prompt: string,
  model: string,
  apiKey: string
): Promise<{ content: string; tokenUsage?: unknown }> {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || "",
    tokenUsage: data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
        }
      : undefined,
  };
}
