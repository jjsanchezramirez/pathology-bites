import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockRequest, getResponseJson } from "@tests/helpers/api-test-helpers";

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/shared/config/ai-keys", () => ({ getApiKey: vi.fn(() => "test-token") }));
vi.mock("@/shared/services/openai-compat", () => ({ callOpenAICompatText: vi.fn() }));
vi.mock("@/shared/services/pathtalk", () => ({ searchPathTalk: vi.fn() }));
vi.mock("@/features/user/ask-albright/lib/rerank", () => ({ rerankScores: vi.fn() }));
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
import { rerankScores } from "@/features/user/ask-albright/lib/rerank";
import { lookupMarkerAliases } from "@/features/user/ask-albright/lib/marker-aliases";
import { findInHistory, saveHistory } from "@/features/user/ask-albright/lib/history";
import { clearAskCache, coversItem } from "@/features/user/ask-albright/lib/ask";
import { FORMAT_INSTRUCTION, SCOPE_REPLY } from "@/features/user/ask-albright/lib/planner";
import { TABLE_MAX_TOKENS } from "@/features/user/ask-albright/lib/router";

const ai = vi.mocked(callOpenAICompatText);
const search = vi.mocked(searchPathTalk);
const rerank = vi.mocked(rerankScores);

type Hit = { title: string; href: string; body: string };
type Corpus =
  | "search_pathology_outlines"
  | "search_path_pubmed"
  | "search_who"
  | "search_path_literature";

const HITS: Hit[] = [
  {
    title: "Oncocytoma",
    href: "https://po/onco",
    body: "CK7 is patchy in oncocytoma. ".repeat(40),
  },
  { title: "Chromophobe", href: "https://po/chromo", body: "CK7 is diffuse in chromophobe." },
  { title: "Extra", href: "https://po/extra", body: "Third passage." },
  { title: "Fourth", href: "https://po/4", body: "Should be dropped." },
];

/** Each corpus returns its own hits; a value that is an Error rejects. */
function searchBy(by: Partial<Record<Corpus, Hit[] | Error>>) {
  search.mockImplementation(async (tool) => {
    const v = by[tool as Corpus] ?? [];
    if (v instanceof Error) throw v;
    return v;
  });
}

/** Reranker stub: score each excerpt with `fn` (default: everything relevant, in order). */
function scoreBy(fn: (text: string, i: number) => number = (_t, i) => 0.9 - i * 0.1) {
  rerank.mockImplementation(async (_q, texts) => texts.map(fn));
}

interface PlanShape {
  scope?: string;
  source?: string;
  fallback?: string;
  query?: string;
  focus?: string;
  format?: string;
}
const PLAN: PlanShape = {
  scope: "ok",
  source: "outlines",
  fallback: "pubmed",
  query: "chromophobe oncocytoma CK7",
  focus: "CK7 pattern in each tumour",
  format: "paragraph",
};

/** The planner call is the one in JSON mode; everything else is the answer. */
function mockAi(plan: PlanShape | string = PLAN, answer = "CK7 is diffuse in chromophobe [2].") {
  ai.mockImplementation(async (_p, _m, _k, _prompt, opts) =>
    opts?.jsonMode
      ? {
          content: typeof plan === "string" ? plan : JSON.stringify({ ...PLAN, ...plan }),
          tokenUsage: { prompt_tokens: 300, completion_tokens: 40, total_tokens: 340 },
        }
      : {
          content: answer,
          tokenUsage: { prompt_tokens: 2000, completion_tokens: 60, total_tokens: 2060 },
        }
  );
}
const plannerCalls = () => ai.mock.calls.filter((c) => c[4]?.jsonMode);
const answerCall = () => ai.mock.calls.find((c) => !c[4]?.jsonMode);

