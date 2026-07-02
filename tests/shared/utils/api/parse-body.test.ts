import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/shared/utils/api/parse-body";

const schema = z.object({
  title: z.string().min(1),
  count: z.number().int().min(1).max(100),
});

function jsonRequest(body: string): Request {
  return new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("parseBody", () => {
  it("returns parsed data for a valid body", async () => {
    const result = await parseBody(jsonRequest(JSON.stringify({ title: "hi", count: 5 })), schema);
    expect(result).toEqual({ title: "hi", count: 5 });
  });

  it("strips unknown keys (zod object default)", async () => {
    const result = await parseBody(
      jsonRequest(JSON.stringify({ title: "hi", count: 5, extra: true })),
      schema
    );
    expect(result).toEqual({ title: "hi", count: 5 });
  });

  it("400s on invalid JSON", async () => {
    const result = await parseBody(jsonRequest("{not json"), schema);
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("400s with flattened issues on schema mismatch", async () => {
    const result = await parseBody(jsonRequest(JSON.stringify({ title: "", count: 999 })), schema);
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details.fieldErrors).toHaveProperty("title");
    expect(body.details.fieldErrors).toHaveProperty("count");
  });
});
