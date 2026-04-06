"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { learnService } from "../services/learn-service";
import { LessonWithProgress } from "../types/lesson";
import { LessonSection, LessonContent, LessonQuiz as LessonQuizType } from "../types";
import { TextSection } from "./sections/text-section";
import { ImageSection } from "./sections/image-section";
import { ExplainerSection } from "./sections/explainer-section";
import { KeyPointsSection } from "./sections/key-points-section";
import { ComparisonTableSection } from "./sections/comparison-table-section";
import { LessonQuiz } from "./lesson-quiz";
import {
  MarkdownLessonRenderer,
  extractImageIds,
} from "./markdown-lesson-renderer";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Library,
} from "lucide-react";

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

        // Load images referenced in content
        let imageIds: string[] = [];
        if (data.content_markdown) {
          imageIds = extractImageIds(data.content_markdown);
        } else {
          const content = data.content as LessonContent;
          if (content?.sections) {
            imageIds = content.sections
              .filter((s): s is { type: "image"; imageIds: string[] } & LessonSection => s.type === "image")
              .flatMap((s) => s.imageIds);
          }
        }

        if (imageIds.length > 0) {
          try {
            const res = await fetch(
              `/api/admin/library/images?ids=${imageIds.join(",")}`
            );
            if (res.ok) {
              const imgData = await res.json();
              setImages(Array.isArray(imgData) ? imgData : imgData.images || []);
            }
          } catch {
            // Images are non-critical
          }
        }
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
        console.error("Failed to save progress:", err);
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
      console.error("Failed to mark complete:", err);
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
      <div className="space-y-4">
        <Link href={`/dashboard/learn/${subjectSlug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-destructive">{error || "Lesson not found"}</p>
        </div>
      </div>
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
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <Link href={`/dashboard/learn/${subjectSlug}`}>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {lesson.subject?.title || "Back"}
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{lesson.title}</h1>
        {lesson.description && (
          <p className="mt-1 text-muted-foreground">{lesson.description}</p>
        )}
        {lesson.estimated_minutes && (
          <p className="mt-1 text-sm text-muted-foreground">
            ~{lesson.estimated_minutes} min read
          </p>
        )}
      </div>

      {/* Content: markdown or legacy sections */}
      {isMarkdown ? (
        <MarkdownLessonRenderer
          markdown={lesson.content_markdown!}
          images={images}
        />
      ) : (
        content?.sections?.map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            images={images}
          />
        ))
      )}

      {/* Quiz */}
      {hasQuiz && (
        <div className="border-t pt-8">
          <LessonQuiz quiz={quiz!} onComplete={handleQuizComplete} />
        </div>
      )}

      {/* Anki link */}
      {ankiDeckRef && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Library className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Review with Anki</p>
              <p className="text-xs text-muted-foreground">
                Deck: {ankiDeckRef}
              </p>
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
        <div className="border-t pt-6 flex justify-center">
          {isCompleted ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Lesson completed</span>
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
            <span className="font-medium">Lesson completed</span>
          </div>
        </div>
      )}

      {/* Prev/Next navigation */}
      <div className="border-t pt-6 flex justify-between">
        {lesson.prev_lesson ? (
          <Link href={`/dashboard/learn/${subjectSlug}/${lesson.prev_lesson.slug}`}>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {lesson.prev_lesson.title}
            </Button>
          </Link>
        ) : (
          <div />
        )}
        {lesson.next_lesson ? (
          <Link href={`/dashboard/learn/${subjectSlug}/${lesson.next_lesson.slug}`}>
            <Button variant="outline">
              {lesson.next_lesson.title}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Link href={`/dashboard/learn/${subjectSlug}`}>
            <Button variant="outline">
              Back to subject
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </div>
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
