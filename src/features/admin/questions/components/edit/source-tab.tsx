"use client";

import React, { useMemo, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { SectionCard } from "@/shared/components/ui/page-layout";
import { Brain, FileJson } from "lucide-react";

import { QuestionWithDetails } from "@/shared/types/questions";
import { EditQuestionFormData } from "@/features/admin/questions/hooks/use-edit-question-form";
import { ACTIVE_AI_MODELS } from "@/shared/config/ai-models";
import { getContentFileInfo } from "@/shared/config/content-index";
import {
  ContentSelector,
  EducationalContent,
} from "@/features/admin/questions/components/create/content-selector";
import { log } from "@/shared/utils/logging";

interface SourceDetails {
  primary_model?: string;
  model?: string;
}

interface SourceTabProps {
  question: QuestionWithDetails;
  form?: UseFormReturn<EditQuestionFormData>;
  onUnsavedChanges?: () => void;
  onEducationalContextChange?: (context: EducationalContent | null) => void;
}

export function SourceTab({
  question,
  form,
  onUnsavedChanges,
  onEducationalContextChange,
}: SourceTabProps) {
  // State for content selector
  const [selectedContent, setSelectedContent] = useState<EducationalContent | null>(null);

  // Check if lesson/topic need to be selected
  const needsLessonTopic = !question.lesson || !question.topic;

  // Handle content selection
  const handleContentSelect = (content: EducationalContent) => {
    setSelectedContent(content);
    if (form && onUnsavedChanges) {
      form.setValue("lesson", content.lesson);
      form.setValue("topic", content.topic);
      onUnsavedChanges();
    }
    // Pass the educational context up to the parent
    if (onEducationalContextChange) {
      onEducationalContextChange(content);
    }
  };

  // Initialize AI model name synchronously using useMemo for instant display
  const aiModelName = useMemo<string>(() => {
    // Use question_set data if available (it should be preloaded from the API)
    const questionSet = question.question_set || question.set;

    if (questionSet) {
      // Check if this is an AI-generated question set
      if (questionSet.source_type === "ai_generated") {
        const sourceDetails = questionSet.source_details as SourceDetails;
        const modelId = sourceDetails?.primary_model || sourceDetails?.model;

        if (modelId) {
          // Find the model name from ACTIVE_AI_MODELS
          const model = ACTIVE_AI_MODELS.find((m) => m.id === modelId);
          return model ? model.name : String(modelId);
        } else {
          // Fallback to question set name
          return questionSet.name;
        }
      } else {
        // Not an AI-generated question set
        return `${questionSet.name} (${questionSet.source_type})`;
      }
    } else {
      // No question set associated
      return "No AI Model (manually created)";
    }
  }, [question.question_set, question.set]);

  // Get subject name from category (Category = Subject in the database)
  const subjectName = useMemo<string | null>(() => {
    if (question.category && typeof question.category === "object" && "name" in question.category) {
      return question.category.name;
    }
    // Try to get from content index as last resort
    if (question.lesson && question.topic) {
      try {
        const fileInfo = getContentFileInfo(question.lesson, question.topic);
        return fileInfo?.subject || null;
      } catch (error) {
        log.error("Error loading subject from content index:", error);
      }
    }
    return null;
  }, [question.category, question.lesson, question.topic]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* AI Model Display (Read-Only) */}
      <SectionCard
        title="AI Model"
        description="The AI model used to generate this question"
        icon={Brain}
      >
        <div className="rounded-lg border border-muted bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">AI Model</p>
          <p className="mt-1 text-sm font-semibold">{aiModelName}</p>
        </div>
      </SectionCard>

      {/* Educational Context Display (Read-Only) */}
      <SectionCard
        title="Educational Context"
        description="The subject, lesson, and topic context for this question"
        icon={FileJson}
      >
        {needsLessonTopic ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please select a lesson and topic for this question
            </p>
            <ContentSelector
              onContentSelect={handleContentSelect}
              selectedContent={selectedContent}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {subjectName && (
              <div className="rounded-lg border border-muted bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Subject</p>
                <p className="mt-1 text-sm font-semibold">{subjectName}</p>
              </div>
            )}
            {question.lesson && (
              <div className="rounded-lg border border-muted bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Lesson</p>
                <p className="mt-1 text-sm font-semibold">{question.lesson}</p>
              </div>
            )}
            {question.topic && (
              <div className="rounded-lg border border-muted bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Topic</p>
                <p className="mt-1 text-sm font-semibold">{question.topic}</p>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
