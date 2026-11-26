import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/shared/services/service-role-client", () => ({ createServiceRoleClient: vi.fn() }));

import { ANON_COOKIE, anonLimits, clientNetwork, readVisitor } from "./anon-usage";

const req = (headers: Record<string, string>) =>
  new NextRequest("https://pathologybites.com/api/public/ask-albright", { headers });

describe("clientNetwork", () => {
  it("prefers Cloudflare's address over Vercel's forwarded-for", () => {
    expect(
      clientNetwork(req({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "172.64.0.1" }))
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then the first forwarded-for hop", () => {
    expect(clientNetwork(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientNetwork(req({ "x-forwarded-for": "198.51.100.3, 10.0.0.1" }))).toBe(
      "198.51.100.3"
    );
  });

  it("counts IPv6 per /64, however the address is written", () => {
    const a = clientNetwork(req({ "cf-connecting-ip": "2001:db8:abcd:12::1" }));
    const b = clientNetwork(req({ "cf-connecting-ip": "2001:DB8:abcd:12:ffff:1:2:3" }));
    expect(a).toBe("2001:db8:abcd:12::/64");
    expect(b).toBe(a);
    expect(clientNetwork(req({ "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8:0:0::/64");
  });

  it("is null when no address is known", () => {
    expect(clientNetwork(req({}))).toBeNull();
  });
});

describe("readVisitor", () => {
  // (jsdom drops a literal Cookie header, so set it through the cookie jar.)
  const withCookie = (value: string) => {
    const r = req({});
    r.cookies.set(ANON_COOKIE, value);
    return r;
  };

  it("accepts only a v4 UUID", () => {
    const id = "3f2b8c1e-9d4a-4b7e-8f21-0a1b2c3d4e5f";
    expect(readVisitor(withCookie(id))).toBe(id);
    expect(readVisitor(withCookie("../../etc"))).toBeNull();
    expect(readVisitor(req({}))).toBeNull();
  });
});

describe("anonLimits", () => {
  it("defaults to 3 free, 10 per network, 250 answers a day", () => {
    expect(anonLimits()).toEqual({ free: 3, ipDaily: 10, global: 250 });
  });

  it("a $0 budget switches the teaser off", () => {
    vi.stubEnv("ASK_ALBRIGHT_ANON_DAILY_BUDGET_USD", "0");
    expect(anonLimits().global).toBe(0);
    vi.unstubAllEnvs();
  });
});
