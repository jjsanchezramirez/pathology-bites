import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
const rpc = vi.fn();
vi.mock("@/shared/services/service-role-client", () => ({
  createServiceRoleClient: () => ({ rpc }),
}));

import { dailyLimits, recordCost, reserveQuestion } from "@/features/user/ask-albright/lib/usage";

describe("daily usage limits", () => {
  beforeEach(() => {
    rpc.mockResolvedValue({ data: { allowed: true }, error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("turns the daily budget into a question count at the per-answer cap", () => {
    expect(dailyLimits()).toEqual({ perUser: 50, global: 1000 }); // $2 / $0.002
    vi.stubEnv("ASK_ALBRIGHT_USER_DAILY", "20");
    vi.stubEnv("ASK_ALBRIGHT_DAILY_BUDGET_USD", "0.5");
    expect(dailyLimits()).toEqual({ perUser: 20, global: 250 });
    vi.stubEnv("ASK_ALBRIGHT_USER_DAILY", "nonsense");
    expect(dailyLimits().perUser).toBe(50);
  });

  it("reserves through the RPC with the limits", async () => {
    rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    expect(await reserveQuestion("u1")).toEqual({ allowed: true });
    expect(rpc).toHaveBeenCalledWith("ask_albright_reserve", {
      p_user: "u1",
      p_user_max: 50,
      p_global_max: 1000,
    });
    rpc.mockResolvedValue({ data: { allowed: false, reason: "global" }, error: null });
    expect(await reserveQuestion("u1")).toEqual({ allowed: false, reason: "global" });
  });

  it("fails closed when the RPC returns an error (e.g. migration not applied)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });
    expect(await reserveQuestion("u1")).toEqual({ allowed: false, reason: "unavailable" });
  });

  it("fails closed when the RPC call itself fails", async () => {
    // A synchronous throw: Vitest flags a mock's rejected promise even when the code catches it.
    rpc.mockImplementation(() => {
      throw new Error("network");
    });
    expect(await reserveQuestion("u1")).toEqual({ allowed: false, reason: "unavailable" });
  });

  it("records positive costs only", async () => {
    await recordCost("u1", 0);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: null });
    await recordCost("u1", 0.00071234567);
    expect(rpc).toHaveBeenCalledWith("ask_albright_record_cost", {
      p_user: "u1",
      p_cost: 0.000712,
    });
  });

  it("never throws when recording fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    await expect(recordCost("u1", 0.0005)).resolves.toBeUndefined();
  });
});