let n = 0;
function ask(question: unknown, userId: string | null = `user-${n}`) {
  return createMockRequest({
    method: "POST",
    url: "http://localhost:3000/api/user/ask-albright",
    headers: userId ? { "x-user-id": userId } : {},
    body: { question },
  });
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
    vi.mocked(findInHistory).mockResolvedValue(null);
    vi.mocked(lookupMarkerAliases).mockResolvedValue([]);
    delete process.env.ASK_ALBRIGHT_ENABLED;
    clearAskCache();
    searchBy({ search_pathology_outlines: HITS });
    scoreBy();
    mockAi();
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

  it("plans, searches one corpus, reads 3 whole passages, answers in the planned format", async () => {
    mockAi({ format: "table" });
    const { POST } = await loadRoute();
    const res = await POST(ask("Compare CK7 in chromophobe RCC and oncocytoma"));
    const body = await getResponseJson(res);

    expect(res.status).toBe(200);
    // Plan: one JSON call. Search: once, in the planned corpus, with the planned query.
    expect(plannerCalls()).toHaveLength(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith(
      "search_pathology_outlines",
      "chromophobe oncocytoma CK7",
      expect.objectContaining({ limit: 3 })
    );

    const call = answerCall()!;
    expect(call[4]).toMatchObject({ maxTokens: TABLE_MAX_TOKENS });
    expect(call[4]?.system).toContain(FORMAT_INSTRUCTION.table);
    const prompt = call[3] as string;
    expect(prompt).toContain("Look for: CK7 pattern in each tumour");
    expect(prompt.match(/^\[\d\]/gm)).toHaveLength(3);
    expect(prompt).not.toContain("Should be dropped");
    // Whole passages: the 1,160-char oncocytoma page is sent complete.
    expect(prompt).toContain("CK7 is patchy in oncocytoma. ".repeat(40).trim());

    expect(body).toMatchObject({
      source: "outlines",
      sourceLabel: "PathologyOutlines",
      format: "table",
      cached: false,
      tokens: 340 + 2060,
    });
    expect(body.citations).toHaveLength(3);
    expect(body.citations[0]).toMatchObject({ sourceLabel: "PathologyOutlines" });
  });

  it("searches the fallback corpus only when the first one misses (NLPHL / J chain case)", async () => {
    // Regression: the planned corpus had nothing on J chain; PubMed did.
    mockAi({ source: "outlines", fallback: "pubmed", query: "J chain Hodgkin Reed-Sternberg" });
    searchBy({
      search_pathology_outlines: [
        { title: "CHL", href: "https://po/chl", body: "HRS cells are CD30+ and CD15+." },
      ],
      search_path_pubmed: [
        {
          title: "J chain and MEF2B in CHL vs NLPHL",
          href: "https://pubmed/28851661",
          body: "J chain and MEF2B were negative in 43/43 CHLs and positive in 20/20 NLPHLs.",
        },
      ],
    });
    scoreBy((t) => (/J chain/i.test(t) ? 0.92 : 0.02));
    const { POST } = await loadRoute();
    const body = await getResponseJson(await POST(ask("Is J chain expressed by HRS cells?")));

    expect(search.mock.calls.map((c) => c[0])).toEqual([
      "search_pathology_outlines",
      "search_path_pubmed",
    ]);
    expect(body.citations[0].href).toBe("https://pubmed/28851661");
    expect(answerCall()![3]).toContain("43/43 CHLs");
  });

  it("searches the fallback when no passage names the question's marker (TRPS1 case)", async () => {
    // The reranker liked a GATA3-in-TNBC paper (0.85), but nothing said TRPS1.
    mockAi({ source: "pubmed", fallback: "outlines", query: "TRPS1 triple-negative breast" });
    searchBy({
      search_path_pubmed: [
        {
          title: "GATA3 in TNBC",
          href: "https://pm/gata3",
          body: "GATA3 is positive in 51% of TNBC.",
        },
      ],
      search_pathology_outlines: [
        {
          title: "Breast molecular subtypes",
          href: "https://po/subtypes",
          body: "TRPS1 (positive in 86% of triple negative and metaplastic carcinomas).",
        },
      ],
    });
    scoreBy((t) => (/TRPS1/.test(t) ? 0.95 : 0.85));
    const { POST } = await loadRoute();
    const body = await getResponseJson(await POST(ask("Is TRPS1 sensitive for TNBC?")));
    expect(search).toHaveBeenCalledTimes(2);
    expect(body.citations[0].href).toBe("https://po/subtypes");
  });

  it("searches each compared diagnosis the first results missed, and sends a passage for each", async () => {
    // Regression: "CHL vs NLPHL vs PBML IHC table" found NLPHL and CHL pages only,
    // and the model invented a column of "Negative" for PMBL.
    mockAi({
      format: "table",
      query: "CHL NLPHL PMBL IHC",
      items: [
        "Classic Hodgkin lymphoma",
        "Nodular lymphocyte predominant Hodgkin lymphoma",
        "Primary mediastinal large B-cell lymphoma",
      ],
    });
    search.mockImplementation(async (_tool, q) =>
      /primary mediastinal/i.test(q as string)
        ? [
            {
              title: "Primary mediastinal large B cell lymphoma",
              href: "https://po/pmbl",
              body: "PMBL is CD20+, CD30 weak.",
            },
          ]
        : [
            {
              title: "Classic Hodgkin lymphoma",
              href: "https://po/chl",
              body: "HRS cells CD30+ CD15+.",
            },
            {
              title: "Nodular lymphocyte predominant Hodgkin lymphoma",
              href: "https://po/nlphl",
              body: "LP cells CD20+.",
            },
          ]
    );
    const { POST } = await loadRoute();
    const body = await getResponseJson(await POST(ask("CHL vs NLPHL vs PBML IHC table")));
    expect(search).toHaveBeenCalledTimes(2);
    expect(search.mock.calls[1][1]).toBe("Primary mediastinal large B-cell lymphoma IHC");
    expect(body.citations.map((c: Hit) => c.href).sort()).toEqual([
      "https://po/chl",
      "https://po/nlphl",
      "https://po/pmbl",
    ]);
  });

  it("judges coverage by page title, not by a differential mentioned in the body", () => {
    expect(
      coversItem(
        "primary mediastinal (thymic) large B cell lymphoma",
        "Primary Mediastinal B-Cell Lymphoma"
      )
    ).toBe(true);
    expect(
      coversItem("Classic Hodgkin lymphoma", "Nodular lymphocyte predominant Hodgkin lymphoma")
    ).toBe(false);
  });

  it("does not search a second corpus when the first one answers", async () => {
    scoreBy(() => 0.8);
    const { POST } = await loadRoute();
    await POST(ask("What stains for oncocytoma?"));
    expect(search).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["off_topic", "What's a good recipe for banana bread?"],
    ["too_broad", "Explain all of soft tissue pathology"],
  ] as const)("declines %s questions without searching", async (scope, q) => {
    mockAi({ scope });
    const { POST } = await loadRoute();
    const body = await getResponseJson(await POST(ask(q)));
    expect(body).toMatchObject({ answer: SCOPE_REPLY[scope], scope, citations: [], tokens: 340 });
    expect(search).not.toHaveBeenCalled();
    expect(answerCall()).toBeUndefined();
  });

  it("falls back to searching as asked when the planner fails", async () => {
    searchBy({
      search_who: [{ title: "WHO", href: "https://who/m", body: "Meningioma grade 2." }],
    });
    ai.mockImplementation(async (_p, _m, _k, _prompt, opts) => {
      if (opts?.jsonMode) throw new Error("cloudflare API error: 500");
      return {
        content: "Grade 2 [1].",
        tokenUsage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    });
    const { POST } = await loadRoute();
    const res = await POST(ask("What is the WHO grade of atypical meningioma?"));
    expect(res.status).toBe(200);
    expect(search).toHaveBeenCalledWith(
      "search_who",
      "What is the WHO grade of atypical meningioma?",
      expect.anything()
    );
  });

  it("repairs a half-valid plan field by field", async () => {
    mockAi('{"scope":"ok","source":"nonsense","query":"x","format":"poem"}');
    const { POST } = await loadRoute();
    const body = await getResponseJson(await POST(ask("Histologic features of Warthin tumor")));
    // Unknown source → keyword guess (outlines); too-short query → the question; bad format → paragraph.
    expect(search).toHaveBeenCalledWith(
      "search_pathology_outlines",
      "Histologic features of Warthin tumor",
      expect.anything()
    );
    expect(body.format).toBe("paragraph");
  });

  it("uses term-coverage order and no fallback search when the reranker is down", async () => {
    rerank.mockRejectedValue(new Error("rerank: HTTP 500"));
    const { POST } = await loadRoute();
    const res = await POST(ask("What stains for oncocytoma?"));
    expect(res.status).toBe(200);
    expect(search).toHaveBeenCalledTimes(1);
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
    const prompt = answerCall()![3] as string;
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
    const prompt = answerCall()![3] as string;
    expect(prompt).toContain("First chunk");
    expect(prompt).toContain("Second chunk");
  });

  it("searches the fallback when the planned corpus errors; 502s when both do", async () => {
    searchBy({ search_pathology_outlines: new Error("HTTP 500"), search_path_pubmed: HITS });
    const { POST } = await loadRoute();
    expect((await POST(ask("What stains for oncocytoma?"))).status).toBe(200);

    const down = new Error("HTTP 503");
    searchBy({ search_pathology_outlines: down, search_path_pubmed: down });
    expect((await POST(ask("What stains for chromophobe?"))).status).toBe(502);
  });

  it("does not cache an answer built while a search was down", async () => {
    searchBy({ search_pathology_outlines: new Error("HTTP 500"), search_path_pubmed: HITS });
    const { POST } = await loadRoute();
    await POST(ask("What stains for oncocytoma?"));
    const body = await getResponseJson(await POST(ask("What stains for oncocytoma?")));
    expect(body.cached).toBe(false);
  });

  it("serves a repeated question from cache with zero tokens", async () => {
    const { POST } = await loadRoute();
    await POST(ask("What stains for oncocytoma?"));
    const callsAfterFirst = ai.mock.calls.length;
    const body = await getResponseJson(await POST(ask("  what stains for ONCOCYTOMA  ")));
    expect(body).toMatchObject({ cached: true, tokens: 0 });
    expect(ai.mock.calls.length).toBe(callsAfterFirst);
  });

  it("uses knowledge-base marker synonyms: searched and stated to the model", async () => {
    vi.mocked(lookupMarkerAliases).mockResolvedValue([
      { name: "CD117", aliases: ["CD117", "KIT", "c-KIT"] },
    ]);
    mockAi({ query: "CD117 oncocytoma" });
    const { POST } = await loadRoute();
    await POST(ask("Is CD117 positive in oncocytoma?"));
    expect(search).toHaveBeenCalledWith(
      "search_pathology_outlines",
      "CD117 oncocytoma (CD117 / KIT / c-KIT)",
      expect.anything()
    );
    expect(answerCall()![3]).toContain("Same marker: CD117 = KIT = c-KIT.");
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
  });

  it("retries a cut-off table once as a paragraph (padding-loop case)", async () => {
    let answers = 0;
    ai.mockImplementation(async (_p, _m, _k, _prompt, opts) => {
      if (opts?.jsonMode) return { content: JSON.stringify({ ...PLAN, format: "table" }) };
      answers++;
      return answers === 1
        ? {
            content: "| Feature / Diagnosis" + " ".repeat(300) + "| Morphology",
            tokenUsage: { prompt_tokens: 1500, completion_tokens: 600, total_tokens: 2100 },
          }
        : {
            content: "Endometrial carcinoma is ER-positive [1].",
            tokenUsage: { prompt_tokens: 1500, completion_tokens: 30, total_tokens: 1530 },
          };
    });
    const { POST } = await loadRoute();
    const body = await getResponseJson(
      await POST(ask("Endometrial vs endocervical adenocarcinoma"))
    );
    expect(answers).toBe(2);
    expect(ai.mock.calls.filter((c) => !c[4]?.jsonMode)[1][4]?.system).toContain(
      FORMAT_INSTRUCTION.paragraph
    );
    expect(body).toMatchObject({
      answer: "Endometrial carcinoma is ER-positive [1].",
      format: "paragraph",
      tokens: 2100 + 1530,
    });
  });

  it("returns follow-up questions split off the answer", async () => {
    mockAi(
      PLAN,
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

  it("404s when neither corpus returns passages, without an answer call", async () => {
    searchBy({});
    const { POST } = await loadRoute();
    const res = await POST(ask("What stains for oncocytoma?"));
    expect(res.status).toBe(404);
    expect(answerCall()).toBeUndefined();
  });

  it("502s when the answer model fails", async () => {
    ai.mockImplementation(async (_p, _m, _k, _prompt, opts) => {
      if (opts?.jsonMode) return { content: JSON.stringify(PLAN) };
      throw new Error("cloudflare API timeout after 20s");
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
