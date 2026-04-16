"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
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
    <Link href={`/dashboard/learn/${subject.slug}`}>
      <Card className="group h-full transition-colors hover:border-primary/50 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
              {subject.title}
            </CardTitle>
            {isComplete && <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />}
          </div>
          {subject.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{subject.description}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4" />
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
            <Progress value={progressPercent} className="mt-3 h-1.5" />
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
