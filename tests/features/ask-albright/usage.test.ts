import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
const rpc = vi.fn();
vi.mock("@/shared/services/service-role-client", () => ({
  createServiceRoleClient: () => ({ rpc }),
}));

import {
  budgetMessage,
  recordCost,
  reserveQuestion,
  userDailyLimit,
} from "@/features/user/ask-albright/lib/usage";

describe("daily usage limits", () => {
  beforeEach(() => {
    rpc.mockResolvedValue({ data: { allowed: true }, error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reads the per-user daily limit from the environment", () => {
    expect(userDailyLimit()).toBe(50);
    vi.stubEnv("ASK_ALBRIGHT_USER_DAILY", "20");
    expect(userDailyLimit()).toBe(20);
    vi.stubEnv("ASK_ALBRIGHT_USER_DAILY", "nonsense");
    expect(userDailyLimit()).toBe(50);
  });

  it("names the spend cap that was reached", async () => {
    rpc.mockResolvedValue({
      data: { allowed: false, reason: "global", period: "week" },
      error: null,
    });
    expect(await reserveQuestion("u1")).toEqual({
      allowed: false,
      reason: "global",
      period: "week",
    });
    expect(budgetMessage("week")).toMatch(/this week's limit/);
    expect(budgetMessage("day")).toMatch(/today's limit/);
  });

  it("reserves through the RPC with the limits", async () => {
    rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    expect(await reserveQuestion("u1")).toEqual({ allowed: true });
    expect(rpc).toHaveBeenCalledWith("ask_albright_reserve", {
      p_user: "u1",
      p_user_max: 50,
      p_global_max: 2_000_000_000, // spend caps live in the database
    });
    rpc.mockResolvedValue({ data: { allowed: false, reason: "global" }, error: null });
    expect(await reserveQuestion("u1")).toEqual({
      allowed: false,
      reason: "global",
      period: "day",
    });
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

  it("gives admins no per-user cap but keeps the global budget", async () => {
    rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    await reserveQuestion("admin-1", { uncapped: true });
    expect(rpc).toHaveBeenLastCalledWith("ask_albright_reserve", {
      p_user: "admin-1",
      p_user_max: 2_000_000_000,
      p_global_max: 2_000_000_000,
    });
  });
});
