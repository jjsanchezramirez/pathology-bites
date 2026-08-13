// Shared Claude (Anthropic) API caller.
// Supports both text-only and vision (image URL) messages.

const DEFAULT_TIMEOUT_MS = 30_000;

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ClaudeContentBlock[];
}

export type ClaudeContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "url"; url: string } | { type: "base64"; media_type: string; data: string };
    };

export interface ClaudeCallOptions {
  system?: string;
  maxTokens?: number;
  /**
   * ACCEPTED FOR CALLER SYMMETRY, DELIBERATELY NOT SENT.
   *
   * Anthropic removed the sampling parameters: `temperature` on any current
   * model (Opus 4.7 and later, Opus 5, Sonnet 5, Fable 5) is rejected outright —
   * `400 invalid_request_error: "temperature is deprecated for this model"`.
   *
   * The shared dispatcher passes a temperature for every provider, so dropping
   * it from the signature would mean special-casing Claude at each call site.
   * Swallowing it here keeps one call shape and cannot 400.
   */
  temperature?: number;
  timeoutMs?: number;
}

export interface ClaudeCallResult {
  content: string;
  tokenUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call the Anthropic Messages API.
 *
 * @param messages  Conversation messages (text or multimodal)
 * @param model     Model ID, e.g. "claude-opus-5"
 * @param apiKey    Anthropic API key
 * @param options   Optional system prompt, max tokens, temperature, timeout
 */
export async function callClaude(
  messages: ClaudeMessage[],
  model: string,
  apiKey: string,
  options: ClaudeCallOptions = {}
): Promise<ClaudeCallResult> {
  // `temperature` is intentionally not destructured — see ClaudeCallOptions.
  const { system, maxTokens = 4096, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
    };
    if (system) body.system = system;

    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Claude API timeout after ${timeoutMs}ms`);
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Claude API error: ${response.status} ${response.statusText}`;
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error?.message) errorMessage = errorData.error.message;
    } catch {
      // use default
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();

  // Extract text content from response
  const textBlocks = (data.content ?? []).filter((b: { type: string }) => b.type === "text");
  const content = textBlocks.map((b: { text: string }) => b.text).join("");

  // Extract token usage
  let tokenUsage: ClaudeCallResult["tokenUsage"];
  if (data.usage) {
    tokenUsage = {
      prompt_tokens: data.usage.input_tokens ?? 0,
      completion_tokens: data.usage.output_tokens ?? 0,
      total_tokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
    };
  }

  return { content, tokenUsage };
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/** Text-only Claude call with a system prompt. */
export async function callClaudeText(
  userPrompt: string,
  model: string,
  apiKey: string,
  options: Omit<ClaudeCallOptions, "system"> & { system?: string } = {}
): Promise<ClaudeCallResult> {
  return callClaude([{ role: "user", content: userPrompt }], model, apiKey, options);
}

/** Vision Claude call: text prompt + one image URL. */
export async function callClaudeVision(
  textPrompt: string,
  imageUrl: string,
  model: string,
  apiKey: string,
  options: ClaudeCallOptions = {}
): Promise<ClaudeCallResult> {
  return callClaude(
    [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: textPrompt },
        ],
      },
    ],
    model,
    apiKey,
    options
  );
}
