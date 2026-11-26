import { describe, it, expect } from "vitest";
import { JOKES, jokeAnswer } from "@/features/user/ask-albright/lib/jokes";

describe("jokes", () => {
  it("picks from the curated list and invites a question", () => {
    const first = jokeAnswer(() => 0);
    expect(first.startsWith(JOKES[0])).toBe(true);
    expect(first).toMatch(/\?$/);
    expect(JOKES).toContain(jokeAnswer(() => 0.999).replace(/ (Got a|Now —|Right,).*$/, ""));
  });

  it("keeps the list short, distinct and free of the off-limits subjects", () => {
    expect(new Set(JOKES).size).toBe(JOKES.length);
    for (const j of JOKES) {
      expect(j.length).toBeLessThan(160);
      expect(j).not.toMatch(/\b(die|died|death|dead|autopsy|corpse|cancer patient|terminal)\b/i);
    }
  });
});
