import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockRequest, getResponseJson } from "@tests/helpers/api-test-helpers";

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/features/user/ask-albright/lib/history", () => ({
  HISTORY_KEEP: 100,
  listHistory: vi.fn(),
}));
vi.mock("@/shared/services/server", () => ({ createClient: vi.fn() }));

import { POST } from "@/app/api/user/data-export/route";
import { listHistory } from "@/features/user/ask-albright/lib/history";
import { createClient } from "@/shared/services/server";

/** Chainable, awaitable Supabase stub: every table returns `rows`; single() returns a profile. */
function supabaseStub(rows: unknown[] = []) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) builder[m] = () => builder;
  builder.single = async () => ({ data: { id: "u1", created_at: "2026-01-01" }, error: null });
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null });
  return { from: () => builder };
}

const ENTRY = {
  id: "h1",
  question: "Is CD117 positive in oncocytoma?",
  result: { answer: "Yes [1]." },
  createdAt: "2026-11-24T00:00:00Z",
};

function req(userId: string | null = "u1") {
  return createMockRequest({
    method: "POST",
    url: "http://localhost:3000/api/user/data-export",
    headers: userId ? { "x-user-id": userId } : {},
  });
}

describe("POST /api/user/data-export — Ask Dr. Albright history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(supabaseStub() as never);
  });

  it("includes the caller's Ask Dr. Albright history and its count", async () => {
    vi.mocked(listHistory).mockResolvedValue([ENTRY] as never);
    const body = await getResponseJson(await POST(req()));
    expect(listHistory).toHaveBeenCalledWith("u1", 100);
    expect(body.data.ask_albright_history).toEqual([ENTRY]);
    expect(body.data.statistics.total_ask_albright_questions).toBe(1);
  });

  it("still exports everything else when the history read fails", async () => {
    vi.mocked(listHistory).mockRejectedValue(new Error("db down"));
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await getResponseJson(res);
    expect(body.data.ask_albright_history).toEqual([]);
    expect(body.data.profile).toMatchObject({ id: "u1" });
  });
});
