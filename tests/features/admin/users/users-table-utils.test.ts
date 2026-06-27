/**
 * Unit tests for the pure helpers extracted from users-table.tsx.
 */
import { describe, it, expect } from "vitest";
import {
  getPageNumbers,
  getUserDisplayName,
  type User,
} from "@/features/admin/users/components/users-table-utils";

function u(p: Partial<User>): User {
  return {
    id: "x",
    email: null,
    first_name: null,
    last_name: null,
    role: "user",
    user_type: "student",
    status: "active",
    created_at: "",
    updated_at: "",
    ...p,
  };
}

describe("getUserDisplayName", () => {
  it("uses 'first last' when both names are present", () => {
    expect(getUserDisplayName(u({ first_name: "Ada", last_name: "Lovelace" }))).toBe(
      "Ada Lovelace"
    );
  });

  it("falls back to email when a name part is missing", () => {
    expect(getUserDisplayName(u({ first_name: "Ada", last_name: null, email: "ada@x.io" }))).toBe(
      "ada@x.io"
    );
    expect(getUserDisplayName(u({ email: "only@x.io" }))).toBe("only@x.io");
  });

  it("falls back to 'Unknown User' with neither name nor email", () => {
    expect(getUserDisplayName(u({ email: null }))).toBe("Unknown User");
  });
});

describe("getPageNumbers", () => {
  it("lists every page when there are 7 or fewer", () => {
    expect(getPageNumbers(2, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("shows a trailing ellipsis near the start", () => {
    expect(getPageNumbers(0, 10)).toEqual([0, 1, "ellipsis", 9]);
  });

  it("shows a leading ellipsis near the end", () => {
    expect(getPageNumbers(9, 10)).toEqual([0, "ellipsis", 8, 9]);
  });

  it("shows both ellipses in the middle", () => {
    expect(getPageNumbers(5, 12)).toEqual([0, "ellipsis", 4, 5, 6, "ellipsis", 11]);
  });
});
