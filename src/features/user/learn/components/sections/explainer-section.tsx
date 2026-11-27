"use client";

import { ExplainerSection as ExplainerSectionType } from "../../types";
import { LessonEmbed } from "@/shared/components/explainer/lesson-embed";

interface ExplainerSectionProps {
  section: ExplainerSectionType;
}

export function ExplainerSection({ section }: ExplainerSectionProps) {
  return (
    <div className="space-y-2">
      {section.heading && <h2 className="text-2xl font-bold tracking-tight">{section.heading}</h2>}
      {section.description && <p className="text-muted-foreground">{section.description}</p>}
      <LessonEmbed lessonId={section.sequenceId} className="border" />
    </div>
  );
}
