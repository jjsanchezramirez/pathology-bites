"use client";

import Link from "next/link";
import { Card, CardContent } from "@/shared/components/ui/card";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { LessonSummary } from "../types/lesson";

interface LessonCardProps {
  lesson: LessonSummary;
  index: number;
  subjectSlug: string;
}

export function LessonCard({ lesson, index, subjectSlug }: LessonCardProps) {
  return (
    <Link href={`/dashboard/learn/${subjectSlug}/${lesson.slug}`}>
      <Card className="group transition-colors hover:border-primary/50 hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-4">
          {/* Status icon */}
          <div className="shrink-0">
            {lesson.is_completed ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : (
              <Circle className="h-6 w-6 text-muted-foreground/30" />
            )}
          </div>

          {/* Lesson info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-muted-foreground">{index}.</span>
              <h3 className="text-base font-medium group-hover:text-primary transition-colors truncate">
                {lesson.title}
              </h3>
            </div>
            {lesson.description && (
              <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
                {lesson.description}
              </p>
            )}
          </div>

          {/* Meta */}
          <div className="shrink-0 flex items-center gap-3 text-sm text-muted-foreground">
            {lesson.quiz_score !== undefined && lesson.quiz_score !== null && (
              <span className="font-medium text-foreground">{lesson.quiz_score}%</span>
            )}
            {lesson.estimated_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {lesson.estimated_minutes}m
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
