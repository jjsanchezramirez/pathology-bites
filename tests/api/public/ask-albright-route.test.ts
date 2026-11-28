import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockRequest } from "@tests/helpers/api-test-helpers";

// Signed-out Ask Dr. Albright: every question that reaches the model or the
// namesake check is kept anonymously for quality control, with its outcome.
// Only I/O is mocked; NoPassagesError, anonLimits etc. stay real.

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/features/user/ask-albright/lib/ask", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/user/ask-albright/lib/ask")>()),
  askAlbright: vi.fn(),
  askAlbrightStream: vi.fn(),
  isAskAlbrightAvailable: vi.fn(() => true),
}));
vi.mock("@/features/user/ask-albright/lib/anon-usage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/user/ask-albright/lib/anon-usage")>()),
  anonLimits: vi.fn(() => ({ free: 3, ipDaily: 20, global: 100 })),
  readVisitor: vi.fn(() => "visitor-1"),
  // A fresh network per request: the route's real per-minute limiter allows 5.
  clientNetwork: vi.fn(() => `net-${Math.random()}`),
  anonRemaining: vi.fn(async () => 2),
  reserveAnon: vi.fn(async () => ({ allowed: true, remaining: 2 })),
  refundAnon: vi.fn(async () => {}),
  recordAnonCost: vi.fn(async () => {}),
}));
vi.mock("@/features/user/ask-albright/lib/history", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/user/ask-albright/lib/history")>()),
  savePublicHistory: vi.fn(async () => {}),
}));
vi.mock("@/features/user/ask-albright/lib/kb-entity", () => ({
  namesakeQuestion: vi.fn(async () => null),
}));
vi.mock("@/shared/services/service-role-client", () => ({ createServiceRoleClient: vi.fn() }));

import { POST } from "@/app/api/public/ask-albright/route";
import {
  askAlbright,
  NoPassagesError,
  type AskResult,
} from "@/features/user/ask-albright/lib/ask";
import { savePublicHistory } from "@/features/user/ask-albright/lib/history";
import { namesakeQuestion } from "@/features/user/ask-albright/lib/kb-entity";
import { refundAnon } from "@/features/user/ask-albright/lib/anon-usage";

const save = vi.mocked(savePublicHistory);
const ask = vi.mocked(askAlbright);

const answer = (extra: Partial<AskResult> = {}) =>
  ({ answer: "CK7 is positive.", citations: [], source: "model", cached: false, ...extra }) as unknown as AskResult;

const post = (question: string) =>
  POST(
    createMockRequest({
      method: "POST",
      url: "http://localhost:3000/api/public/ask-albright",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      body: { question },
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(namesakeQuestion).mockResolvedValue(null);
});

describe("POST /api/public/ask-albright — anonymous quality-control record", () => {
  it("keeps an answered question with its answer", async () => {
    ask.mockResolvedValue(answer());
    const res = await post("What does CK7 stain?");
    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalledWith("What does CK7 stain?", "answered", expect.objectContaining({ answer: "CK7 is positive." }));
  });

  it("keeps a declined question, and still gives the free question back", async () => {
    ask.mockResolvedValue(answer({ scope: "out_of_scope" } as Partial<AskResult>));
    const res = await post("Best pizza in town?");
    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalledWith("Best pizza in town?", "declined", expect.anything());
    expect(refundAnon).toHaveBeenCalled();
  });

  it("keeps a question that found nothing, with no answer", async () => {
    ask.mockRejectedValue(new NoPassagesError("Nothing found"));
    const res = await post("Zzyzx tumour stains?");
    expect(res.status).toBe(404);
    expect(save).toHaveBeenCalledWith("Zzyzx tumour stains?", "not_found", null);
  });

  it("keeps a failed question as failed", async () => {
    ask.mockRejectedValue(new Error("upstream down"));
    const res = await post("What is a Brenner tumour?");
    expect(res.status).toBe(502);
    expect(save).toHaveBeenCalledWith("What is a Brenner tumour?", "failed", null);
  });

  it("keeps a namesake clarifying question", async () => {
    vi.mocked(namesakeQuestion).mockResolvedValue({ question: "Which oncocytoma?" } as never);
    ask.mockResolvedValue(answer({ answer: "Which oncocytoma do you mean?" }));
    const res = await post("oncocytoma");
    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalledWith("oncocytoma", "clarified", expect.anything());
  });

  it("a failing save never fails the answer", async () => {
    save.mockRejectedValueOnce(new Error("db down"));
    ask.mockResolvedValue(answer());
    const res = await post("What does CK7 stain?");
    expect(res.status).toBe(200);
  });
});
