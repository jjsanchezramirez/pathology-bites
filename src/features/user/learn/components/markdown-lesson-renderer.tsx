"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import { ImageCarousel } from "@/shared/components/media/image-carousel";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Lightbulb } from "lucide-react";
import { LessonEmbed } from "@/shared/components/explainer/lesson-embed";
import type { LessonCheckpoint as LessonCheckpointData } from "../types";
import { LessonCheckpoint } from "./lesson-checkpoint";
import { extractImageIds } from "../utils/lesson-references";
import { unwrapSelfContainedDirectives } from "../utils/unwrap-block-directives";

export { extractImageIds };

// Custom remark plugin: transforms directive AST nodes into custom hast elements
// that react-markdown can render via the components map.
function remarkCustomDirectives() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    // An unclosed `:::image[...]`, `:::explainer[...]` or `:::question[...]`
    // would otherwise swallow the rest of the lesson as its children.
    unwrapSelfContainedDirectives(tree);
    visit(
      tree,
      (node: { type: string }) =>
        node.type === "leafDirective" || node.type === "containerDirective",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node: any) => {
        const data = node.data || (node.data = {});
        const attributes = node.attributes || {};
        const name = node.name as string;

        // Extract label text from children (the [bracket] part of :::name[label])
        function getLabel(): string {
          const children = node.children as Array<{
            type: string;
            value?: string;
            children?: Array<{ value: string }>;
          }>;
          if (!children || children.length === 0) return "";
          return children
            .map((c) => {
              if (c.type === "text") return c.value || "";
              if (c.children) return c.children.map((cc) => cc.value || "").join("");
              return "";
            })
            .join("");
        }

        if (name === "image") {
          // Leaf directive: :::image[uuid1,uuid2]
          data.hName = "image-directive";
          data.hProperties = {
            imageIds: getLabel(),
            caption: attributes.caption || "",
          };
        } else if (name === "explainer") {
          // Leaf directive: :::explainer[sequence-id]
          data.hName = "explainer-directive";
          data.hProperties = {
            sequenceId: getLabel(),
          };
        } else if (name === "question") {
          // Leaf directive: :::question[question-id] (question-bank checkpoint)
          data.hName = "question-directive";
          data.hProperties = {
            questionId: getLabel().trim(),
          };
        } else if (name === "key-points") {
          // Container directive: :::key-points ... :::
          data.hName = "key-points-directive";
          data.hProperties = {
            heading: attributes.heading || "",
          };
        }
      }
    );
  };
}

interface MarkdownLessonRendererProps {
  markdown: string;
  images: { id: string; url: string; alt_text: string | null }[];
  /** Resolved question-bank checkpoints keyed by question id (from the lesson API). */
  checkpoints?: Record<string, LessonCheckpointData>;
}

export function MarkdownLessonRenderer({
  markdown,
  images,
  checkpoints,
}: MarkdownLessonRendererProps) {
  const remarkPlugins = useMemo(() => [remarkDirective, remarkCustomDirectives, remarkGfm], []);

  return (
    <div className="lesson-markdown-content space-y-6">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={{
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold tracking-tight mb-4">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-bold tracking-tight mt-8 mb-4">{children}</h2>
          ),
          h3: ({ children }) => <h3 className="text-xl font-semibold mt-6 mb-3">{children}</h3>,
          h4: ({ children }) => <h4 className="text-lg font-semibold mt-4 mb-2">{children}</h4>,
          p: ({ children }) => <p className="text-base leading-relaxed mb-4">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 space-y-1 mb-4">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 space-y-1 mb-4">{children}</ol>,
          li: ({ children }) => <li className="text-base leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/30 pl-4 py-2 my-4 bg-muted/30 rounded-r-lg">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <Card className="my-6 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">{children}</table>
              </div>
            </Card>
          ),
          thead: ({ children }) => <thead className="border-b bg-muted/50">{children}</thead>,
          th: ({ children }) => <th className="px-4 py-3 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="px-4 py-3 border-b last:border-0">{children}</td>,
          tr: ({ children }) => <tr className="border-b last:border-0">{children}</tr>,
          code: ({ children, className }) => {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return (
                <pre className="rounded-lg bg-muted p-4 overflow-x-auto my-4">
                  <code className="text-sm">{children}</code>
                </pre>
              );
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">{children}</code>
            );
          },
          hr: () => <hr className="my-8 border-border" />,

          // Custom directive components (mapped via data.hName in the plugin)
          // @ts-expect-error -- custom element from remark-directive
          "image-directive": ({ imageIds, caption }: { imageIds: string; caption: string }) => {
            const ids = imageIds
              ? imageIds
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : [];
            const sectionImages = ids
              .map((id: string) => images.find((img) => img.id === id))
              .filter(Boolean) as {
              id: string;
              url: string;
              alt_text: string | null;
            }[];

            if (sectionImages.length === 0) return null;

            return (
              <Card className="my-6 overflow-hidden">
                <CardContent className="p-4">
                  <ImageCarousel
                    images={sectionImages.map((img) => ({
                      url: img.url,
                      alt: img.alt_text || "Lesson image",
                    }))}
                  />
                  {caption && (
                    <p className="text-sm text-muted-foreground italic text-center mt-3">
                      {caption}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          },

          // Custom element from remark-directive
          "explainer-directive": ({ sequenceId }: { sequenceId: string }) => {
            return <LessonEmbed lessonId={sequenceId} className="my-6 border" />;
          },

          // Custom element from remark-directive
          "question-directive": ({ questionId }: { questionId: string }) => {
            const checkpoint = checkpoints?.[questionId];
            if (checkpoint) return <LessonCheckpoint checkpoint={checkpoint} />;
            // Admin preview has no resolved checkpoints; learners never see
            // unpublished questions, so render a quiet placeholder.
            if (checkpoints === undefined) {
              return (
                <div className="my-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Checkpoint question {questionId.slice(0, 8)} (shown to learners once the question
                  is published)
                </div>
              );
            }
            return null;
          },

          // Custom element from remark-directive
          "key-points-directive": ({
            heading,
            children,
          }: {
            heading: string;
            children: React.ReactNode;
          }) => {
            return (
              <Card className="my-6 border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">{heading || "Key Points"}</h3>
                  </div>
                  <div className="[&>ul]:list-none [&>ul]:pl-0 [&>ul]:mb-0 [&>ul>li]:flex [&>ul>li]:items-start [&>ul>li]:gap-2 [&>ul>li]:mb-2 [&>ul>li:last-child]:mb-0 [&>ul>li]:before:content-[''] [&>ul>li]:before:mt-2 [&>ul>li]:before:h-1.5 [&>ul>li]:before:w-1.5 [&>ul>li]:before:shrink-0 [&>ul>li]:before:rounded-full [&>ul>li]:before:bg-primary">
                    {children}
                  </div>
                </CardContent>
              </Card>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
