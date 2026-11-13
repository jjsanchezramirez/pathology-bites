/**
 * Manifest-driven hidden sources.
 *
 * The corpus crawler's liveness probe marks a dead source in
 * virtual-slides/manifest.json (`hidden_sources` + `sources[s].prefix`) and leaves its
 * records in the corpus, so the app is the one that has to drop them. Both loaders that
 * read the corpus — the virtual-slides search and the WSI-question cases — must honour
 * it, alongside (never instead of) the hard-coded HIDDEN_REPOS list.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hiddenSlidePrefixesFromManifest,
  isHiddenSlideId,
} from "@/shared/utils/domain/hidden-sources";

const fetchMock = vi.fn();

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/shared/utils/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { loadClientWSIData } from "@/shared/hooks/use-client-wsi-data";
import { loadAllVirtualSlides } from "@/shared/hooks/use-client-virtual-slides";

const HEALTHY_MANIFEST = {
  url: "https://data.pathologybites.com/virtual-slides/corpus-abc.json.br",
  hash: "abc",
  total: 3,
  sources: {
    leeds: { prefix: "leeds_", status: "up", hidden: false },
    learnhaem: { prefix: "learnhaem_", status: "up", hidden: false },
    mgh: { prefix: "mgh_", status: "up", hidden: false },
  },
  hidden_sources: [],
};

describe("hiddenSlidePrefixesFromManifest", () => {
  it("maps hidden_sources to the prefixes the manifest declares", () => {
    const m = {
      sources: {
        mgh: { prefix: "mgh_", status: "down", hidden: true },
        leeds: { prefix: "leeds_", status: "up", hidden: false },
        stjude: { prefix: "SJ", status: "down", hidden: true },
      },
      hidden_sources: ["mgh", "stjude"],
    };
    expect(hiddenSlidePrefixesFromManifest(m)).toEqual(["mgh_", "SJ"]);
  });

  it("also honours sources[s].hidden when hidden_sources is missing", () => {
    const m = { sources: { mgh: { prefix: "mgh_", hidden: true } } };
    expect(hiddenSlidePrefixesFromManifest(m)).toEqual(["mgh_"]);
  });

  it("never guesses a prefix: a hidden source without one is left visible", () => {
    const m = {
      sources: { mystery: { status: "down", hidden: true } },
      hidden_sources: ["mystery"],
    };
    expect(hiddenSlidePrefixesFromManifest(m)).toEqual([]);
  });

  it("returns nothing for a pre-health manifest, a missing manifest, or junk", () => {
    expect(hiddenSlidePrefixesFromManifest({ url: "x", hash: "y", total: 1 })).toEqual([]);
    expect(hiddenSlidePrefixesFromManifest(null)).toEqual([]);
    expect(hiddenSlidePrefixesFromManifest(undefined)).toEqual([]);
    expect(hiddenSlidePrefixesFromManifest("nope")).toEqual([]);
    expect(
      hiddenSlidePrefixesFromManifest({ hidden_sources: "mgh", sources: { mgh: { prefix: 7 } } })
    ).toEqual([]);
    expect(
      hiddenSlidePrefixesFromManifest({ hidden_sources: [1, null, "mgh"], sources: [] })
    ).toEqual([]);
  });

  it("de-duplicates when both signals name the same source", () => {
    const m = {
      sources: { mgh: { prefix: "mgh_", hidden: true } },
      hidden_sources: ["mgh", "mgh"],
    };
    expect(hiddenSlidePrefixesFromManifest(m)).toEqual(["mgh_"]);
  });
});

describe("isHiddenSlideId", () => {
  it("matches on the declared prefix only", () => {
    expect(isHiddenSlideId("mgh_123", ["mgh_"])).toBe(true);
    expect(isHiddenSlideId("SJ0001", ["mgh_", "SJ"])).toBe(true);
    expect(isHiddenSlideId("leeds_1", ["mgh_"])).toBe(false);
    expect(isHiddenSlideId("xmgh_1", ["mgh_"])).toBe(false);
    expect(isHiddenSlideId("mgh_1", [])).toBe(false);
    expect(isHiddenSlideId("", ["mgh_"])).toBe(false);
    expect(isHiddenSlideId(undefined, ["mgh_"])).toBe(false);
  });
});

// --- Wiring: both corpus loaders drop manifest-hidden sources -------------------------

function stubFetch(manifest: unknown, corpus: unknown) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes("manifest.json") ? manifest : corpus;
    return { ok: true, status: 200, json: async () => body };
  });
}

const WSI_CASES = {
  cases: [
    {
      url: "https://pathpresenter.net/public/case?token=abc123",
      chapter: "Breast pathology",
      organ_system: "Breast",
      diagnosis: "Fibrocystic changes",
      tile_source_url: "https://pathpresenter.blob.core.windows.net/data/Breast.dzi",
    },
    {
      url: "https://www.virtualpathology.leeds.ac.uk/slides/library/view.php?path=x",
      chapter: "Hematopathology",
      organ_system: "Lymph node",
      diagnosis: "Follicular lymphoma",
      slide_id: "leeds_9999",
      repository: "Leeds University",
      stain: "H&E",
    },
    {
      url: "https://learnhaem.com/course/x",
      chapter: "Hematopathology",
      organ_system: "Blood",
      diagnosis: "CML",
      slide_id: "learnhaem_42",
      repository: "LearnHaem",
      stain: "Wright-Giemsa",
    },
  ],
};

const V7_CORPUS = {
  version: "v9",
  bases: { preview: {}, case: {}, other: {} },
  data: [
    { x: "leeds_1", d: "Follicular lymphoma", c: "Hematopathology" },
    { x: "learnhaem_1", d: "CML", c: "Hematopathology" },
    { x: "mgh_1", d: "Adenocarcinoma", c: "GI" },
  ],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("WSI-question cases honour the manifest's hidden sources", () => {
  // Module caches persist across tests in this file (one fetch per dataset per session),
  // so the loader is exercised exactly once here — the first call fixes the result.
  it("drops cases whose id carries a hidden prefix and keeps the rest", async () => {
    stubFetch(
      {
        ...HEALTHY_MANIFEST,
        cases: {
          url: "https://data.pathologybites.com/virtual-slides/cases-abc.json",
          hash: "abc",
        },
        sources: { ...HEALTHY_MANIFEST.sources, learnhaem: { prefix: "learnhaem_", hidden: true } },
        hidden_sources: ["learnhaem"],
      },
      WSI_CASES
    );

    const slides = await loadClientWSIData();
    const ids = slides.map((s) => s.id);

    expect(ids).toContain("pathpresenter_1");
    expect(ids).toContain("leeds_9999");
    expect(ids).not.toContain("learnhaem_42");
  });
});

describe("virtual-slides corpus honours both hide switches", () => {
  it("hides the manifest's sources AND the hard-coded HIDDEN_REPOS", async () => {
    stubFetch(
      {
        ...HEALTHY_MANIFEST,
        sources: { ...HEALTHY_MANIFEST.sources, learnhaem: { prefix: "learnhaem_", hidden: true } },
        hidden_sources: ["learnhaem"],
      },
      V7_CORPUS
    );

    const slides = await loadAllVirtualSlides();
    const ids = slides.map((s) => s.id);

    // learnhaem_: hidden by the manifest. mgh_: hidden by HIDDEN_REPOS (repository.ts),
    // even though this manifest says MGH is up — the hard-coded list is never overridden.
    expect(ids).toEqual(["leeds_1"]);
  });
});
