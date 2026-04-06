"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { learnService } from "../services/learn-service";
import { LessonSummary } from "../types/lesson";
import { LessonCard } from "./lesson-card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface SubjectPageProps {
  slug: string;
}

interface SubjectData {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  category: { id: string; name: string; color: string | null; short_form: string | null };
  lessons: LessonSummary[];
}

export function SubjectPage({ slug }: SubjectPageProps) {
  const [subject, setSubject] = useState<SubjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await learnService.getSubject(slug);
        setSubject(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load subject");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/learn">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to modules
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-destructive">{error || "Subject not found"}</p>
        </div>
      </div>
    );
  }

  const completedCount = subject.lessons.filter((l) => l.is_completed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/learn">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to modules
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          {subject.category.color && (
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: subject.category.color }}
            />
          )}
          <span className="text-sm font-medium text-muted-foreground">
            {subject.category.name}
          </span>
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{subject.title}</h1>
        {subject.description && (
          <p className="mt-1 text-muted-foreground">{subject.description}</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {completedCount} of {subject.lessons.length} lessons complete
        </p>
      </div>

      {/* Lesson list */}
      <div className="space-y-3">
        {subject.lessons.map((lesson, index) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            index={index + 1}
            subjectSlug={slug}
          />
        ))}
      </div>
    </div>
  );
}
