import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  requireUser,
  requireRole,
  requireAdmin,
  requireContentRole,
  type GuardResult,
} from "@/shared/utils/api/api-guard";

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/test", { headers });
}

function expectFailure(result: GuardResult): NextResponse {
  expect(result).toBeInstanceOf(NextResponse);
  return result as NextResponse;
}

describe("requireUser", () => {
  it("401s when x-user-id is missing", async () => {
    const response = expectFailure(requireUser(requestWith({})));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("passes through userId and validated role", () => {
    const result = requireUser(requestWith({ "x-user-id": "u1", "x-user-role": "creator" }));
    expect(result).toEqual({ userId: "u1", role: "creator" });
  });

  it("nulls out an unrecognized role instead of trusting it", () => {
    const result = requireUser(requestWith({ "x-user-id": "u1", "x-user-role": "superadmin" }));
    expect(result).toEqual({ userId: "u1", role: null });
  });

  it("nulls the role when the header is absent", () => {
    const result = requireUser(requestWith({ "x-user-id": "u1" }));
    expect(result).toEqual({ userId: "u1", role: null });
  });
});

describe("requireRole", () => {
  it("401s before it 403s — unauthenticated wins", () => {
    const response = expectFailure(requireRole(requestWith({ "x-user-role": "admin" }), ["admin"]));
    expect(response.status).toBe(401);
  });

  it("403s an authenticated user with the wrong role", async () => {
    const response = expectFailure(
      requireRole(requestWith({ "x-user-id": "u1", "x-user-role": "user" }), ["admin"])
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden - Admin access required" });
  });

  it("403s when the role header is missing entirely", () => {
    const response = expectFailure(requireRole(requestWith({ "x-user-id": "u1" }), ["admin"]));
    expect(response.status).toBe(403);
  });

  it("accepts any of the allowed roles", () => {
    const result = requireRole(requestWith({ "x-user-id": "u1", "x-user-role": "reviewer" }), [
      "creator",
      "reviewer",
    ]);
    expect(result).toEqual({ userId: "u1", role: "reviewer" });
  });
});

describe("convenience guards", () => {
  const admin = requestWith({ "x-user-id": "u1", "x-user-role": "admin" });
  const creator = requestWith({ "x-user-id": "u2", "x-user-role": "creator" });
  const user = requestWith({ "x-user-id": "u3", "x-user-role": "user" });

  it("requireAdmin admits only admins", () => {
    expect(requireAdmin(admin)).toEqual({ userId: "u1", role: "admin" });
    expect(requireAdmin(creator)).toBeInstanceOf(NextResponse);
  });

  it("requireContentRole admits admin/creator/reviewer but not user", () => {
    expect(requireContentRole(admin)).not.toBeInstanceOf(NextResponse);
    expect(requireContentRole(creator)).not.toBeInstanceOf(NextResponse);
    expect(requireContentRole(user)).toBeInstanceOf(NextResponse);
  });

  it("multi-role 403 message lists the roles", async () => {
    const response = expectFailure(requireContentRole(user));
    expect(await response.json()).toEqual({
      error: "Forbidden - Admin or Creator or Reviewer access required",
    });
  });
});
