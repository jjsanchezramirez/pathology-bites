// WSI question generation — AI provider calls (Meta/Groq/Google/Mistral/Claude dispatch)
// with per-provider token tracking. callAIService routes to the right provider.
import { callClaudeText } from "@/shared/services/claude-api";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { log } from "@/shared/utils/logging";

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

async function callMetaAPI(
  prompt: string,
  model: string,
  apiKey: string
): Promise<{ content: string; tokenUsage?: unknown }> {
  // Add AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

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
              "You are an expert pathologist creating educational multiple-choice questions for medical students and residents. Focus on clinical correlation, diagnosis, and educational value.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_completion_tokens: 4000,
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
    const errorText = await response.text();
    let errorMessage = `Meta LLAMA API error: ${response.status} ${response.statusText}`;

    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      }
    } catch {
      // Use default error message if JSON parsing fails
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  // Debug logging for Meta LLAMA API response
  log.debug("[Meta API] Full response keys:", Object.keys(data));
  log.debug("[Meta API] Usage data:", data.usage);
  log.debug("[Meta API] Token usage data:", data.token_usage);
  log.debug("[Meta API] Completion message:", data.completion_message);
  log.debug(
    '[Meta API] Looking for any field containing "token" or "usage":',
    Object.keys(data).filter(
      (key) =>
        key.toLowerCase().includes("token") ||
        key.toLowerCase().includes("usage") ||
        key.toLowerCase().includes("count")
    )
  );

  // Handle Meta LLAMA API response format
  let content = "";
  if (data.completion_message?.content?.text) {
    content = data.completion_message.content.text;
  } else if (data.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content;
  }

  // Check for token usage in various possible locations
  let tokenUsage = undefined;
  if (data.usage) {
    tokenUsage = {
      prompt_tokens: data.usage.prompt_tokens || 0,
      completion_tokens: data.usage.completion_tokens || 0,
      total_tokens: data.usage.total_tokens || 0,
    };
  } else if (data.token_usage) {
    tokenUsage = {
      prompt_tokens: data.token_usage.prompt_tokens || 0,
      completion_tokens: data.token_usage.completion_tokens || 0,
      total_tokens: data.token_usage.total_tokens || 0,
    };
  } else if (data.completion_message?.usage) {
    tokenUsage = {
      prompt_tokens: data.completion_message.usage.prompt_tokens || 0,
      completion_tokens: data.completion_message.usage.completion_tokens || 0,
      total_tokens: data.completion_message.usage.total_tokens || 0,
    };
  }

  log.debug("[Meta API] Extracted token usage:", tokenUsage);

  // If no token usage found, create estimated usage for testing
  if (!tokenUsage && content) {
    const systemPrompt =
      "You are an expert pathologist creating educational multiple-choice questions for medical students and residents. Focus on clinical correlation, diagnosis, and educational value.";
    const totalPromptLength = systemPrompt.length + prompt.length;
    const estimatedPromptTokens = Math.ceil(totalPromptLength / 4); // Rough estimate: 4 chars per token
    const estimatedCompletionTokens = Math.ceil(content.length / 4);
    tokenUsage = {
      prompt_tokens: estimatedPromptTokens,
      completion_tokens: estimatedCompletionTokens,
      total_tokens: estimatedPromptTokens + estimatedCompletionTokens,
    };
    log.debug("[Meta API] Created estimated token usage:", tokenUsage);
  }

  return {
    content: content || "",
    tokenUsage,
  };
}

async function callGroqAPI(
  prompt: string,
  model: string,
  apiKey: string
): Promise<{ content: string; tokenUsage?: unknown }> {
  // Add AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
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
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Groq API timeout after 15 seconds");
    }
    throw error;
  }
}

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
    case "llama":
      return await callMetaAPI(prompt, modelId, apiKey);
    case "groq":
      return await callGroqAPI(prompt, modelId, apiKey);
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
