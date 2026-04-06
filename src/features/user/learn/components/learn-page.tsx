"use client";

import { useLearningModules } from "../hooks/use-learning-modules";
import { SubjectCard } from "./subject-card";
import { BookOpen, Loader2 } from "lucide-react";

export function LearnPage() {
  const { subjectsByCategory, loading, error } = useLearningModules();

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Learning Modules</h1>
          <p className="text-muted-foreground mt-1">Structured lessons by pathology topic</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Learning Modules</h1>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  const categories = Object.values(subjectsByCategory);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning Modules</h1>
        <p className="text-muted-foreground mt-1">Structured lessons by pathology topic</p>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-lg border bg-muted/50 p-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No modules available yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Learning modules are being developed. Check back soon!
          </p>
        </div>
      ) : (
        categories.map(({ category, subjects }) => (
          <section key={category.id}>
            <div className="mb-4 flex items-center gap-2">
              {category.color && (
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
              )}
              <h2 className="text-xl font-semibold">{category.name}</h2>
              <span className="text-sm text-muted-foreground">
                ({subjects.length} {subjects.length === 1 ? "subject" : "subjects"})
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((subject) => (
                <SubjectCard key={subject.id} subject={subject} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
