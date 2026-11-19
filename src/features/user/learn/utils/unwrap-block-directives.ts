// remark-directive parses `:::image[ids]` (three colons) as a *container*
// directive. A container with no closing `:::` fence runs to the end of its
// parent, so everything written after an image, explainer or checkpoint was
// nested inside it, and the renderer (which ignores those children) silently
// dropped the rest of the lesson. The lesson editor inserts exactly that
// three-colon form, so instead of changing the syntax we treat these
// directives as self-contained blocks: keep the [label] on the directive and
// hoist every other child back out to follow it.

/** Directive names that never wrap content; `key-points` is a real container. */
export const SELF_CONTAINED_DIRECTIVES = new Set(["image", "explainer", "question"]);

interface MdNode {
  type: string;
  name?: string;
  data?: { directiveLabel?: boolean } & Record<string, unknown>;
  children?: MdNode[];
}

export function unwrapSelfContainedDirectives(node: MdNode): void {
  if (!node.children) return;
  const out: MdNode[] = [];
  for (const child of node.children) {
    unwrapSelfContainedDirectives(child);
    if (
      child.type === "containerDirective" &&
      child.name &&
      SELF_CONTAINED_DIRECTIVES.has(child.name) &&
      child.children
    ) {
      const label = child.children.filter((c) => c.data?.directiveLabel);
      const rest = child.children.filter((c) => !c.data?.directiveLabel);
      child.children = label;
      out.push(child, ...rest);
    } else {
      out.push(child);
    }
  }
  node.children = out;
}
