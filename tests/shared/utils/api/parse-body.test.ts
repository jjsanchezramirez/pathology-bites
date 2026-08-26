import { describe, expect, it } from "vitest";
import { apiError } from "@/shared/utils/api/parse-body";

// The standardized API error body is `{ error }` / `{ error, details }`. These
// pin that shape for the parse-path helper (the live consumer); routes otherwise
// produce the same shape inline.
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
