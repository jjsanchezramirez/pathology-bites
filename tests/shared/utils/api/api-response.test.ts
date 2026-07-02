import { describe, expect, it } from "vitest";
import { apiError, apiSuccess } from "@/shared/utils/api/api-response";

describe("apiError", () => {
  it("returns { error } with the given status", async () => {
    const res = apiError("Not found", 404);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("includes details only when provided", async () => {
    const res = apiError("Validation failed", 400, { field: "email" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Validation failed",
      details: { field: "email" },
    });
  });

  it("keeps falsy-but-present details (empty array)", async () => {
    const res = apiError("Bad request", 400, []);
    expect(await res.json()).toEqual({ error: "Bad request", details: [] });
  });
});

describe("apiSuccess", () => {
  it("defaults to 200 and passes data through unreshaped", async () => {
    const res = apiSuccess({ success: true, data: [1, 2, 3] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [1, 2, 3] });
  });

  it("honors ResponseInit status", async () => {
    const res = apiSuccess({ id: "x" }, { status: 201 });
    expect(res.status).toBe(201);
  });
});
