/**
 * Cloudflare Workers AI as an OpenAI-compatible provider.
 *
 * It joins the chain as the cheap backstop — the slot that answers when every
 * faster provider has hit a ceiling. A backstop that is silently misconfigured
 * is worse than no backstop, because the chain spends an attempt discovering it,
 * so the wiring is pinned here rather than trusted.
 *
 * Two things are genuinely different about this provider: the endpoint is scoped
 * to an account (so the URL is built, not looked up), and the model id carries
 * an `@cf/` prefix that has to survive both provider inference and the
 * reasoning-model detection that gpt-oss needs on every host.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getModelProvider, TEXT_FALLBACK_CHAIN } from "@/shared/config/ai-models";
import { isOpenAICompatProvider, callOpenAICompatChat } from "@/shared/services/openai-compat";

const MODEL = "@cf/openai/gpt-oss-20b";

const okResponse = () =>
  ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      choices: [{ message: { content: "answer" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }),
    text: async () => "",
  }) as unknown as Response;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(okResponse());
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct123");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const call = () =>
  callOpenAICompatChat("cloudflare", MODEL, "token", [{ role: "user", content: "hi" }], {
    maxTokens: 1600,
  });

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe("Cloudflare Workers AI wiring", () => {
  it("is recognised as OpenAI-compatible and routed to the right provider", () => {
    expect(isOpenAICompatProvider("cloudflare")).toBe(true);
    expect(getModelProvider(MODEL)).toBe("cloudflare");
  });

  it("builds the account-scoped endpoint", async () => {
    await call();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct123/ai/v1/chat/completions"
    );
  });

  it("fails loudly without an account id instead of calling a malformed URL", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID", "");
    await expect(call()).rejects.toThrow(/CLOUDFLARE_ACCOUNT_ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats the @cf/-prefixed gpt-oss as a reasoning model", async () => {
    // The id shape is a third variant — Cerebras serves `gpt-oss-120b`, Groq
    // `openai/gpt-oss-120b`. gpt-oss spends completion budget thinking before it
    // emits anything, so missing the prefix here would return empty strings at
    // small budgets, exactly as it did on Groq before the matcher was widened.
    await call();
    const body = sentBody();
    expect(body.reasoning_effort).toBe("low");
    expect(body.max_completion_tokens).toBeGreaterThanOrEqual(1024);
  });

  it("sends max_completion_tokens, not Mistral's max_tokens", async () => {
    await call();
    expect(sentBody().max_tokens).toBeUndefined();
  });

  it("is in the fallback chain, behind the faster providers", async () => {
    const at = TEXT_FALLBACK_CHAIN.indexOf(MODEL);
    expect(at).toBeGreaterThan(1);
  });
});

/**
 * The fallback walk decides whether to skip a model purely on getApiKey()
 * returning empty. A token without an account id addresses nothing, so it has
 * to read as unconfigured there — otherwise the chain reaches its backstop,
 * throws, and burns the slot it was holding in reserve.
 */
describe("Cloudflare config completeness", () => {
  // API_KEYS is built once at module load, so the env has to be stubbed BEFORE
  // the import or the token never lands and the test passes for the wrong
  // reason — reporting "unconfigured" because there was no key at all.
  async function loadKeys(accountId: string) {
    vi.stubEnv("CLOUDFLARE_AI_API_TOKEN", "tok");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", accountId);
    vi.stubEnv("NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID", "");
    vi.resetModules();
    return await import("@/shared/config/ai-keys");
  }

  it("reports a token without an account id as unconfigured", async () => {
    const { getApiKey, hasApiKey, getAvailableProviders } = await loadKeys("");

    expect(getApiKey("cloudflare")).toBe("");
    expect(hasApiKey("cloudflare")).toBe(false);
    expect(getAvailableProviders()).not.toContain("cloudflare");
  });

  it("reports it as configured once the account id is present", async () => {
    // The other half of the pair: without this, returning "" unconditionally
    // would satisfy the test above and silently disable the backstop for good.
    const { getApiKey, hasApiKey, getAvailableProviders } = await loadKeys("acct123");

    expect(getApiKey("cloudflare")).toBe("tok");
    expect(hasApiKey("cloudflare")).toBe(true);
    expect(getAvailableProviders()).toContain("cloudflare");
  });
});
