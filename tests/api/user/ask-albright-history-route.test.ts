import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockRequest, getResponseJson } from "@tests/helpers/api-test-helpers";

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/features/user/ask-albright/lib/history", () => ({
  listHistory: vi.fn(async () => []),
  clearHistory: vi.fn(async () => undefined),
  setFeedback: vi.fn(async () => true),
}));

import { GET, DELETE, PATCH } from "@/app/api/user/ask-albright/history/route";
import { clearHistory, listHistory, setFeedback } from "@/features/user/ask-albright/lib/history";

const URL_BASE = "http://localhost:3000/api/user/ask-albright/history";
const ID = "0b8a4c1e-2f3d-4a5b-8c6d-7e8f9a0b1c2d";

function req(method: string, query = "", userId: string | null = "user-1", body?: unknown) {
  return createMockRequest({
    method,
    url: `${URL_BASE}${query}`,
    headers: userId ? { "x-user-id": userId } : {},
    ...(body !== undefined ? { body } : {}),
  });
}

describe("/api/user/ask-albright/history", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401s without a signed-in user, touching nothing", async () => {
    expect((await GET(req("GET", "", null))).status).toBe(401);
    expect((await DELETE(req("DELETE", "", null))).status).toBe(401);
    expect(listHistory).not.toHaveBeenCalled();
    expect(clearHistory).not.toHaveBeenCalled();
  });

  it("lists only the caller's entries, limit clamped to 1–50", async () => {
    vi.mocked(listHistory).mockResolvedValue([
      {
        id: ID,
        question: "Q?",
        result: {} as never,
        createdAt: "2026-11-24T00:00:00Z",
        feedback: null,
      },
    ]);
    const body = await getResponseJson(await GET(req("GET", "?limit=500")));
    expect(listHistory).toHaveBeenCalledWith("user-1", 50);
    expect(body.entries).toHaveLength(1);

    await GET(req("GET", "?limit=abc"));
    expect(listHistory).toHaveBeenLastCalledWith("user-1", 20);
  });

  it("502s when the list fails", async () => {
    vi.mocked(listHistory).mockRejectedValue(new Error("db down"));
    expect((await GET(req("GET"))).status).toBe(502);
  });

  it("clears everything, or one entry, always scoped to the caller", async () => {
    expect((await DELETE(req("DELETE"))).status).toBe(200);
    expect(clearHistory).toHaveBeenLastCalledWith("user-1", undefined);

    expect((await DELETE(req("DELETE", `?id=${ID}`))).status).toBe(200);
    expect(clearHistory).toHaveBeenLastCalledWith("user-1", ID);
  });

  it("400s on a malformed id", async () => {
    expect((await DELETE(req("DELETE", "?id=1;drop"))).status).toBe(400);
    expect(clearHistory).not.toHaveBeenCalled();
  });

  it("saves a rating on the caller's own entry", async () => {
    expect((await PATCH(req("PATCH", "", "user-1", { id: ID, rating: -1 }))).status).toBe(200);
    expect(setFeedback).toHaveBeenLastCalledWith("user-1", ID, -1);
    expect((await PATCH(req("PATCH", "", "user-1", { id: ID, rating: 0 }))).status).toBe(200);
    expect(setFeedback).toHaveBeenLastCalledWith("user-1", ID, 0);
  });

  it("rejects a bad rating or id, unauthenticated calls, and unknown entries", async () => {
    expect((await PATCH(req("PATCH", "", "user-1", { id: ID, rating: 5 }))).status).toBe(400);
    expect((await PATCH(req("PATCH", "", "user-1", { id: "x", rating: 1 }))).status).toBe(400);
    expect((await PATCH(req("PATCH", "", null, { id: ID, rating: 1 }))).status).toBe(401);
    expect(setFeedback).not.toHaveBeenCalled();
    vi.mocked(setFeedback).mockResolvedValueOnce(false);
    expect((await PATCH(req("PATCH", "", "user-1", { id: ID, rating: 1 }))).status).toBe(404);
  });
});
