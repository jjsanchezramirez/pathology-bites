import { describe, it, expect } from "vitest";
import {
  buildCheckpoints,
  extractImageIds,
  extractQuestionIds,
  imageIdsFromSections,
} from "@/features/user/learn/utils/lesson-references";
import type { LessonContent } from "@/features/user/learn/types";

const Q1 = "a0e0467e-07bb-4266-b340-4f028e0b6b77";
const Q2 = "3b500ffe-51f1-4040-8fae-b2c457323bb4";

describe("extractImageIds", () => {
  it("collects ids from every image directive in order", () => {
    const md = 'Intro\n:::image[a, b]{caption="x"}\ntext\n:::image[c]\n';
    expect(extractImageIds(md)).toEqual(["a", "b", "c"]);
  });
});

describe("extractQuestionIds", () => {
  it("collects unique UUIDs from question directives", () => {
    const md = `:::question[${Q1}]\nmore\n:::question[${Q2}]\n:::question[${Q1}]`;
    expect(extractQuestionIds(md)).toEqual([Q1, Q2]);
  });

  it("ignores placeholders and malformed ids", () => {
    expect(extractQuestionIds(":::question[question-id]\n:::question[1; drop]")).toEqual([]);
  });

  it("returns an empty list when there are no checkpoints", () => {
    expect(extractQuestionIds("# Just text")).toEqual([]);
  });
});

describe("imageIdsFromSections", () => {
  it("reads image ids from legacy JSON sections", () => {
    const content = {
      version: 1,
      sections: [
        { type: "text", id: "t", blocks: [] },
        { type: "image", id: "i", imageIds: ["x", "y"] },
      ],
    } as LessonContent;
    expect(imageIdsFromSections(content)).toEqual(["x", "y"]);
    expect(imageIdsFromSections(null)).toEqual([]);
  });
});

describe("buildCheckpoints", () => {
  const options = [
    {
      id: "o2",
      question_id: Q1,
      text: "LGD",
      is_correct: true,
      explanation: "yes",
      order_index: 1,
    },
    {
      id: "o1",
      question_id: Q1,
      text: "NDBE",
      is_correct: false,
      explanation: "no",
      order_index: 0,
    },
  ];
  const images = [
    {
      question_id: Q1,
      question_section: "explanation",
      order_index: 0,
      image: { id: "i2", url: "https://img/2", alt_text: null },
    },
    {
      question_id: Q1,
      question_section: "stem",
      order_index: 0,
      image: { id: "i1", url: "https://img/1", alt_text: "Barrett" },
    },
  ];

  it("maps a published question with ordered options and split images", () => {
    const out = buildCheckpoints(
      [{ id: Q1, stem: "Grade?", teaching_point: "Four lines", status: "published" }],
      options,
      images
    );
    expect(Object.keys(out)).toEqual([Q1]);
    expect(out[Q1].options.map((o) => o.text)).toEqual(["NDBE", "LGD"]);
    expect(out[Q1].stemImages).toEqual([{ url: "https://img/1", alt: "Barrett" }]);
    expect(out[Q1].explanationImages).toEqual([{ url: "https://img/2", alt: "Question image" }]);
    expect(out[Q1].teachingPoint).toBe("Four lines");
  });

  it("drops draft questions even if a row slips through", () => {
    const out = buildCheckpoints(
      [{ id: Q1, stem: "Grade?", teaching_point: null, status: "draft" }],
      options,
      images
    );
    expect(out).toEqual({});
  });

  it("drops questions without exactly one correct option", () => {
    const out = buildCheckpoints(
      [{ id: Q1, stem: "Grade?", teaching_point: null, status: "published" }],
      options.map((o) => ({ ...o, is_correct: true })),
      []
    );
    expect(out).toEqual({});
  });
});
