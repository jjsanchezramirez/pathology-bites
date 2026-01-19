"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Brain, FileJson, Loader2 } from "lucide-react";

import { QuestionWithDetails } from "@/features/questions/types/questions";
import { createClient } from "@/shared/services/client";
import { ACTIVE_AI_MODELS } from "@/shared/config/ai-models";
import { EducationalContent } from "@/app/(admin)/admin/create-question/components/content-selector";
import { getContentFileInfo } from "@/shared/data/content-index";

interface SourceDetails {
  primary_model?: string;
  model?: string;
}

interface SourceTabProps {
  question: QuestionWithDetails;
}

export function SourceTab({ question }: SourceTabProps) {
  const [aiModelName, setAiModelName] = useState<string>("Unknown");
  const [selectedContent, setSelectedContent] = useState<EducationalContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Function to load educational content using local index
  const loadEducationalContent = useCallback(
    (_category: string, lessonKey: string, topicKey: string) => {
      setLoadingContent(true);

      try {
        // Use local index for instant lookup - no R2 fetches needed!
        const fileInfo = getContentFileInfo(lessonKey, topicKey);

        if (fileInfo) {
          setSelectedContent({
            category: fileInfo.category,
            subject: fileInfo.subject,
            lesson: lessonKey,
            topic: topicKey,
            content: null, // Content itself is not needed for display
          });
        }
      } catch (error) {
        console.error("Error loading educational content:", error);
      } finally {
        setLoadingContent(false);
      }
    },
    []
  );

  // Load AI model name and educational content from question
  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();

      try {
        // Load AI model from question set
        if (question.question_set_id) {
          const { data: questionSet } = await supabase
            .from("question_sets")
            .select("name, source_type, source_details")
            .eq("id", question.question_set_id)
            .single();

          if (questionSet) {
            // Check if this is an AI-generated question set
            if (questionSet.source_type === "ai_generated") {
              const sourceDetails = questionSet.source_details as SourceDetails;
              const modelId = sourceDetails?.primary_model || sourceDetails?.model;

              if (modelId) {
                // Find the model name from ACTIVE_AI_MODELS
                const model = ACTIVE_AI_MODELS.find((m) => m.id === modelId);
                setAiModelName(model ? model.name : String(modelId));
              } else {
                // Fallback to question set name
                setAiModelName(questionSet.name);
              }
            } else {
              // Not an AI-generated question set
              setAiModelName(`${questionSet.name} (${questionSet.source_type})`);
            }
          }
        } else {
          // No question set associated
          setAiModelName("No AI Model (manually created)");
        }

        // Load educational content if lesson and topic are present
        if (question.lesson && question.topic) {
          loadEducationalContent("", question.lesson, question.topic);
        }
      } catch (error) {
        console.error("Error loading source data:", error);
      }
    };

    loadData();
  }, [question.question_set_id, question.lesson, question.topic, loadEducationalContent]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* AI Model Display (Read-Only) */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            AI Model
          </CardTitle>
          <CardDescription>The AI model used to generate this question</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-muted/50 rounded-lg border border-muted">
            <p className="text-sm font-medium text-muted-foreground">AI Model</p>
            <p className="text-base font-semibold mt-1">{aiModelName}</p>
          </div>
        </CardContent>
      </Card>

      {/* Educational Context Display (Read-Only) */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileJson className="h-5 w-5 text-primary" />
            </div>
            Educational Context
          </CardTitle>
          <CardDescription>
            The subject, lesson, and topic context for this question
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingContent ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading educational content...
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedContent ? (
                <>
                  <div className="p-3 bg-muted/50 rounded-lg border border-muted">
                    <p className="text-sm font-medium text-muted-foreground">Subject</p>
                    <p className="text-base font-semibold mt-1">{selectedContent.subject}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg border border-muted">
                    <p className="text-sm font-medium text-muted-foreground">Lesson</p>
                    <p className="text-base font-semibold mt-1">{selectedContent.lesson}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg border border-muted">
                    <p className="text-sm font-medium text-muted-foreground">Topic</p>
                    <p className="text-base font-semibold mt-1">{selectedContent.topic}</p>
                  </div>
                </>
              ) : question.lesson || question.topic ? (
                <>
                  {question.lesson && (
                    <div className="p-3 bg-muted/50 rounded-lg border border-muted">
                      <p className="text-sm font-medium text-muted-foreground">Lesson</p>
                      <p className="text-base font-semibold mt-1">{question.lesson}</p>
                    </div>
                  )}
                  {question.topic && (
                    <div className="p-3 bg-muted/50 rounded-lg border border-muted">
                      <p className="text-sm font-medium text-muted-foreground">Topic</p>
                      <p className="text-base font-semibold mt-1">{question.topic}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-3 bg-muted/50 rounded-lg border border-muted text-center">
                  <p className="text-sm text-muted-foreground">
                    No lesson or topic information available
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
