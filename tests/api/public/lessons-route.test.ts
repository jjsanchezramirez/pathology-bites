import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const calls: { eq: [string, unknown][]; select?: string } = { eq: [] };
let row: unknown = null;

vi.mock("@/shared/services/server", () => ({
  createClient: async () => {
    const q = {
      select: (cols: string) => {
        calls.select = cols;
        return q;
      },
      eq: (col: string, val: unknown) => {
        calls.eq.push([col, val]);
        return q;
      },
      maybeSingle: async () => ({ data: row, error: null }),
    };
    return { from: () => q };
  },
}));

import { GET } from "@/app/api/public/lessons/[id]/route";

const ID = "7106e5c4-e3f8-4c67-aa34-f8da84b9e3c4";
const call = (id: string) =>
  GET(new NextRequest(`http://localhost/api/public/lessons/${id}`), {
    params: Promise.resolve({ id }),
  });

describe("GET /api/public/lessons/[id]", () => {
  beforeEach(() => {
    calls.eq = [];
    calls.select = undefined;
    row = null;
  });

  it("only ever asks for a published row", async () => {
    row = { id: ID, title: "Barrett", description: null, sequence_data: { slides: [] } };
    const res = await call(ID);
    expect(res.status).toBe(200);
    expect(calls.eq).toContainEqual(["status", "published"]);
    expect(calls.eq).toContainEqual(["id", ID]);
    expect(calls.select).not.toMatch(/\*|created_by/);
    expect(res.headers.get("cache-control")).toMatch(/s-maxage/);
    expect((await res.json()).lesson.title).toBe("Barrett");
  });

  it("404s drafts and unknown ids", async () => {
    expect((await call(ID)).status).toBe(404);
  });

  it("404s malformed ids without querying", async () => {
    expect((await call("../users")).status).toBe(404);
    expect(calls.eq).toEqual([]);
  });
});
