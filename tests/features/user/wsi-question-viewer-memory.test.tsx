/**
 * The viewer's pan/zoom survives a layout switch.
 *
 * Classic and full screen put the viewer in different parts of the tree, so React
 * unmounts and remounts it and OSD's viewport dies with the instance. Without the
 * hand-off below, flipping to full screen to look closer would drop the reader
 * back to the fitted whole-slide view — losing the exact field they flipped for.
 *
 * The memory is deliberately per-slide: a new question must open on its own terms,
 * never at the last one's coordinates.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const captured = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));

vi.mock("@/shared/components/common/self-hosted-osd-viewer", () => ({
  SelfHostedOSDViewer: (props: Record<string, unknown>) => {
    captured.props.push(props);
    return <div data-testid="osd" />;
  },
}));

import { WSIQuestionViewer } from "@/features/user/wsi-questions/components/wsi-question-viewer";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

const slide = (id: string) =>
  ({
    id,
    slide_url: `https://pathpresenter.net/public/case?token=${id}`,
    tileSourceUrl: `https://pathpresenter.blob.core.windows.net/${id}.dzi`,
    repository: "PathPresenter",
    category: "Breast pathology",
  }) as unknown as VirtualSlide;

// Image space (slide pixels, screen-px-per-image-px), not viewport space — see
// SavedView. Viewport zoom is a fraction of image width, so restoring it into a
// differently sized container ratchets the slide outward on every switch.
const VIEW = { imageCenter: { x: 18400, y: 9250 }, imageZoom: 0.42, rotation: 90, flip: false };

const last = () => captured.props[captured.props.length - 1];

beforeEach(() => {
  captured.props = [];
});

describe("WSIQuestionViewer — what it will open", () => {
  it("opens a curated slide that has no DZI, via its repository", async () => {
    render(
      <WSIQuestionViewer
        slide={
          {
            id: "who_31196",
            slide_url: "https://tumourclassification.iarc.who.int/Viewer/Index2?fid=31196",
            repository: "WHO Blue Books Online",
            category: "Hematopathology",
          } as unknown as VirtualSlide
        }
      />
    );

    // The resolver opens WHO by host — demanding a manifest rejected every
    // curated haematolymphoid case with "no tile source".
    await screen.findByTestId("osd");
    expect(last().tileSourceUrl).toBeUndefined();
    expect(last().slideUrl).toContain("tumourclassification.iarc.who.int");
  });

  it("refuses a slide from a repository the viewer cannot open", () => {
    render(
      <WSIQuestionViewer
        slide={
          {
            id: "recutclub_12",
            slide_url: "https://www.recutclub.com/case/12",
            repository: "Recut Club",
          } as unknown as VirtualSlide
        }
      />
    );

    expect(screen.getByText(/cannot be opened in the viewer/i)).toBeTruthy();
  });
});

describe("WSIQuestionViewer view memory", () => {
  it("hands the last view back when the same slide remounts", async () => {
    const first = render(<WSIQuestionViewer slide={slide("s1")} />);
    await screen.findByTestId("osd");

    // Nothing to restore on a first open.
    expect(last().initialView).toBeUndefined();

    // The viewer reports its view whenever motion settles.
    (last().onViewChange as (v: typeof VIEW) => void)(VIEW);
    first.unmount();

    render(<WSIQuestionViewer slide={slide("s1")} fillHeight />);
    await screen.findByTestId("osd");

    expect(last().initialView).toEqual(VIEW);
  });

  it("opens a different slide fitted, not at the previous slide's coordinates", async () => {
    const first = render(<WSIQuestionViewer slide={slide("s1")} />);
    await screen.findByTestId("osd");
    (last().onViewChange as (v: typeof VIEW) => void)(VIEW);
    first.unmount();

    render(<WSIQuestionViewer slide={slide("s2")} />);
    await screen.findByTestId("osd");

    expect(last().initialView).toBeUndefined();
  });
});
