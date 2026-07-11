// Admin question generation — AI provider calls (Groq/Cerebras/Google/Mistral/Claude dispatch).
import { callClaudeText } from "@/shared/services/claude-api";
import { callOpenAICompatText } from "@/shared/services/openai-compat";

const QUESTION_GEN_SYSTEM =
  "You are an expert pathologist and medical educator creating high-quality board-style multiple-choice questions for medical students and residents. Create clinically relevant questions that test diagnostic reasoning, not just memorization. Focus on clinical correlation, differential diagnosis, and educational value. Always provide detailed explanations that include both clinical and histopathological reasoning. Always respond with properly formatted JSON and follow the exact format requested.";

// AI API call functions
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
        system: QUESTION_GEN_SYSTEM,
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
        system: QUESTION_GEN_SYSTEM,
        maxTokens: 2048,
        temperature: 0.3,
      });
      return { content: res.content, tokenUsage: res.tokenUsage };
    }
    default:
      throw new Error(`Unsupported model provider: ${provider}`);
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
      messages: [
        {
          role: "system",
          content: QUESTION_GEN_SYSTEM,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 4000,
      temperature: 0.7,
      // Force valid JSON — fixes small-model malformed output (e.g. Ministral 8B)
      response_format: { type: "json_object" },
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
