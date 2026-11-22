"use client";

import { Button } from "@/shared/components/ui/button";
import { SectionCard } from "@/shared/components/ui/page-layout";
import { Plus } from "lucide-react";
import Link from "next/link";

interface QuizEmptyStateProps {
  hasFilters: boolean;
}

export function QuizEmptyState({ hasFilters }: QuizEmptyStateProps) {
  return (
    <SectionCard contentClassName="flex flex-col items-center py-12 text-center sm:py-12">
      <p className="text-sm text-muted-foreground">
        {hasFilters ? "No quizzes match your current filters" : "You haven't taken any quizzes yet"}
      </p>
      <Link href="/dashboard/quiz/new">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Your First Quiz
        </Button>
      </Link>
    </SectionCard>
  );
}
