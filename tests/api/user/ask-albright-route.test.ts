import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockRequest, getResponseJson } from "@tests/helpers/api-test-helpers";

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/shared/config/ai-keys", () => ({ getApiKey: vi.fn(() => "test-token") }));
vi.mock("@/shared/services/openai-compat", () => ({ callOpenAICompatText: vi.fn() }));
vi.mock("@/shared/services/pathtalk", () => ({ searchPathTalk: vi.fn() }));
vi.mock("@/features/user/ask-albright/lib/history", () => ({
  saveHistory: vi.fn(async () => "hist-1"),
  findInHistory: vi.fn(async () => null),
}));
vi.mock("@/features/user/ask-albright/lib/marker-aliases", () => ({
  lookupMarkerAliases: vi.fn(async () => []),
}));

import { getApiKey } from "@/shared/config/ai-keys";
import { callOpenAICompatText } from "@/shared/services/openai-compat";
import { searchPathTalk } from "@/shared/services/pathtalk";
import { lookupMarkerAliases } from "@/features/user/ask-albright/lib/marker-aliases";
import { findInHistory, saveHistory } from "@/features/user/ask-albright/lib/history";
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

type Corpus = "search_pathology_outlines" | "search_path_pubmed" | "search_who";
type Hit = { title: string; href: string; body: string };

