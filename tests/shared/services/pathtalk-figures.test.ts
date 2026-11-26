import { describe, it, expect } from "vitest";
import { figuresFromFrames, hitsFromFrames } from "@/shared/services/pathtalk";

const frame = (items: unknown[]) => [
  { result: { content: [{ type: "text", text: JSON.stringify(items) }] } },
];

describe("PathTalk frames", () => {
  it("reads figures (legend, image_url, href) and skips malformed ones", () => {
    const figs = figuresFromFrames(
      frame([
        {
          legend: "Fig 2. Hans algorithm",
          image_url: "https://x/f.png",
          href: "https://doi.org/1",
          doi: "1",
        },
        { legend: "no image", href: "https://doi.org/2" },
      ])
    );
    expect(figs).toEqual([
      {
        legend: "Fig 2. Hans algorithm",
        imageUrl: "https://x/f.png",
        href: "https://doi.org/1",
        doi: "1",
      },
    ]);
  });

  it("still reads text hits, and throws on an error or missing frame", () => {
    expect(hitsFromFrames(frame([{ title: "T", href: "h", body: "b" }]))).toEqual([
      { title: "T", source: undefined, href: "h", body: "b" },
    ]);
    expect(() => hitsFromFrames([{ error: { message: "boom" } }])).toThrow(/boom/);
    expect(() => figuresFromFrames([])).toThrow(/no result frame/);
  });
});
