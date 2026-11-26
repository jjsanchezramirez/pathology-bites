import { describe, it, expect } from "vitest";
import {
  isLessonId,
  lessonEmbedPath,
  lessonIdFromLine,
  lessonIframeSnippet,
  lessonMarkdownSnippet,
} from "@/shared/lesson/embed";

const ID = "7106e5c4-e3f8-4c67-aa34-f8da84b9e3c4";

describe("lesson embeds", () => {
  it("recognises ids", () => {
    expect(isLessonId(ID)).toBe(true);
    expect(isLessonId("../../etc")).toBe(false);
    expect(isLessonId("")).toBe(false);
  });

  it("reads the markdown line it writes", () => {
    expect(lessonIdFromLine(lessonMarkdownSnippet(ID))).toBe(ID);
    expect(lessonIdFromLine(`  :::explainer[ ${ID.toUpperCase()} ]  `)).toBe(ID);
  });

  it("ignores anything that isn't a whole embed line", () => {
    expect(lessonIdFromLine(`See :::explainer[${ID}] here`)).toBeNull();
    expect(lessonIdFromLine(":::explainer[not-an-id]")).toBeNull();
    expect(lessonIdFromLine("CD4:CD8 ratio 2:1")).toBeNull();
  });

  it("builds a framed player URL with no markup injection from the title", () => {
    const html = lessonIframeSnippet(ID, "https://pathologybites.com/", 'Bad "title" <script>');
    expect(html).toContain(`src="https://pathologybites.com${lessonEmbedPath(ID)}"`);
    expect(html).toContain('title="Bad title script"');
    expect(html).toContain("allowfullscreen");
  });
});
