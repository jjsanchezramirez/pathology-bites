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
  LEGACY_MODEL_REMAP,
  VISION_CAPABLE_MODELS,
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

/** Like walk(), but includes .tsx — the dead default lived in a component. */
function walkSources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "debug" ? [] : walkSources(full);
    return /\.tsx?$/.test(full) ? [full] : [];
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

    // No exemptions. There used to be exactly one — admin/audio/align called
    // Whisper directly, on the grounds that audio → text is a different
    // modality from chat completions and so had no business going through the
    // dispatcher. That was a fair argument, but the route was deleted in Aug
    // 2026: it had no caller anywhere in the codebase and could only ever
    // return 501, since there is no OpenAI key and no plan to get one.
    //
    // Its exemption is not being preserved for a hypothetical successor. If a
    // genuinely non-chat modality is added later, the exemption should be
    // re-argued then, against that route's real code.
    expect(offenders, `Route(s) calling a provider directly:\n${offenders.join("\n")}`).toEqual([]);
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

  it("has no decommissioned model id anywhere in the source", () => {
    // These ids are gone from their providers and answer 404. The danger is not
    // the chain — the chain is covered above — but hardcoded defaults, which is
    // exactly where llama-3.3-70b-versatile survived its own removal: it sat as
    // the last-resort fallback in question refinement, reachable whenever a
    // question set had no model and the user had not picked one. It is also NOT
    // in LEGACY_MODEL_REMAP (that map holds the Meta-era `Llama-*` ids, not
    // Groq's), so nothing would have translated it. Use DEFAULT_AI_MODEL.
    const DECOMMISSIONED = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama-4-scout"];
    const offenders: string[] = [];
    for (const file of walkSources(join(process.cwd(), "src"))) {
      const rel = file.replace(process.cwd() + "/", "");
      // The catalog and the vision-bench notes discuss these ids by name.
      if (rel.includes("shared/config/ai-models.ts") || rel.includes("api/debug/")) continue;
      const source = readFileSync(file, "utf8");
      for (const id of DECOMMISSIONED) {
        if (source.includes(id)) offenders.push(`${rel} → ${id}`);
      }
    }
    expect(offenders, `Decommissioned model id referenced:\n${offenders.join("\n")}`).toEqual([]);
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

  // Providers retire models on their own schedule, and a remap is the one place
  // a dead id can hide: nothing references it until a stale id shows up in a
  // saved question or a user preference, at which point it resolves to a 404.
  // Two have already rotted this way — llama-3.1-8b-instant (Groq, 2026-08-16)
  // and llama-4-scout, which was retired without notice.
  it("remaps every legacy model id onto a model that still exists", () => {
    const live = new Set(ACTIVE_AI_MODELS.map((m) => m.id));
    const dangling = Object.entries(LEGACY_MODEL_REMAP)
      .filter(([, target]) => !live.has(target))
      .map(([from, to]) => `${from} -> ${to}`);
    expect(dangling).toEqual([]);
  });

  it("never remaps a legacy id onto itself", () => {
    // A self-remap means the entry is doing nothing and the original id is being
    // sent to a provider that no longer serves it.
    const selfRefs = Object.entries(LEGACY_MODEL_REMAP).filter(([from, to]) => from === to);
    expect(selfRefs).toEqual([]);
  });

  it("remaps a vision model onto a model that can still see", () => {
    // Scout was the vision entry; remapping it to a text-only model would fail at
    // call time with an unhelpful error rather than at config time.
    const target = LEGACY_MODEL_REMAP["Llama-4-Scout-17B-16E-Instruct-FP8"];
    expect(VISION_CAPABLE_MODELS.has(target)).toBe(true);
  });
});
