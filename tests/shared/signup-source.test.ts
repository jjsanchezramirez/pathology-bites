import { describe, it, expect } from "vitest";
import { buildSignupSource, parseSignupSource } from "@/shared/utils/analytics/signup-source";

const NOW = new Date("2026-11-18T12:00:00.000Z");

describe("buildSignupSource", () => {
  it("keeps an external referrer hostname and utm tags", () => {
    const s = buildSignupSource(
      "https://www.pathologybites.com/tools/cell-counter?utm_source=reddit&utm_medium=social&utm_campaign=boards",
      "https://www.google.com/search?q=secret+query",
      NOW
    );
    expect(s).toEqual({
      referrer: "google.com",
      utm_source: "reddit",
      utm_medium: "social",
      utm_campaign: "boards",
      landing_path: "/tools/cell-counter",
      first_seen: NOW.toISOString(),
    });
  });

  it("drops a same-site referrer and a non-URL referrer", () => {
    expect(
      buildSignupSource("https://pathologybites.com/", "https://www.pathologybites.com/x", NOW)
        .referrer
    ).toBeNull();
    expect(buildSignupSource("https://pathologybites.com/", "not a url", NOW).referrer).toBeNull();
  });

  it("caps long values", () => {
    const long = "a".repeat(500);
    const s = buildSignupSource(`https://pathologybites.com/?utm_source=${long}`, "", NOW);
    expect(s.utm_source?.length).toBe(100);
  });
});

describe("parseSignupSource", () => {
  it("round-trips the cookie value", () => {
    const s = buildSignupSource("https://pathologybites.com/?utm_source=x", "", NOW);
    expect(parseSignupSource(encodeURIComponent(JSON.stringify(s)))).toEqual(s);
  });

  it("returns null for missing or malformed values", () => {
    expect(parseSignupSource(undefined)).toBeNull();
    expect(parseSignupSource("%7Bbad")).toBeNull();
    expect(parseSignupSource(encodeURIComponent(JSON.stringify({ a: 1 })))).toBeNull();
  });
});
