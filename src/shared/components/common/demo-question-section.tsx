"use client";

import dynamic from "next/dynamic";

// DemoQuestion is the homepage's heaviest interactive widget — 8 hooks + ImageCarousel +
// Lottie + a client-side fetch to /api/public/demo-questions. It sits well below the fold
// and renders nothing real server-side (its question is fetched on mount), so we code-split
// it into its own chunk and hydrate it AFTER the page. That keeps it out of the single
// up-front React hydration pass that dominates homepage TBT. The min-height placeholder
// reserves space so a late mount can't shift layout (CLS stays 0).
const DemoQuestion = dynamic(() => import("@/shared/components/common/demo-question"), {
  ssr: false,
  loading: () => <div className="min-h-[600px]" aria-hidden />,
});

export function DemoQuestionSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent" />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold mb-4">Preview Our Interactive Learning</h2>
          <p className="text-xl text-muted-foreground">
            Experience our interactive learning format with this sample question
          </p>
        </div>
        <DemoQuestion />
      </div>
    </section>
  );
}
