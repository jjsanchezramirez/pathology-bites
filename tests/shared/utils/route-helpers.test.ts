import { describe, it, expect } from "vitest";
import { getSafeRedirectPath } from "@/shared/utils/route-helpers";

describe("getSafeRedirectPath", () => {
  it("returns the fallback for null/undefined/empty", () => {
    expect(getSafeRedirectPath(null)).toBe("/");
    expect(getSafeRedirectPath(undefined)).toBe("/");
    expect(getSafeRedirectPath("")).toBe("/");
    expect(getSafeRedirectPath(null, "/dashboard")).toBe("/dashboard");
  });

  it("accepts normal same-origin paths", () => {
    expect(getSafeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(getSafeRedirectPath("/reset-password")).toBe("/reset-password");
    expect(getSafeRedirectPath("/admin/questions?page=2")).toBe("/admin/questions?page=2");
    expect(getSafeRedirectPath("/e/some-entity")).toBe("/e/some-entity");
  });

  it("rejects protocol-relative URLs (//evil.com)", () => {
    expect(getSafeRedirectPath("//evil.com")).toBe("/");
    expect(getSafeRedirectPath("//evil.com", "/dashboard")).toBe("/dashboard");
    expect(getSafeRedirectPath("//evil.com/phish")).toBe("/");
  });

  it("rejects absolute URLs", () => {
    expect(getSafeRedirectPath("https://evil.com")).toBe("/");
    expect(getSafeRedirectPath("http://evil.com/path")).toBe("/");
    expect(getSafeRedirectPath("javascript:alert(1)")).toBe("/");
  });

  it("rejects backslash-smuggling variants", () => {
    // Browsers treat backslash as a path separator; /\evil.com can resolve off-origin.
    expect(getSafeRedirectPath("/\\evil.com")).toBe("/");
    expect(getSafeRedirectPath("/\\")).toBe("/");
  });

  it("rejects paths not starting with a slash", () => {
    expect(getSafeRedirectPath("evil.com")).toBe("/");
    expect(getSafeRedirectPath("dashboard")).toBe("/");
  });

  it("rejects control characters", () => {
    expect(getSafeRedirectPath("/dashboard")).toBe("/");
    expect(getSafeRedirectPath("/dashboard\t")).toBe("/");
  });
});
