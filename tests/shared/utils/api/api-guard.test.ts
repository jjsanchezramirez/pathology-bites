import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  requireUser,
  requireAdmin,
  requirePermission,
  requireStaff,
  type GuardResult,
} from "@/shared/utils/api/api-guard";

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/test", { headers });
}

function expectFailure(result: GuardResult): NextResponse {
  expect(result).toBeInstanceOf(NextResponse);
  return result as NextResponse;
}

function expectOk(result: GuardResult) {
  expect(result).not.toBeInstanceOf(NextResponse);
  return result as Exclude<GuardResult, NextResponse>;
}

describe("requireUser", () => {
  it("401s when x-user-id is missing", async () => {
    const response = expectFailure(requireUser(requestWith({})));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("passes through userId, validated role and permissions", () => {
    const auth = expectOk(
      requireUser(
        requestWith({
          "x-user-id": "u1",
          "x-user-role": "user",
          "x-user-permissions": "create_questions",
        })
      )
    );
    expect(auth).toMatchObject({ userId: "u1", role: "user", permissions: ["create_questions"] });
    expect(auth.can("create_questions")).toBe(true);
    expect(auth.can("review_questions")).toBe(false);
  });

  it("nulls out an unrecognized role (including retired ones) instead of trusting it", () => {
    for (const role of ["superadmin", "creator", "reviewer"]) {
      const auth = expectOk(requireUser(requestWith({ "x-user-id": "u1", "x-user-role": role })));
      expect(auth.role).toBeNull();
    }
  });

  it("drops unknown permissions from the header", () => {
    const auth = expectOk(
      requireUser(
        requestWith({
          "x-user-id": "u1",
          "x-user-permissions": "delete_everything,review_questions",
        })
      )
    );
    expect(auth.permissions).toEqual(["review_questions"]);
  });

  it("nulls the role and empties permissions when the headers are absent", () => {
    const auth = expectOk(requireUser(requestWith({ "x-user-id": "u1" })));
    expect(auth.role).toBeNull();
    expect(auth.permissions).toEqual([]);
  });

  it("admins hold every permission", () => {
    const auth = expectOk(requireUser(requestWith({ "x-user-id": "a", "x-user-role": "admin" })));
    expect(auth.can("create_questions")).toBe(true);
    expect(auth.can("review_questions")).toBe(true);
  });
});

describe("requireAdmin", () => {
  it("401s before it 403s — unauthenticated wins", () => {
    const response = expectFailure(requireAdmin(requestWith({ "x-user-role": "admin" })));
    expect(response.status).toBe(401);
  });

  it("403s a non-admin even with every permission", async () => {
    const response = expectFailure(
      requireAdmin(
        requestWith({
          "x-user-id": "u1",
          "x-user-role": "user",
          "x-user-permissions": "create_questions,review_questions",
        })
      )
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden - Admin access required" });
  });

  it("admits admins", () => {
    expectOk(requireAdmin(requestWith({ "x-user-id": "a", "x-user-role": "admin" })));
  });
});

describe("requirePermission", () => {
  const writer = requestWith({
    "x-user-id": "w",
    "x-user-role": "user",
    "x-user-permissions": "create_questions",
  });

  it("admits a holder, and admins", () => {
    expectOk(requirePermission(writer, "create_questions"));
    expectOk(
      requirePermission(
        requestWith({ "x-user-id": "a", "x-user-role": "admin" }),
        "review_questions"
      )
    );
  });

  it("403s without the permission and names it", async () => {
    const response = expectFailure(requirePermission(writer, "review_questions"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden - requires review_questions permission",
    });
  });

  it("accepts any of several permissions", () => {
    expectOk(requirePermission(writer, "review_questions", "create_questions"));
  });
});

describe("requireStaff", () => {
  it("admits admins and holders of any permission, not plain users", () => {
    expectOk(requireStaff(requestWith({ "x-user-id": "a", "x-user-role": "admin" })));
    expectOk(
      requireStaff(
        requestWith({
          "x-user-id": "r",
          "x-user-role": "user",
          "x-user-permissions": "review_questions",
        })
      )
    );
    expect(requireStaff(requestWith({ "x-user-id": "u", "x-user-role": "user" }))).toBeInstanceOf(
      NextResponse
    );
  });
});
