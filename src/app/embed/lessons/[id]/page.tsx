// Bare lesson player for iframes on other sites (and direct links). No site
// chrome; framing from any origin is allowed for /embed/* in next.config.ts.

import type { Metadata } from "next";
import { LessonEmbed } from "@/shared/components/explainer/lesson-embed";

export const metadata: Metadata = {
  title: "Lesson",
  robots: { index: false, follow: false },
};

export default async function LessonEmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-black">
      <div className="w-full max-h-screen" style={{ maxWidth: "calc(100vh * 16 / 9)" }}>
        <LessonEmbed lessonId={id} className="rounded-none" />
      </div>
    </main>
  );
}
