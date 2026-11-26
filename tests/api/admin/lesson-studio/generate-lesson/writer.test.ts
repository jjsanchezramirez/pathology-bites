import { describe, it, expect } from "vitest";
import {
  buildWriterPrompt,
  parseWriterResponse,
  suggestedPointer,
} from "@/app/api/admin/lesson-studio/generate-lesson/writer";
import type {
  ImageInput,
  VisionResult,
} from "@/app/api/admin/lesson-studio/generate-lesson/vision";
import { lessonFromScript } from "@/shared/lesson/templates";

const IMG: ImageInput = {
  url: "https://img.pathologybites.com/library/barrett.jpg",
  title: "Barrett esophagus with goblet cells",
  description: "Intestinal metaplasia",
  category: "microscopic",
  magnification: "medium",
  width: 800,
  height: 600,
};

const SEEN: VisionResult = {
  canSeeImage: true,
  featurePosition: { x: 50, y: 40 },
  suggestedLabel: "Goblet cells",
  annotationTool: "spotlight",
  annotationReason: "",
  objectSize: "small",
};

const answer = (scenes: unknown[]) => JSON.stringify({ title: "Barrett", scenes });

describe("suggestedPointer", () => {
  it("boxes the feature by its size and keeps the box on the picture", () => {
    expect(suggestedPointer(SEEN)).toEqual({
      region: { x: 41, y: 31, w: 18, h: 18 },
      mark: "spotlight",
      label: "Goblet cells",
    });
    const edge = suggestedPointer({
      ...SEEN,
      featurePosition: { x: 99, y: 1 },
      objectSize: "large",
    });
    expect(edge!.region).toEqual({ x: 60, y: 0, w: 40, h: 40 });
  });

  it("offers nothing when vision found nothing", () => {
    expect(suggestedPointer(undefined)).toBeNull();
    expect(suggestedPointer({ ...SEEN, annotationTool: "none" })).toBeNull();
    expect(suggestedPointer({ ...SEEN, canSeeImage: false })).toBeNull();
  });
});

describe("buildWriterPrompt", () => {
  it("lists the pictures with what vision found", () => {
    const p = buildWriterPrompt({ topic: "Barrett", minutes: 2, images: [IMG], vision: [SEEN] });
    expect(p).toContain("[0] microscopic, medium power: Barrett esophagus with goblet cells");
    expect(p).toContain('vision found "Goblet cells"');
    expect(p).toContain("about 22 sentences");
  });
});

describe("parseWriterResponse", () => {
  it("binds picture numbers to library images and keeps regions", () => {
    const raw =
      "```json\n" +
      answer([
        {
          template: "title",
          heading: "Barrett",
          beats: [{ say: "Barrett esophagus.", text: "Diagnosis" }],
        },
        {
          template: "image",
          heading: "Goblet cells",
          image: 0,
          beats: [
            { say: "Look here.", text: "Goblet cell", region: { x: 10, y: 10, w: 20, h: 20 } },
          ],
        },
      ]) +
      "\n```";
    const { script } = parseWriterResponse(raw, [IMG], [SEEN]);
    const scene = script.scenes[1];
    expect(scene.image).toMatchObject({ url: IMG.url, width: 800, height: 600 });
    expect(scene.beats[0].region).toEqual({ x: 10, y: 10, w: 20, h: 20 });
    // The result is exactly what the canvas editor imports.
    expect(lessonFromScript(script).slides).toHaveLength(2);
  });

  it("points from vision when the model gave an image scene no region", () => {
    const { script, warnings } = parseWriterResponse(
      answer([
        {
          template: "image",
          heading: "Goblet cells",
          image: 0,
          beats: [{ say: "Look.", text: "Goblet" }],
        },
      ]),
      [IMG],
      [SEEN]
    );
    expect(script.scenes[0].beats[0]).toMatchObject({
      region: { x: 41, y: 31, w: 18, h: 18 },
      mark: "spotlight",
    });
    expect(warnings.join(" ")).toMatch(/pointer placed from vision/);
  });

  it("turns a scene with a made-up picture into a list", () => {
    const { script, warnings } = parseWriterResponse(
      answer([
        {
          template: "image",
          heading: "Imaginary",
          image: 4,
          beats: [{ say: "Here.", text: "Thing", region: { x: 1, y: 1, w: 9, h: 9 } }],
        },
      ]),
      [IMG],
      [SEEN]
    );
    expect(script.scenes[0].template).toBe("takehome");
    expect(script.scenes[0].image).toBeUndefined();
    expect(script.scenes[0].beats[0].region).toBeUndefined();
    expect(warnings.join(" ")).toMatch(/wasn't provided/);
  });

  it("clamps regions into the picture and drops junk fields", () => {
    const { script } = parseWriterResponse(
      answer([
        {
          template: "image",
          heading: "x",
          image: "0",
          beats: [{ say: "a", text: "b", region: { x: 95, y: -10, w: 30, h: 30 }, mark: "laser" }],
        },
      ]),
      [IMG],
      []
    );
    expect(script.scenes[0].beats[0].region).toEqual({ x: 70, y: 0, w: 30, h: 30 });
    expect(script.scenes[0].beats[0].mark).toBeUndefined();
  });

  it("throws on answers that can't become a lesson, so the next model is tried", () => {
    expect(() => parseWriterResponse("sorry, I can't", [], [])).toThrow();
    expect(() => parseWriterResponse(JSON.stringify({ scenes: [] }), [], [])).toThrow(/validate/);
    expect(() =>
      parseWriterResponse(
        answer([{ template: "takehome", heading: "x", beats: [{ say: " " }] }]),
        [],
        []
      )
    ).toThrow(/no narration/);
    expect(() =>
      parseWriterResponse(answer([{ template: "poster", beats: ["Hi."] }]), [], [])
    ).toThrow(/validate/);
  });
});
