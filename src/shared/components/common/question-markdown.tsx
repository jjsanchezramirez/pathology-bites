"use client";

import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import { Card } from "@/shared/components/ui/card";
import { ImageCarousel } from "@/shared/components/media/image-carousel";

// Remark plugin: turn an image-only paragraph (one or more images, ignoring whitespace
// and soft breaks) into a single block carousel node. This (a) avoids the invalid
// <p><div> nesting react-markdown would otherwise produce when an <img> is swapped for
// the carousel's <div>, and (b) groups consecutive images into ONE carousel using the
// plain ![alt](url "caption") syntax — no UUIDs, no image map, no call-site threading.
// Images mixed inline with text are left untouched (rendered by the `img` component).
type MdNode = {
  type: string;
  value?: string;
  url?: string;
  alt?: string;
  title?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, string> };
};

function remarkImagesToCarousel() {
  return (tree: MdNode) => {
    visit(tree as never, "paragraph", (node: MdNode) => {
      const children = node.children ?? [];
      const images = children.filter((c) => c.type === "image");
      const nonImage = children.filter(
        (c) =>
          c.type !== "image" &&
          c.type !== "break" &&
          !(c.type === "text" && !(c.value ?? "").trim())
      );
      if (images.length === 0 || nonImage.length > 0) return;
      const data = node.data ?? (node.data = {});
      data.hName = "image-carousel";
      data.hProperties = {
        images: JSON.stringify(
          images.map((im) => ({ url: im.url ?? "", alt: im.alt ?? "", caption: im.title ?? "" }))
        ),
      };
      node.children = [];
    });
  };
}

type CarouselImage = { url: string; alt: string; caption?: string };

// The two question carousels (shared ImageCarousel + admin SimpleImageCarousel) share this
// signature, so callers can swap which one renders markdown images per surface.
type QuestionImageCarousel = React.ComponentType<{
  images: CarouselImage[];
  className?: string;
  resetKey?: string;
}>;

interface QuestionMarkdownProps {
  children: string | null | undefined;
  /**
   * Flow-inline rendering: paragraphs collapse to inline content (no block margins).
   * Use for short fields like option text / explanations that live inside another line.
   */
  inline?: boolean;
  className?: string;
  /**
   * Carousel used for image-only paragraphs. Defaults to the full-featured ImageCarousel
   * (lightbox). The admin preview passes SimpleImageCarousel to match the rest of that
   * panel — keep this distinction; the preview deliberately does NOT use the lightbox one.
   */
  imageCarousel?: QuestionImageCarousel;
}

// Static component map for question content (stem, options, teaching point, explanations).
// Compact + color-agnostic: inherits text color from the parent (e.g. text-muted-foreground)
// so it drops into existing containers without restyling. GFM + images: bold/italic, lists,
// tables, code, strikethrough, links. Image-only paragraphs render through an injected
// carousel (see image-carousel below); inline images stay plain. Directive-based embeds
// (video, Anki cards) arrive with #18 and MUST tag their wrappers with `data-no-highlight`
// to stay clickable inside the FakeSelectionHighlight surface (the carousel already does).
const STATIC_COMPONENTS: Components = {
  p: ({ children }) => <p className="leading-relaxed [&:not(:last-child)]:mb-3">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del>{children}</del>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 space-y-1 [&:not(:last-child)]:mb-3">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 space-y-1 [&:not(:last-child)]:mb-3">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/30 pl-3 italic [&:not(:last-child)]:mb-3">
      {children}
    </blockquote>
  ),
  // react-markdown wraps fenced blocks in <pre><code>. Collapse the default <pre> so the
  // custom <code> branch below is the single styled wrapper (avoids nested <pre>).
  pre: ({ children }) => <>{children}</>,
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs [&:not(:last-child)]:mb-3">
          <code>{children}</code>
        </pre>
      );
    }
    return <code className="rounded bg-muted px-1 py-0.5 text-[0.9em] font-mono">{children}</code>;
  },
  // Inline images (mixed with text) stay plain — a carousel <div> can't live inside a <p>.
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element -- markdown image URLs are dynamic/remote
    <img
      src={typeof src === "string" ? src : ""}
      alt={alt || ""}
      loading="lazy"
      className="mx-1 inline-block max-w-full rounded align-middle"
    />
  ),
  table: ({ children }) => (
    <Card className="overflow-hidden [&:not(:last-child)]:mb-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </Card>
  ),
  thead: ({ children }) => <thead className="border-b bg-muted/50">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 border-b last:border-0 align-top">{children}</td>,
  tr: ({ children }) => <tr className="border-b last:border-0">{children}</tr>,
  hr: () => <hr className="my-4 border-border" />,
  // Questions rarely use headings; keep them modest so they don't dwarf the card.
  h1: ({ children }) => (
    <h4 className="font-semibold text-base [&:not(:first-child)]:mt-4 mb-2">{children}</h4>
  ),
  h2: ({ children }) => (
    <h4 className="font-semibold text-base [&:not(:first-child)]:mt-4 mb-2">{children}</h4>
  ),
  h3: ({ children }) => (
    <h5 className="font-semibold [&:not(:first-child)]:mt-3 mb-1.5">{children}</h5>
  ),
  h4: ({ children }) => (
    <h5 className="font-semibold [&:not(:first-child)]:mt-3 mb-1.5">{children}</h5>
  ),
};

export function QuestionMarkdown({
  children,
  inline = false,
  className,
  imageCarousel: Carousel = ImageCarousel,
}: QuestionMarkdownProps) {
  // Block mode groups image-only paragraphs into a carousel; inline mode (option text)
  // skips it — a carousel can't render inside the surrounding inline <span>.
  const remarkPlugins = useMemo(
    () => (inline ? [remarkGfm] : [remarkGfm, remarkImagesToCarousel]),
    [inline]
  );

  const components = useMemo<Components>(() => {
    const map: Components = {
      ...STATIC_COMPONENTS,
      // Lone/grouped images (image-only paragraphs) → the injected carousel.
      // @ts-expect-error -- custom element injected by remarkImagesToCarousel
      "image-carousel": ({ images }: { images?: string }) => {
        let parsed: CarouselImage[] = [];
        try {
          parsed = images ? JSON.parse(images) : [];
        } catch {
          parsed = [];
        }
        if (parsed.length === 0) return null;
        return (
          <div data-no-highlight className="my-3">
            <Carousel images={parsed} className="border rounded-lg" />
          </div>
        );
      },
    };
    if (inline) map.p = ({ children }) => <>{children}</>;
    return map;
  }, [Carousel, inline]);

  const text = (children ?? "").trim();
  if (!text) return null;
  const content = (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
      {text}
    </ReactMarkdown>
  );
  return inline ? (
    <span className={className}>{content}</span>
  ) : (
    <div className={className}>{content}</div>
  );
}
