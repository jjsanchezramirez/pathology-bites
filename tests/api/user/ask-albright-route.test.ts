import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockRequest, getResponseJson } from "@tests/helpers/api-test-helpers";

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/shared/config/ai-keys", () => ({ getApiKey: vi.fn(() => "test-token") }));
vi.mock("@/shared/services/openai-compat", () => ({ callOpenAICompatText: vi.fn() }));
vi.mock("@/shared/services/pathtalk", () => ({ searchPathTalk: vi.fn() }));

import { getApiKey } from "@/shared/config/ai-keys";
import { callOpenAICompatText } from "@/shared/services/openai-compat";
import { searchPathTalk } from "@/shared/services/pathtalk";
import { clearAskCache } from "@/features/user/ask-albright/lib/ask";
import { ROUTER_MODEL, ANSWER_MODEL } from "@/features/user/ask-albright/lib/router";

const ai = vi.mocked(callOpenAICompatText);
const search = vi.mocked(searchPathTalk);

const HITS = [
  {
    title: "Oncocytoma",
    href: "https://po/onco",
    body: "CK7 is patchy in oncocytoma. ".repeat(40),
  },
  { title: "Chromophobe", href: "https://po/chromo", body: "CK7 is diffuse in chromophobe." },
  { title: "Extra", href: "https://po/extra", body: "Third." },
  { title: "Fourth", href: "https://po/4", body: "Should be dropped." },
];

let n = 0;
function ask(question: unknown, userId: string | null = `user-${n}`) {
  return createMockRequest({
    method: "POST",
    url: "http://localhost:3000/api/user/ask-albright",
    headers: userId ? { "x-user-id": userId } : {},
    body: { question },
  });
}

function mockAi(routerReply: string, answer = "CK7 is diffuse in chromophobe [2].") {
  ai.mockImplementation(async (_p, model) =>
    model === ROUTER_MODEL
      ? {
          content: routerReply,
          tokenUsage: { prompt_tokens: 94, completion_tokens: 1, total_tokens: 95 },
        }
      : {
          content: answer,
          tokenUsage: { prompt_tokens: 900, completion_tokens: 40, total_tokens: 940 },
        }
  );
}

// Re-import per test so the module-level rate limiters start empty.
async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/user/ask-albright/route");
}

