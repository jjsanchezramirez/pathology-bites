// Admin question generation — sanitize + extract JSON from the AI response.
import { log } from "@/shared/utils/logging";

// Helper function to sanitize JSON string by removing/escaping control characters
function sanitizeJSONString(jsonStr: string): string {
  return (
    jsonStr
      // Replace unescaped newlines, tabs, and carriage returns with escaped versions
      .replace(/(?<!\\)\n/g, "\\n")
      .replace(/(?<!\\)\t/g, "\\t")
      .replace(/(?<!\\)\r/g, "\\r")
      // Remove other control characters that might break JSON parsing
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Fix common issues with quotes - be more careful here
      .replace(/\\"/g, "___ESCAPED_QUOTE___") // Temporarily replace escaped quotes
      .replace(/"/g, '\\"') // Escape all remaining quotes
      .replace(/___ESCAPED_QUOTE___/g, '\\"')
  ); // Restore escaped quotes
}

export function extractJSON(text: string): unknown {
  log.debug(`[Admin AI] Extracting JSON from response (${text.length} chars)`);

  // Handle Mistral thinking format first
  let cleanedText = text;
  try {
    // Check if it's a Mistral thinking format (array with thinking objects)
    if (text.trim().startsWith("[")) {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        // Find the actual text response (not thinking)
        const textResponse = parsed.find((item) => item.type === "text" && !item.thinking);
        if (textResponse?.text) {
          cleanedText = textResponse.text;
          log.debug("[Admin AI] Extracted content from Mistral thinking format");
        }
      }
    }
  } catch {
    // Continue with original text if parsing fails
  }

  // Strategy 1: Smart brace counting (handles extra content after JSON)
  const firstBrace = cleanedText.indexOf("{");
  if (firstBrace !== -1) {
    let braceCount = 0;
    let i = firstBrace;
    let inString = false;
    let escapeNext = false;

    while (i < cleanedText.length) {
      const char = cleanedText[i];

      if (escapeNext) {
        escapeNext = false;
      } else if (char === "\\" && inString) {
        escapeNext = true;
      } else if (char === '"' && !escapeNext) {
        inString = !inString;
      } else if (!inString) {
        if (char === "{") {
          braceCount++;
        } else if (char === "}") {
          braceCount--;
          if (braceCount === 0) {
            const jsonStr = cleanedText.substring(firstBrace, i + 1);
            try {
              return JSON.parse(sanitizeJSONString(jsonStr));
            } catch {
              // Try without sanitization as fallback
              try {
                return JSON.parse(jsonStr);
              } catch {
                log.debug("[Admin AI] JSON parsing failed, trying next strategy");
                break;
              }
            }
          }
        }
      }
      i++;
    }
  }

  // Strategy 2: Look for JSON between code blocks
  const codeBlockMatch = cleanedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(sanitizeJSONString(codeBlockMatch[1]));
    } catch {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch {
        log.debug("[Admin AI] Code block JSON parsing failed");
      }
    }
  }

  // Strategy 3: Greedy match (fallback)
  const greedyMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (greedyMatch) {
    try {
      return JSON.parse(sanitizeJSONString(greedyMatch[0]));
    } catch {
      try {
        return JSON.parse(greedyMatch[0]);
      } catch {
        // Try to fix common JSON issues
        const fixedJson = greedyMatch[0]
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to unquoted keys
          .replace(/:\s*'([^']*)'/g, ': "$1"') // Replace single quotes with double quotes
          .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas
          .trim();

        try {
          return JSON.parse(sanitizeJSONString(fixedJson));
        } catch {
          try {
            return JSON.parse(fixedJson);
          } catch (finalError) {
            log.error("[Admin AI] All JSON parsing strategies failed.");
            log.error("[Admin AI] Response preview (first 1000 chars):", text.substring(0, 1000));
            log.error(
              "[Admin AI] Response preview (last 500 chars):",
              text.substring(Math.max(0, text.length - 500))
            );

            // Provide more helpful error message
            const errorMsg = `AI model returned invalid JSON. Try: (1) Use a different model like Gemini 2.5 Flash or LLAMA 3.3 70B, (2) Simplify instructions, or (3) Try again (responses vary). Error: ${finalError instanceof Error ? finalError.message : "Parse error"}`;
            throw new Error(errorMsg);
          }
        }
      }
    }
  }

  log.error(
    "[Admin AI] Failed to extract JSON. Response preview (first 1000 chars):",
    text.substring(0, 1000)
  );
  log.error(
    "[Admin AI] Response preview (last 500 chars):",
    text.substring(Math.max(0, text.length - 500))
  );
  throw new Error(
    "No JSON found in AI response. The model may have returned plain text instead of JSON. Try using a different AI model (e.g., Gemini 2.5 Flash or LLAMA 3.3 70B) or simplify your instructions."
  );
}
