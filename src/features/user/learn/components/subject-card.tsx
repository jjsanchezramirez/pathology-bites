"use client";

import Link from "next/link";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { LearningSubjectWithCategory } from "../types/lesson";

interface SubjectCardProps {
  subject: LearningSubjectWithCategory;
}

export function SubjectCard({ subject }: SubjectCardProps) {
  const completedCount = subject.completed_count ?? 0;
  const totalCount = subject.lesson_count;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isComplete = completedCount === totalCount && totalCount > 0;

  return (
    <Link href={`/dashboard/learn/${subject.slug}`} className="block h-full min-w-0">
      <Card className="group h-full transition-colors hover:border-primary/50 hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-4 p-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 text-base font-semibold leading-tight transition-colors group-hover:text-primary">
                {subject.title}
              </h3>
              {isComplete && <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />}
            </div>
            {subject.description && (
              <p className="line-clamp-2 text-sm text-muted-foreground">{subject.description}</p>
            )}
          </div>
          <div className="mt-auto space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BookOpen className="h-4 w-4 shrink-0" />
              <span>
                {totalCount} {totalCount === 1 ? "lesson" : "lessons"}
              </span>
              {completedCount > 0 && (
                <span className="ml-auto">
                  {completedCount}/{totalCount} complete
                </span>
              )}
            </div>
            {totalCount > 0 && completedCount > 0 && (
              <Progress value={progressPercent} className="h-1.5" />
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
