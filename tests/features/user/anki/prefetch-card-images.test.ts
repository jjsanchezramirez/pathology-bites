/**
 * Neighbour-card image prefetch. The URLs must match what the viewer's <img>
 * tags request (or the browser cache never hits), only our image host may be
 * fetched, and each URL is requested at most once per session.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AnkiCard } from "@/features/user/anki/types/anki-card";
import {
  collectCardImageUrls,
  prefetchAroundCard,
  __resetPrefetchMemory,
} from "@/features/user/anki/utils/prefetch-card-images";

const card = (id: string, question: string, answer = ""): AnkiCard =>
  ({ id, question, answer, fields: {}, tags: [] }) as unknown as AnkiCard;

const created: string[] = [];
const RealImage = globalThis.Image;

beforeEach(() => {
  __resetPrefetchMemory();
  created.length = 0;
  globalThis.Image = class {
    decoding = "";
    setAttribute() {}
    set src(v: string) {
      created.push(v);
    }
  } as unknown as typeof Image;
});

afterEach(() => {
  globalThis.Image = RealImage;
  vi.restoreAllMocks();
});

describe("collectCardImageUrls", () => {
  it("resolves bare anki filenames to the image host, decoding entities like the browser", () => {
    const urls = collectCardImageUrls(
      // Real card HTML: the converter has already replaced spaces with underscores.
      card("a", '<img src="1A1_Artifact_(Case_1)_H&amp;E_1_595.jpg"> text')
    );
    expect(urls).toHaveLength(1);
    expect(urls[0].startsWith("https://img.pathologybites.com/anki/")).toBe(true);
    expect(decodeURIComponent(urls[0])).toContain("H&E_1_595.jpg");
    expect(urls[0]).not.toContain("&amp;");
  });

  it("keeps absolute image-host URLs and ignores other hosts", () => {
    const urls = collectCardImageUrls(
      card(
        "b",
        '<img src="https://img.pathologybites.com/anki/x.avif"><img src="https://example.com/y.jpg">'
      )
    );
    expect(urls).toEqual(["https://img.pathologybites.com/anki/x.avif"]);
  });
});

describe("prefetchAroundCard", () => {
  const cards = ["c0", "c1", "c2", "c3", "c4", "c5"].map((id) =>
    card(id, `<img src="https://img.pathologybites.com/anki/${id}.avif">`)
  );

  it("fetches the next three cards and the previous one", () => {
    prefetchAroundCard(cards, 1);
    expect(created.map((u) => u.split("/").pop())).toEqual([
      "c2.avif",
      "c3.avif",
      "c4.avif",
      "c0.avif",
    ]);
  });

  it("does not request the same image twice", () => {
    prefetchAroundCard(cards, 1);
    prefetchAroundCard(cards, 2);
    expect(created.filter((u) => u.endsWith("c3.avif"))).toHaveLength(1);
    expect(created.some((u) => u.endsWith("c5.avif"))).toBe(true);
  });

  it("stops at the ends of the list", () => {
    prefetchAroundCard(cards, 5);
    expect(created.map((u) => u.split("/").pop())).toEqual(["c4.avif"]);
  });
});
