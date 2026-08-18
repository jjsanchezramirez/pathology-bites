/**
 * The corpus → VirtualSlide transform, pinned on the one field the viewer cannot
 * work without.
 *
 * PathPresenter's `url` is a Vue case page, not a slide. The in-house viewer
 * renders from `tileSourceUrl` (the Deep Zoom manifest resolved ahead of time and
 * published with the corpus as `tile_source_url`). Drop that mapping and every
 * question silently falls out of the pool — the failure is a "no slides
 * available" error far from its cause, so it is worth a test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/shared/utils/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { loadClientWSIData } from "@/shared/hooks/use-client-wsi-data";

const CORPUS = {
  cases: [
    {
      url: "https://pathpresenter.net/public/case?token=abc123",
      chapter: "Breast pathology",
      organ_system: "Breast",
      diagnosis: "Fibrocystic changes",
      clinical_history: "42 year old female.",
      tile_source_url: "https://pathpresenter.blob.core.windows.net/data/Breast, FCC.dzi",
    },
    {
      url: "https://pathpresenter.net/public/case?token=def456",
      chapter: "Bone pathology",
      organ_system: "Bone",
      diagnosis: "Enchondroma",
      // No pyramid was ever built for this one.
    },
    {
      // A curated WHO haematolymphoid case: a virtual-slides record paired with
      // the WHO entity as its answer. No DZI — the resolver opens Leeds by host.
      url: "https://www.virtualpathology.leeds.ac.uk/slides/library/view.php?path=x",
      chapter: "Hematopathology",
      organ_system: "Lymph node",
      diagnosis: "Follicular lymphoma",
      slide_id: "leeds_9999",
      repository: "Leeds University",
      stain: "H&E",
      preview_image_url: "https://images.virtualpathology.leeds.ac.uk/thumb.jpg",
    },
  ],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("client WSI corpus transform", () => {
  it("carries tile_source_url through to tileSourceUrl, and leaves it unset when absent", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => CORPUS });

    const slides = await loadClientWSIData();

    expect(slides).toHaveLength(3);
    expect(slides[0].tileSourceUrl).toBe(
      "https://pathpresenter.blob.core.windows.net/data/Breast, FCC.dzi"
    );
    // The case page is kept separately — it is what "View Original" links to.
    expect(slides[0].slide_url).toBe("https://pathpresenter.net/public/case?token=abc123");
    expect(slides[1].tileSourceUrl).toBeUndefined();
  });

  it("keeps a curated case's own id, repository and stain", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => CORPUS });

    const slides = await loadClientWSIData();
    const haem = slides.find((s) => s.category === "Hematopathology");

    // The corpus id is carried verbatim: the history tracker de-duplicates on it,
    // and a positional "pathpresenter_N" id would collide across republishes.
    expect(haem?.id).toBe("leeds_9999");
    // Repository drives the tile-source resolver AND the credit line — defaulting
    // it to PathPresenter would both break the viewer and misattribute the slide.
    expect(haem?.repository).toBe("Leeds University");
    expect(haem?.stain_type).toBe("H&E");
    expect(haem?.preview_image_url).toBe("https://images.virtualpathology.leeds.ac.uk/thumb.jpg");
  });

  it("still numbers PathPresenter cases, which carry no id of their own", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => CORPUS });

    const slides = await loadClientWSIData();
    expect(slides[0].id).toBe("pathpresenter_1");
    expect(slides[0].repository).toBe("PathPresenter");
  });
});
