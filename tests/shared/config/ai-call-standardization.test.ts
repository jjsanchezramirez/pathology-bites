/**
 * One AI call path, enforced.
 *
 * Every production AI call must go through the shared dispatcher
 * (`runAITask` / `runVisionTask` → `callModel` / `callVisionModel`). Hand-rolled
 * per-provider branching is how the app ended up with four near-identical
 * copies that had each drifted: Google silently dropped the system prompt,
 * several calls had no request timeout, and one "vision" call shipped no image
 * at all.
 *
 * These tests fail the moment a new raw provider call appears in a route, which
 * is the only reliable way to stop the drift coming back.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ACTIVE_AI_MODELS,
  AI_TASKS,
  DISABLED_AI_MODELS,
  VISION_FALLBACK_CHAIN,
  TEXT_FALLBACK_CHAIN,
} from "@/shared/config/ai-models";

const API_ROOT = join(process.cwd(), "src/app/api");

/** Raw provider endpoints. Legal only inside src/shared/services. */
const PROVIDER_ENDPOINTS = [
  "generativelanguage.googleapis.com",
  "api.groq.com",
  "api.cerebras.ai",
  "api.mistral.ai",
  "api.anthropic.com",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // src/app/api/debug is gitignored, dev-only, and blocked in production;
      // raw calls there are deliberate probes, not app code paths.
      return entry === "debug" ? [] : walk(full);
    }
    return full.endsWith(".ts") ? [full] : [];
  });
}

describe("AI call standardization", () => {
  it("has no raw provider endpoint in any production API route", () => {
    const offenders: string[] = [];

    for (const file of walk(API_ROOT)) {
      const source = readFileSync(file, "utf8");
      for (const endpoint of PROVIDER_ENDPOINTS) {
        if (source.includes(endpoint)) {
          offenders.push(`${file.replace(process.cwd() + "/", "")} → ${endpoint}`);
        }
      }
    }

    // Whisper transcription is intentionally exempt: it is a different modality
    // (audio → text), not served by the chat-completions dispatcher.
    const unexpected = offenders.filter((o) => !o.includes("admin/audio/align"));

    expect(unexpected, `Route(s) calling a provider directly:\n${unexpected.join("\n")}`).toEqual(
      []
    );
  });

  it("gives every task a deadline that can outlast at least one model attempt", () => {
    for (const [name, profile] of Object.entries(AI_TASKS)) {
      // A deadline shorter than one attempt means the chain can never fail over.
      expect(
        profile.deadlineMs,
        `${name} deadline must exceed its per-model timeout`
      ).toBeGreaterThan(profile.timeoutMs);
    }
  });

  it("points vision tasks at the vision chain and text tasks at the text chain", () => {
    // A text model handed an image silently returns nonsense rather than failing.
    expect(AI_TASKS["lesson-vision"].chain).toBe(VISION_FALLBACK_CHAIN);
    for (const name of ["lesson-planner", "lesson-transcript"] as const) {
      expect(AI_TASKS[name].chain, `${name} must use the text chain`).toBe(TEXT_FALLBACK_CHAIN);
    }
  });

  it("only points the chains at models that are active in the catalog", () => {
    // Groq retired llama-4-scout while it was still VISION_FALLBACK_CHAIN[0];
    // every vision call failed over to Gemini and nothing said so. A chain
    // entry that is disabled — or absent entirely — is a silent outage.
    const active = new Set(ACTIVE_AI_MODELS.filter((m) => m.available).map((m) => m.id));
    const disabled = new Set(DISABLED_AI_MODELS.map((m) => m.id));

    for (const [name, chain] of [
      ["TEXT_FALLBACK_CHAIN", TEXT_FALLBACK_CHAIN],
      ["VISION_FALLBACK_CHAIN", VISION_FALLBACK_CHAIN],
    ] as const) {
      for (const model of chain) {
        expect(disabled.has(model), `${name} references disabled model ${model}`).toBe(false);
        expect(active.has(model), `${name} references unknown/unavailable model ${model}`).toBe(
          true
        );
      }
    }
  });

  it("does not put a known-unusable model back in a chain", () => {
    // Each of these was measured on the real WSI prompt spending its entire
    // token budget without ever closing the JSON. Slow is recoverable; this is not.
    const unusable = [
      "zai-glm-4.7",
      "openai/gpt-oss-20b",
      "qwen/qwen3.6-27b",
      "ministral-14b-2512",
    ];
    for (const model of unusable) {
      expect(TEXT_FALLBACK_CHAIN, `${model} was measured unusable`).not.toContain(model);
      expect(VISION_FALLBACK_CHAIN, `${model} was measured unusable`).not.toContain(model);
    }
  });

  it("keeps the lesson-studio critical path inside the 60s generate-lesson budget", () => {
    // generate-lesson (maxDuration 60) runs transcript analysis and vision
    // concurrently via Promise.all, then the planner. Images also fan out in
    // parallel, so vision contributes one deadline rather than one per image.
    // The critical path is therefore max(transcript, vision) + planner.
    const criticalPath =
      Math.max(AI_TASKS["lesson-transcript"].deadlineMs, AI_TASKS["lesson-vision"].deadlineMs) +
      AI_TASKS["lesson-planner"].deadlineMs;

    // Headroom for image fetching, DB reads and assembly, which are not AI time.
    expect(criticalPath).toBeLessThanOrEqual(50_000);
  });
});
