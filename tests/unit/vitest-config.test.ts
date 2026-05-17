// Simple test to verify vitest configuration is working
import { describe, it, expect } from "vitest";

describe("Vitest Configuration", () => {
  it("should be able to run tests", () => {
    expect(true).toBe(true);
  });

  it("should have access to globals", () => {
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
  });

  it("should be able to use async/await", async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
