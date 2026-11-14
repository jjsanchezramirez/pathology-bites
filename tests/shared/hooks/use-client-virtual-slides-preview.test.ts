/**
 * http-only previews go through the tile proxy.
 *
 * Hematopathology eTutorial's previews are the whole-slide tile of its own DZI
 * pyramid, on a host that never answers over https. A page served over https cannot
 * load that image directly (mixed content), so the loader rewrites it to the Worker
 * that already proxies the host's tiles. https previews are left exactly as stored.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { loadAllVirtualSlides } from "@/shared/hooks/use-client-virtual-slides";
import { TILE_PROXY } from "@/shared/utils/domain/wsi-osd-tilesource";

const HEME_PREVIEW =
  "http://www.hematopathologyetutorial.com/01.01+Blood+-+Iron+deficiency+anemia.svs_files/8/0_0.jpeg";
const LEEDS_PREVIEW = "https://images.virtualpathology.leeds.ac.uk/thumb/1.jpg";

const V7_CORPUS = {
  version: "v9",
  bases: {
    preview: {
      "http://www.hematopathologyetutorial.com/": "p1",
      "https://images.virtualpathology.leeds.ac.uk/": "p2",
    },
    case: {},
    other: {},
  },
  data: [
    {
      x: "hemepath_01.01",
      d: "Iron deficiency anemia",
      c: "Hematopathology",
      p: { p1: HEME_PREVIEW.slice("http://www.hematopathologyetutorial.com/".length) },
    },
    {
      x: "leeds_1",
      d: "Follicular lymphoma",
      c: "Hematopathology",
      p: { p2: LEEDS_PREVIEW.slice("https://images.virtualpathology.leeds.ac.uk/".length) },
    },
    { x: "rosai_1", d: "Adenocarcinoma", c: "GI" },
  ],
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes("manifest.json")
      ? { url: "https://data.pathologybites.com/virtual-slides/corpus-x.json.br", hash: "x" }
      : V7_CORPUS;
    return { ok: true, status: 200, json: async () => body };
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("preview URLs", () => {
  it("proxies http-only previews and leaves https ones alone", async () => {
    const slides = await loadAllVirtualSlides();
    const by = Object.fromEntries(slides.map((s) => [s.id, s.preview_image_url]));
    expect(by["hemepath_01.01"]).toBe(`${TILE_PROXY}${HEME_PREVIEW}`);
    expect(by["leeds_1"]).toBe(LEEDS_PREVIEW);
    expect(by["rosai_1"]).toBe("");
  });
});