/** Each corpus returns its own hits; a value that is an Error rejects. */
function searchBy(by: Partial<Record<Corpus, Hit[] | Error>>) {
  search.mockImplementation(async (tool) => {
    const v = by[tool as Corpus] ?? [];
    if (v instanceof Error) throw v;
    return v;
  });
}

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
    searchBy({ search_pathology_outlines: HITS });
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

  it("searches all three corpora, keeps 3 trimmed passages, cites from retrieval", async () => {
    mockAi("B");
    const { POST } = await loadRoute();
    const res = await POST(ask("Survival in chromophobe RCC?"));
    const body = await getResponseJson(res);

    expect(res.status).toBe(200);
    for (const tool of ["search_pathology_outlines", "search_path_pubmed", "search_who"]) {
      expect(search).toHaveBeenCalledWith(tool, "Survival in chromophobe RCC?", { limit: 3 });
    }

    // Router: tiny budget, deterministic.
    const routerCall = ai.mock.calls.find((c) => c[1] === ROUTER_MODEL)!;
    expect(routerCall[4]).toMatchObject({ maxTokens: 2, temperature: 0 });

    // Answer: capped output, only 3 passages, each trimmed.
    const answerCall = ai.mock.calls.find((c) => c[1] === ANSWER_MODEL)!;
    expect(answerCall[4]).toMatchObject({ maxTokens: 280 });
    const prompt = answerCall[3] as string;
    expect(prompt.match(/^\[\d\]/gm)).toHaveLength(3);
    expect(prompt).not.toContain("Should be dropped");
    expect(prompt.length).toBeLessThan(2000);

    // Only PathologyOutlines had hits, so it is the source despite routing to PubMed.
    expect(body).toMatchObject({
      source: "outlines",
      sourceLabel: "PathologyOutlines",
      cached: false,
      tokens: 95 + 940,
    });
    expect(body.citations).toHaveLength(3);
    expect(body.citations[0]).toMatchObject({ sourceLabel: "PathologyOutlines" });
    expect(body.citations.map((c: Hit) => c.href)).toContain("https://po/chromo");
  });

  it("answers from the corpus that mentions the question's subject (NLPHL / MEF2B case)", async () => {
    // Regression: routed to PathologyOutlines, whose chunks never mention MEF2B or
    // J chain, and answered "the sources do not contain information" — while WHO
    // and PubMed both did.
    mockAi("A");
    searchBy({
      search_pathology_outlines: [
        {
          title: "NLPHL",
          href: "https://po/nlphl",
          body: "NLPHL LP cells are CD20+, OCT2+, PAX5+.",
        },
        {
          title: "NLPHL",
          href: "https://po/nlphl",
          body: "IgD+ NLPHL: young males, cervical nodes.",
        },
      ],
      search_who: [
        {
          title: "NLPHL (WHO)",
          href: "https://who/nlphl",
          body: "In contrast to CHL, MEF2B is typically expressed in LP cells of NLPHL.",
        },
      ],
      search_path_pubmed: [
        {
          title: "J chain and MEF2B in CHL vs NLPHL",
          href: "https://pubmed/28851661",
          body: "J chain and MEF2B highlighted LP cells in 20/20 NLPHLs and were negative in 43/43 CHLs.",
        },
      ],
    });
    const { POST } = await loadRoute();
    const body = await getResponseJson(
      await POST(ask("Are MEF2B and J chain useful in the diagnosis of NLPHL?"))
    );
    const hrefs = body.citations.map((c: Hit) => c.href);
    expect(hrefs.slice(0, 2).sort()).toEqual(["https://pubmed/28851661", "https://who/nlphl"]);
    const prompt = ai.mock.calls.find((c) => c[1] === ANSWER_MODEL)![3] as string;
    expect(prompt).toContain("20/20 NLPHLs");
    expect(prompt).toContain("MEF2B is typically expressed");
  });

  it("rebuilds a flattened panel, sends it as rows, and returns it once", async () => {
    const panel =
      "IHC panels Hale KIT CK7 Chromophobe RCC +++ +++ +++ Oncocytoma - +++ rare Clear cell RCC - - - Papillary RCC - - +++ References";
    searchBy({
      search_pathology_outlines: [
        { title: "chromophobe", href: "https://po/chromo", body: panel },
        { title: "rcc overview", href: "https://po/rcc", body: panel },
      ],
    });
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

  it("merges chunks of one page into one citation instead of dropping them", async () => {
    searchBy({
      search_pathology_outlines: [
        { title: "Oncocytoma", href: "https://po/onco", body: "First chunk on oncocytoma." },
        { title: "Oncocytoma", href: "https://po/onco", body: "Second chunk on oncocytoma." },
        HITS[1],
      ],
    });
    const { POST } = await loadRoute();
    const body = await getResponseJson(await POST(ask("What stains for oncocytoma?")));
    expect(body.citations.map((c: Hit) => c.href)).toEqual([
      "https://po/onco",
      "https://po/chromo",
    ]);
    const prompt = ai.mock.calls.find((c) => c[1] === ANSWER_MODEL)![3] as string;
    expect(prompt).toContain("First chunk");
    expect(prompt).toContain("Second chunk");
  });

  const TIE = {
    search_pathology_outlines: [{ title: "PO", href: "https://po/m", body: "Meningioma grade 2." }],
    search_who: [{ title: "WHO", href: "https://who/m", body: "Meningioma grade 2." }],
  };

  it("uses the router's pick to break a tie between equally relevant pages", async () => {
    searchBy(TIE);
    mockAi("C");
    const { POST } = await loadRoute();
    const body = await getResponseJson(await POST(ask("Meningioma grade 2 criteria?")));
    expect(body.citations[0].href).toBe("https://who/m");
    expect(body.source).toBe("who");
  });

  it("falls back to keywords when the router answers off-format", async () => {
    searchBy(TIE);
    mockAi("The World Health");
    const { POST } = await loadRoute();
    const body = await getResponseJson(await POST(ask("What is the WHO grade of meningioma?")));
    expect(body.citations[0].href).toBe("https://who/m");
  });

  it("falls back to keywords when the router call throws", async () => {
    searchBy(TIE);
    ai.mockImplementation(async (_p, model) => {
      if (model === ROUTER_MODEL) throw new Error("cloudflare API error: 500");
      return {
        content: "Answer [1].",
        tokenUsage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    });
    const { POST } = await loadRoute();
    const body = await getResponseJson(await POST(ask("Histologic features of meningioma")));
    expect(body.citations[0].href).toBe("https://po/m");
  });

  it("skips a corpus that errors; 502s only when all three do", async () => {
    searchBy({ search_who: new Error("HTTP 500"), search_pathology_outlines: HITS });
    const { POST } = await loadRoute();
    expect((await POST(ask("What stains for oncocytoma?"))).status).toBe(200);

    const down = new Error("HTTP 503");
    searchBy({ search_who: down, search_pathology_outlines: down, search_path_pubmed: down });
    expect((await POST(ask("What stains for chromophobe?"))).status).toBe(502);
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

  it("uses knowledge-base marker synonyms: searched, ranked, and stated to the model", async () => {
    vi.mocked(lookupMarkerAliases).mockResolvedValue([
      { name: "CD117", aliases: ["CD117", "KIT", "c-KIT"] },
    ]);
    searchBy({
      search_pathology_outlines: [
        { title: "overview", href: "https://po/a", body: "Oncocytoma overview text." },
      ],
      search_who: [
        { title: "panel", href: "https://who/b", body: "Oncocytoma: KIT +++ diffusely." },
      ],
    });
    mockAi("A");
    const { POST } = await loadRoute();
    const body = await getResponseJson(await POST(ask("Is CD117 positive in oncocytoma?")));

    expect(search).toHaveBeenCalledWith(
      "search_who",
      "Is CD117 positive in oncocytoma? (CD117 / KIT / c-KIT)",
      { limit: 3 }
    );
    expect(body.citations[0].href).toBe("https://who/b");
    const prompt = ai.mock.calls.find((c) => c[1] === ANSWER_MODEL)![3] as string;
    expect(prompt).toContain("Same marker: CD117 = KIT = c-KIT.");
  });

  it("saves each answer to the caller's history and returns its id", async () => {
    const { POST } = await loadRoute();
    const body = await getResponseJson(await POST(ask("What stains for oncocytoma?", "user-h")));
    expect(saveHistory).toHaveBeenCalledWith(
      "user-h",
      "What stains for oncocytoma?",
      expect.objectContaining({ answer: expect.any(String) })
    );
    expect(body.historyId).toBe("hist-1");
  });

  it("answers a repeat from history: no AI call, no rate-limit charge", async () => {
    vi.mocked(findInHistory).mockResolvedValue({
      id: "hist-old",
      question: "What stains for oncocytoma?",
      createdAt: "2026-11-24T00:00:00Z",
      result: { answer: "Saved [1].", citations: [], tables: [], followUps: ["Next?"] } as never,
    });
    const { POST } = await loadRoute();
    // 12 repeats would trip the 10/min limit if they counted.
    let last;
    for (let i = 0; i < 12; i++) last = await POST(ask("what stains for oncocytoma", "rep"));
    const body = await getResponseJson(last!);
    expect(last!.status).toBe(200);
    expect(body).toMatchObject({
      answer: "Saved [1].",
      repeated: true,
      cached: true,
      tokens: 0,
      historyId: "hist-old",
    });
    expect(ai).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(saveHistory).not.toHaveBeenCalled();
    vi.mocked(findInHistory).mockResolvedValue(null);
  });

  it("returns follow-up questions split off the answer", async () => {
    mockAi(
      "A",
      "CK7 is diffuse in chromophobe [2].\nFollow-ups: What about S100A1? | Is Hale iron still used?"
    );
    const { POST } = await loadRoute();
    const body = await getResponseJson(await POST(ask("What stains for chromophobe?")));
    expect(body.answer).toBe("CK7 is diffuse in chromophobe [2].");
    expect(body.followUps).toEqual(["What about S100A1?", "Is Hale iron still used?"]);
  });

  it("still answers when saving history fails", async () => {
    vi.mocked(saveHistory).mockResolvedValueOnce(null);
    const { POST } = await loadRoute();
    const res = await POST(ask("What stains for oncocytoma?"));
    expect(res.status).toBe(200);
    expect((await getResponseJson(res)).historyId).toBeNull();
  });

  it("does not cache an answer built while a corpus was down", async () => {
    searchBy({ search_who: new Error("HTTP 500"), search_pathology_outlines: HITS });
    const { POST } = await loadRoute();
    await POST(ask("What stains for oncocytoma?"));
    const body = await getResponseJson(await POST(ask("What stains for oncocytoma?")));
    expect(body.cached).toBe(false);
  });

  it("404s when no corpus returns passages, without an answer call", async () => {
    searchBy({});
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