describe("POST /api/user/ask-albright", () => {
  beforeEach(() => {
    n++;
    vi.clearAllMocks();
    vi.mocked(getApiKey).mockReturnValue("test-token");
    delete process.env.ASK_ALBRIGHT_ENABLED;
    clearAskCache();
    search.mockResolvedValue(HITS);
    mockAi("A");
  });

  it("401s without a signed-in user", async () => {
    const { POST } = await loadRoute();
    const res = await POST(ask("What stains for oncocytoma?", null));
    expect(res.status).toBe(401);
    expect(ai).not.toHaveBeenCalled();
  });

  it("400s on a too-short or too-long question", async () => {
    const { POST } = await loadRoute();
    expect((await POST(ask("hi"))).status).toBe(400);
    expect((await POST(ask("x".repeat(301)))).status).toBe(400);
    expect(ai).not.toHaveBeenCalled();
  });

  it("503s when switched off, without spending a call", async () => {
    process.env.ASK_ALBRIGHT_ENABLED = "false";
    const { POST } = await loadRoute();
    expect((await POST(ask("What stains for oncocytoma?"))).status).toBe(503);
    expect(ai).not.toHaveBeenCalled();
  });

  it("503s when Workers AI is not configured", async () => {
    vi.mocked(getApiKey).mockReturnValue("");
    const { POST } = await loadRoute();
    expect((await POST(ask("What stains for oncocytoma?"))).status).toBe(503);
  });

  it("routes, retrieves 3 trimmed passages, and answers with retrieval-sourced citations", async () => {
    mockAi("B");
    const { POST } = await loadRoute();
    const res = await POST(ask("Survival in chromophobe RCC?"));
    const body = await getResponseJson(res);

    expect(res.status).toBe(200);
    expect(search).toHaveBeenCalledWith("search_path_pubmed", "Survival in chromophobe RCC?", {
      limit: 3,
    });

    // Router: tiny budget, deterministic.
    const routerCall = ai.mock.calls.find((c) => c[1] === ROUTER_MODEL)!;
    expect(routerCall[4]).toMatchObject({ maxTokens: 2, temperature: 0 });

    // Answer: capped output, only 3 passages, each trimmed.
    const answerCall = ai.mock.calls.find((c) => c[1] === ANSWER_MODEL)!;
    expect(answerCall[4]).toMatchObject({ maxTokens: 220 });
    const prompt = answerCall[3] as string;
    expect(prompt).toContain("[3] Extra");
    expect(prompt).not.toContain("Fourth");
    expect(prompt.length).toBeLessThan(2000);

    expect(body).toMatchObject({
      source: "pubmed",
      sourceLabel: "PubMed",
      cached: false,
      tokens: 95 + 940,
      citations: [
        { n: 1, title: "Oncocytoma", href: "https://po/onco" },
        { n: 2, title: "Chromophobe", href: "https://po/chromo" },
        { n: 3, title: "Extra", href: "https://po/extra" },
      ],
    });
  });

  it("rebuilds a flattened panel, sends it as rows, and returns it once", async () => {
    const panel =
      "IHC panels Hale KIT CK7 Chromophobe RCC +++ +++ +++ Oncocytoma - +++ rare Clear cell RCC - - - Papillary RCC - - +++ References";
    search.mockResolvedValue([
      { title: "chromophobe", href: "https://po/chromo", body: panel },
      { title: "rcc overview", href: "https://po/rcc", body: panel },
    ]);
    const { POST } = await loadRoute();
    const body = await getResponseJson(
      await POST(ask("Chromophobe RCC versus oncocytoma stains?"))
    );

    const prompt = ai.mock.calls.find((c) => c[1] === ANSWER_MODEL)![3] as string;
    expect(prompt).toContain(
      "Table: Chromophobe RCC: Hale +++, KIT +++, CK7 +++; Oncocytoma: Hale -, KIT +++, CK7 rare"
    );
    expect(prompt.match(/Table:/g)).toHaveLength(1);
    expect(body.tables).toHaveLength(1);
    expect(body.tables[0]).toMatchObject({
      n: 1,
      headers: ["Hale", "KIT", "CK7"],
      focusRows: ["Chromophobe RCC", "Oncocytoma"],
    });
  });

  it("drops duplicate hrefs so each source is cited once", async () => {
    search.mockResolvedValue([HITS[0], { ...HITS[0], body: "second chunk" }, HITS[1]]);
    const { POST } = await loadRoute();
    const body = await getResponseJson(await POST(ask("What stains for oncocytoma?")));
    expect(body.citations.map((c: { href: string }) => c.href)).toEqual([
      "https://po/onco",
      "https://po/chromo",
    ]);
  });

  it("falls back to keywords when the router answers off-format", async () => {
    mockAi("The World Health");
    const { POST } = await loadRoute();
    const res = await POST(ask("What is the WHO grade of meningioma?"));
    expect(res.status).toBe(200);
    expect(search).toHaveBeenCalledWith("search_who", expect.any(String), { limit: 3 });
  });

  it("falls back to keywords when the router call throws", async () => {
    ai.mockImplementation(async (_p, model) => {
      if (model === ROUTER_MODEL) throw new Error("cloudflare API error: 500");
      return {
        content: "Answer [1].",
        tokenUsage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    });
    const { POST } = await loadRoute();
    const res = await POST(ask("Histologic features of Warthin tumor"));
    expect(res.status).toBe(200);
    expect(search).toHaveBeenCalledWith("search_pathology_outlines", expect.any(String), {
      limit: 3,
    });
  });

  it("serves a repeated question from cache with zero tokens", async () => {
    const { POST } = await loadRoute();
    await POST(ask("What stains for oncocytoma?"));
    const callsAfterFirst = ai.mock.calls.length;
    const res = await POST(ask("  what stains for ONCOCYTOMA  "));
    const body = await getResponseJson(res);
    expect(body).toMatchObject({ cached: true, tokens: 0 });
    expect(ai.mock.calls.length).toBe(callsAfterFirst);
  });

  it("404s when the source returns no passages, without an answer call", async () => {
    search.mockResolvedValue([]);
    const { POST } = await loadRoute();
    const res = await POST(ask("What stains for oncocytoma?"));
    expect(res.status).toBe(404);
    expect(ai.mock.calls.some((c) => c[1] === ANSWER_MODEL)).toBe(false);
  });

  it("502s when the answer model fails", async () => {
    ai.mockImplementation(async (_p, model) => {
      if (model === ROUTER_MODEL) return { content: "A" };
      throw new Error("cloudflare API timeout after 15s");
    });
    const { POST } = await loadRoute();
    expect((await POST(ask("What stains for oncocytoma?"))).status).toBe(502);
  });

  it("429s after 10 questions in a minute, per user", async () => {
    const { POST } = await loadRoute();
    for (let i = 0; i < 10; i++) {
      expect((await POST(ask(`Question number ${i} about CK7`, "busy"))).status).toBe(200);
    }
    const res = await POST(ask("One more question about CK7", "busy"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    // Another user is unaffected.
    expect((await POST(ask("Question about CK7", "calm"))).status).toBe(200);
  });
});
