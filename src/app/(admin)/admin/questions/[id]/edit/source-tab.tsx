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

interface SourceDetails {
  primary_model?: string;
  model?: string;
}

interface EducationalContent {
  category: string;
  subject: string;
  lesson: string;
  topic: string;
  content: unknown;
}

interface ContentData {
  category: string;
  subject: {
    name: string;
    url: string;
    lessons: Record<
      string,
      {
        name: string;
        url: string;
        topics: Record<
          string,
          {
            name: string;
            url: string;
            content: unknown;
          }
        >;
      }
    >;
  };
}

interface SourceTabProps {
  question: QuestionWithDetails;
}

// Cache for loaded content to avoid redundant fetches
const contentCache = new Map<string, ContentData>();

// List of available content files (matches ContentSelector)
const CONTENT_FILES = [
  // Anatomic Pathology files
  { filename: "ap-bone.json", category: "Anatomic Pathology", subject: "Bone" },
  { filename: "ap-breast.json", category: "Anatomic Pathology", subject: "Breast" },
  {
    filename: "ap-cardiovascular-and-thoracic.json",
    category: "Anatomic Pathology",
    subject: "Cardiovascular and Thoracic",
  },
  { filename: "ap-cytopathology.json", category: "Anatomic Pathology", subject: "Cytopathology" },
  {
    filename: "ap-dermatopathology.json",
    category: "Anatomic Pathology",
    subject: "Dermatopathology",
  },
  {
    filename: "ap-forensics-and-autopsy.json",
    category: "Anatomic Pathology",
    subject: "Forensics and Autopsy",
  },
  {
    filename: "ap-gastrointestinal.json",
    category: "Anatomic Pathology",
    subject: "Gastrointestinal",
  },
  { filename: "ap-general-topics.json", category: "Anatomic Pathology", subject: "General Topics" },
  { filename: "ap-genitourinary.json", category: "Anatomic Pathology", subject: "Genitourinary" },
  { filename: "ap-gynecological.json", category: "Anatomic Pathology", subject: "Gynecological" },
  {
    filename: "ap-head-and-neck---endocrine.json",
    category: "Anatomic Pathology",
    subject: "Head and Neck / Endocrine",
  },
  {
    filename: "ap-hematopathology.json",
    category: "Anatomic Pathology",
    subject: "Hematopathology",
  },
  { filename: "ap-molecular.json", category: "Anatomic Pathology", subject: "Molecular" },
  { filename: "ap-neuropathology.json", category: "Anatomic Pathology", subject: "Neuropathology" },
  {
    filename: "ap-pancreas-biliary-liver.json",
    category: "Anatomic Pathology",
    subject: "Pancreas Biliary Liver",
  },
  { filename: "ap-pediatrics.json", category: "Anatomic Pathology", subject: "Pediatrics" },
  { filename: "ap-soft-tissue.json", category: "Anatomic Pathology", subject: "Soft Tissue" },
  // Clinical Pathology files
  {
    filename: "cp-clinical-chemistry.json",
    category: "Clinical Pathology",
    subject: "Clinical Chemistry",
  },
  {
    filename: "cp-hematology-hemostasis-and-thrombosis.json",
    category: "Clinical Pathology",
    subject: "Hematology Hemostasis and Thrombosis",
  },
  {
    filename: "cp-hematopathology.json",
    category: "Clinical Pathology",
    subject: "Hematopathology",
  },
  { filename: "cp-immunology.json", category: "Clinical Pathology", subject: "Immunology" },
  {
    filename: "cp-laboratory-management-and-clinical-laboratory-informatics.json",
    category: "Clinical Pathology",
    subject: "Laboratory Management and Clinical Laboratory Informatics",
  },
  {
    filename: "cp-medical-microbiology.json",
    category: "Clinical Pathology",
    subject: "Medical Microbiology",
  },
  {
    filename: "cp-molecular-pathology-and-cytogenetics.json",
    category: "Clinical Pathology",
    subject: "Molecular Pathology and Cytogenetics",
  },
  {
    filename: "cp-toxicology-body-fluids-and-special-techniques.json",
    category: "Clinical Pathology",
    subject: "Toxicology Body Fluids and Special Techniques",
  },
  {
    filename: "cp-transfusion-medicine.json",
    category: "Clinical Pathology",
    subject: "Transfusion Medicine",
  },
];

export function SourceTab({ question }: SourceTabProps) {
  const [aiModelName, setAiModelName] = useState<string>("Unknown");
  const [selectedContent, setSelectedContent] = useState<EducationalContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Function to load educational content from R2
  const loadEducationalContent = useCallback(
    async (_category: string, lessonKey: string, topicKey: string) => {
      setLoadingContent(true);

      try {
        // Search through all files to find the one containing this lesson
        for (const file of CONTENT_FILES) {
          // Check if file is already in cache
          let contentData = contentCache.get(file.filename);

          if (!contentData) {
            // Fetch from R2
            try {
              const response = await fetch(
                `https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/context/${file.filename}`,
                {
                  method: "GET",
                  headers: { Accept: "application/json" },
                  cache: "force-cache",
                }
              );

              if (response.ok) {
                contentData = await response.json();
                // Cache the loaded content
                if (contentData) {
                  contentCache.set(file.filename, contentData);
                }
              }
            } catch (error) {
              console.error(`Error loading ${file.filename}:`, error);
              continue;
            }
          }

          // Check if this file contains the lesson and topic
          if (contentData?.subject?.lessons?.[lessonKey]?.topics?.[topicKey]) {
            const lesson = contentData.subject.lessons[lessonKey];
            const topic = lesson.topics[topicKey];

            // Found the content! Set it as selected
            setSelectedContent({
              category: contentData.category,
              subject: contentData.subject.name,
              lesson: lessonKey,
              topic: topicKey,
              content: topic.content,
            });

            break; // Stop searching once found
          }
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
          await loadEducationalContent("", question.lesson, question.topic);
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
