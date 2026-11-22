"use client";

import { useLearningModules } from "../hooks/use-learning-modules";
import { SubjectCard } from "./subject-card";
import { BookOpen, Loader2 } from "lucide-react";
import { PageContainer, PageSection } from "@/shared/components/ui/page-layout";
import { PageHeader } from "@/shared/components/ui/page-header";

const TITLE = "Learning Modules";
const DESCRIPTION = "Structured lessons by pathology topic";

export function LearnPage() {
  const { subjectsByCategory, loading, error } = useLearningModules();

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <PageHeader title={TITLE} />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center sm:p-6">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </PageContainer>
    );
  }

  const categories = Object.values(subjectsByCategory);

  return (
    <PageContainer>
      <PageHeader title={TITLE} description={DESCRIPTION} />

      {categories.length === 0 ? (
        <div className="rounded-lg border bg-muted/50 p-6 text-center sm:p-12">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No modules available yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Learning modules are being developed. Check back soon!
          </p>
        </div>
      ) : (
        categories.map(({ category, subjects }) => (
          <PageSection
            key={category.id}
            title={
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                {category.color && (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                )}
                <span className="min-w-0">{category.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  ({subjects.length} {subjects.length === 1 ? "subject" : "subjects"})
                </span>
              </span>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((subject) => (
                <SubjectCard key={subject.id} subject={subject} />
              ))}
            </div>
          </PageSection>
        ))
      )}
    </PageContainer>
  );
}
