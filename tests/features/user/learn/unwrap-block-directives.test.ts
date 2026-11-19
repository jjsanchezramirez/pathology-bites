import { describe, it, expect } from "vitest";
import { fromMarkdown } from "mdast-util-from-markdown";
import { directive } from "micromark-extension-directive";
import { directiveFromMarkdown } from "mdast-util-directive";
import { unwrapSelfContainedDirectives } from "@/features/user/learn/utils/unwrap-block-directives";

type Node = { type: string; name?: string; depth?: number; children?: Node[] };

function parse(md: string): Node {
  return fromMarkdown(md, {
    extensions: [directive()],
    mdastExtensions: [directiveFromMarkdown()],
  }) as unknown as Node;
}

const outline = (n: Node) => (n.children || []).map((c) => c.type + (c.name ? `:${c.name}` : ""));

describe("unwrapSelfContainedDirectives", () => {
  const md = [
    "Intro",
    ":::explainer[seq]",
    "## Heading",
    ':::image[img]{caption="c"}',
    "more",
    ":::question[q]",
    "## After",
    ':::key-points{heading="k"}',
    "- a",
    ":::",
    "end",
  ].join("\n\n");

  it("without the fix, an unclosed directive swallows the rest of the lesson", () => {
    // Everything up to the key-points closing fence ends up inside the explainer.
    expect(outline(parse(md))).toEqual(["paragraph", "containerDirective:explainer", "paragraph"]);
  });

  it("hoists following content back to the top level", () => {
    const tree = parse(md);
    unwrapSelfContainedDirectives(tree);
    expect(outline(tree)).toEqual([
      "paragraph",
      "containerDirective:explainer",
      "heading",
      "containerDirective:image",
      "paragraph",
      "containerDirective:question",
      "heading",
      "containerDirective:key-points",
      "paragraph",
    ]);
  });

  it("keeps the label on the directive and leaves real containers intact", () => {
    const tree = parse(md);
    unwrapSelfContainedDirectives(tree);
    const image = tree.children!.find((c) => c.name === "image")!;
    expect(image.children).toHaveLength(1);
    const keyPoints = tree.children!.find((c) => c.name === "key-points")!;
    expect(keyPoints.children!.some((c) => c.type === "list")).toBe(true);
  });
});
