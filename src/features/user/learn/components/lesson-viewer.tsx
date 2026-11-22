"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { learnService } from "../services/learn-service";
import { LessonWithProgress } from "../types/lesson";
import { LessonContent, LessonSection } from "../types";
import { TextSection } from "./sections/text-section";
import { ImageSection } from "./sections/image-section";
import { ExplainerSection } from "./sections/explainer-section";
import { KeyPointsSection } from "./sections/key-points-section";
import { ComparisonTableSection } from "./sections/comparison-table-section";
import { LessonQuiz } from "./lesson-quiz";
import { MarkdownLessonRenderer } from "./markdown-lesson-renderer";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Library } from "lucide-react";
import { PageContainer } from "@/shared/components/ui/page-layout";
import { PageHeader } from "@/shared/components/ui/page-header";
import { log } from "@/shared/utils/logging";

interface LessonViewerProps {
  subjectSlug: string;
  lessonSlug: string;
}

export function LessonViewer({ subjectSlug, lessonSlug }: LessonViewerProps) {
  const [lesson, setLesson] = useState<LessonWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<{ id: string; url: string; alt_text: string | null }[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  // Load lesson by looking it up via subject slug + lesson slug
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // First get subject to find the lesson ID
        const subject = await learnService.getSubject(subjectSlug);
        const lessonSummary = subject.lessons.find((l) => l.slug === lessonSlug);
        if (!lessonSummary) {
          setError("Lesson not found");
          setLoading(false);
          return;
        }
        const data = await learnService.getLesson(lessonSummary.id);
        setLesson(data);
        setIsCompleted(!!data.progress?.completed_at);

        // Images referenced in the content are resolved by the lesson API
        // (the old admin-only library endpoint 403'd for regular users).
        setImages(data.images || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load lesson");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [subjectSlug, lessonSlug]);

  const handleQuizComplete = useCallback(
    async (score: number) => {
      if (!lesson) return;
      try {
        await learnService.markComplete(lesson.id, score);
        setIsCompleted(true);
      } catch (err) {
        log.error("Failed to save progress:", err);
      }
    },
    [lesson]
  );

  const handleMarkComplete = useCallback(async () => {
    if (!lesson) return;
    try {
      await learnService.markComplete(lesson.id);
      setIsCompleted(true);
    } catch (err) {
      log.error("Failed to mark complete:", err);
    }
  }, [lesson]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <PageContainer>
        <div>
          <Link href={`/dashboard/learn/${subjectSlug}`}>
            <Button variant="ghost" size="sm" className="-ml-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center sm:p-6">
          <p className="text-sm text-destructive">{error || "Lesson not found"}</p>
        </div>
      </PageContainer>
    );
  }

  // Determine content source: markdown (new) vs JSON (legacy)
  const isMarkdown = !!lesson.content_markdown;
  const content = lesson.content as LessonContent;

  // Quiz: prefer dedicated column, fall back to embedded in content JSON
  const quiz = lesson.quiz || content?.quiz || null;
  const hasQuiz = quiz && quiz.questions.length > 0;

  // Anki: prefer dedicated column, fall back to embedded
  const ankiDeckRef = lesson.anki_deck_ref || content?.ankiDeckRef || null;

  return (
    // Reading column: lesson prose stays at a comfortable line length.
    <PageContainer className="mx-auto w-full max-w-3xl">
      <PageHeader
        eyebrow={
          <Link
            href={`/dashboard/learn/${subjectSlug}`}
            className="inline-block max-w-full align-top"
          >
            <Button variant="ghost" size="sm" className="-ml-2 max-w-full">
              <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">{lesson.subject?.title || "Back"}</span>
            </Button>
          </Link>
        }
        title={lesson.title}
        description={
          lesson.description || lesson.estimated_minutes ? (
            <>
              {lesson.description}
              {lesson.estimated_minutes && (
                <span className="mt-1 block text-xs">~{lesson.estimated_minutes} min read</span>
              )}
            </>
          ) : undefined
        }
      />

      {/* Content: markdown or legacy sections */}
      {isMarkdown ? (
        <MarkdownLessonRenderer
          markdown={lesson.content_markdown!}
          images={images}
          checkpoints={lesson.checkpoints || {}}
        />
      ) : (
        content?.sections?.map((section) => (
          <SectionRenderer key={section.id} section={section} images={images} />
        ))
      )}

      {/* Quiz */}
      {hasQuiz && (
        <div className="border-t pt-6">
          <LessonQuiz quiz={quiz!} onComplete={handleQuizComplete} />
        </div>
      )}

      {/* Anki link */}
      {ankiDeckRef && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <Library className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Review with Anki</p>
              <p className="truncate text-xs text-muted-foreground">Deck: {ankiDeckRef}</p>
            </div>
            <Link href="/dashboard/anki">
              <Button variant="outline" size="sm">
                Open Anki Viewer
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Mark complete (if no quiz) */}
      {!hasQuiz && (
        <div className="flex justify-center border-t pt-6">
          {isCompleted ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Lesson completed</span>
            </div>
          ) : (
            <Button onClick={handleMarkComplete} size="lg">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark as Complete
            </Button>
          )}
        </div>
      )}

      {/* Completed badge (after quiz) */}
      {hasQuiz && isCompleted && (
        <div className="flex justify-center">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Lesson completed</span>
          </div>
        </div>
      )}

      {/* Prev/Next navigation */}
      <div className="flex flex-wrap justify-between gap-2 border-t pt-6">
        {lesson.prev_lesson ? (
          <Link
            href={`/dashboard/learn/${subjectSlug}/${lesson.prev_lesson.slug}`}
            className="min-w-0 max-w-full"
          >
            <Button variant="outline" className="max-w-full">
              <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">{lesson.prev_lesson.title}</span>
            </Button>
          </Link>
        ) : (
          <div />
        )}
        {lesson.next_lesson ? (
          <Link
            href={`/dashboard/learn/${subjectSlug}/${lesson.next_lesson.slug}`}
            className="ml-auto min-w-0 max-w-full"
          >
            <Button variant="outline" className="max-w-full">
              <span className="truncate">{lesson.next_lesson.title}</span>
              <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
            </Button>
          </Link>
        ) : (
          <Link href={`/dashboard/learn/${subjectSlug}`} className="ml-auto">
            <Button variant="outline">
              Back to subject
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </PageContainer>
  );
}

function SectionRenderer({
  section,
  images,
}: {
  section: LessonSection;
  images: { id: string; url: string; alt_text: string | null }[];
}) {
  switch (section.type) {
    case "text":
      return <TextSection section={section} />;
    case "image":
      return <ImageSection section={section} images={images} />;
    case "explainer":
      return <ExplainerSection section={section} />;
    case "key-points":
      return <KeyPointsSection section={section} />;
    case "comparison-table":
      return <ComparisonTableSection section={section} />;
    default:
      return null;
  }
}
