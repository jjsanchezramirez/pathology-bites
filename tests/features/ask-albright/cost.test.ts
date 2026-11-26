import { describe, it, expect } from "vitest";
import {
  COST_CAP_USD,
  CostBudget,
  costOf,
  estimateTokens,
  promptRoom,
  worstCase,
} from "@/features/user/ask-albright/lib/cost";

const MISTRAL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

describe("cost", () => {
  it("prices a call from neurons when reported, else from tokens", () => {
    // 1,000 neurons = $0.011
    expect(costOf(MISTRAL, { neurons: 1000, prompt_tokens: 5 })).toBeCloseTo(0.011, 9);
    expect(costOf(MISTRAL, { prompt_tokens: 1_000_000, completion_tokens: 0 })).toBeCloseTo(
      0.351,
      9
    );
    expect(costOf(MISTRAL, { prompt_tokens: 0, completion_tokens: 1_000_000 })).toBeCloseTo(
      0.555,
      9
    );
    expect(costOf(MISTRAL, undefined)).toBe(0);
  });

  it("refuses to price a model it has no price for", () => {
    expect(() => worstCase("@cf/unknown/model", 10, 10)).toThrow(/No price/);
  });

  it("estimates digits and non-ASCII as a token each (dense text must not be underestimated)", () => {
    expect(estimateTokens("a".repeat(340))).toBe(100);
    expect(estimateTokens("EWSR1::FLI1 β")).toBeGreaterThanOrEqual(5);
    expect(estimateTokens("1234567890")).toBe(10);
  });

  it("holds worst cases against the cap and settles actual spend", () => {
    expect(new CostBudget().remaining).toBeCloseTo(COST_CAP_USD, 12);
    const b = new CostBudget(0.001);
    expect(b.hold(0.0006)).toBe(true);
    expect(b.hold(0.0005)).toBe(false); // would exceed the cap while the first is in flight
    b.settle(0.0006, 0.0002);
    expect(b.spent).toBeCloseTo(0.0002, 12);
    expect(b.remaining).toBeCloseTo(0.0008, 12);
  });

  it("gives the prompt room left after reserving the full output cap", () => {
    const room = promptRoom(MISTRAL, COST_CAP_USD, 360);
    expect(worstCase(MISTRAL, room, 360)).toBeLessThanOrEqual(COST_CAP_USD);
    expect(worstCase(MISTRAL, room + 2, 360)).toBeGreaterThan(COST_CAP_USD);
  });
});
