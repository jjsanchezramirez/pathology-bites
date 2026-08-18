/**
 * Tile-source resolution against slow, dead, and cold repositories.
 *
 * Several WSI hosts serve from dynamic backends that spin up on first touch, so
 * the first request after an idle period can blow the 8s budget while the second
 * returns straight away. That used to surface as a hard "unavailable" — with the
 * raw AbortSignal text, "The operation was aborted due to timeout", shown to the
 * reader — and it threw away a question that had already cost an AI call.
 *
 * These pin the two halves of the fix: retry what is transient, and say what
 * happened in language a reader can act on.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { resolveTileSource } from "@/shared/utils/domain/wsi-tilesource";

// A LearnHaem slide: one plain DZI manifest fetch, the shortest path through
// the resolver, so these exercise retry and reporting rather than a repo quirk.
const SLIDE = "https://slides.learnhaem.com/slides/case42.dzi";

const timeoutError = () => Object.assign(new Error("signal timed out"), { name: "TimeoutError" });

const DZI = `<?xml version="1.0"?>
<Image TileSize="256" Overlap="1" Format="jpeg" xmlns="http://schemas.microsoft.com/deepzoom/2008">
  <Size Width="40000" Height="20000"/>
</Image>`;

const okText = (body: string) =>
  ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => body,
    json: async () => ({}),
  }) as unknown as Response;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveTileSource — transient failures", () => {
  it("retries a timed-out manifest instead of declaring the slide unavailable", async () => {
    // Cold on the first touch, awake on the second — the real MGH/KiKoXP shape.
    fetchMock.mockRejectedValueOnce(timeoutError()).mockResolvedValue(okText(DZI));

    const result = await resolveTileSource(SLIDE);

    expect(result.kind).not.toBe("unsupported");
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("retries a 5xx, which is the other way a warming backend answers", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      } as unknown as Response)
      .mockResolvedValue(okText(DZI));

    expect((await resolveTileSource(SLIDE)).kind).not.toBe("unsupported");
  });

  it("does not retry a 404 — the slide is gone, and asking twice only doubles the wait", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as unknown as Response);

    const result = await resolveTileSource(SLIDE);

    expect(result).toMatchObject({ kind: "unsupported" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("resolveTileSource — what the reader is told", () => {
  it("explains a timeout rather than quoting AbortSignal at them", async () => {
    fetchMock.mockRejectedValue(timeoutError());

    const result = await resolveTileSource(SLIDE);

    expect(result).toMatchObject({ kind: "unsupported" });
    const reason = (result as { reason: string }).reason;
    expect(reason).toMatch(/didn't respond in time/i);
    expect(reason).not.toMatch(/abort/i);
  });

  it("distinguishes a slide that is gone from one whose host is unreachable", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as unknown as Response);
    expect((await resolveTileSource(SLIDE)) as { reason: string }).toMatchObject({
      reason: expect.stringMatching(/no longer available/i),
    });

    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect((await resolveTileSource(SLIDE)) as { reason: string }).toMatchObject({
      reason: expect.stringMatching(/couldn't reach/i),
    });
  });
});
