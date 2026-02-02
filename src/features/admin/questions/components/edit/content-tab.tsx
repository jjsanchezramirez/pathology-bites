"use client";

import React, { useState, useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { BookOpen, Sparkles, Loader2 } from "lucide-react";
import { toast } from "@/shared/utils/ui/toast";

import { QuestionWithDetails } from "@/shared/types/questions";
import { EditQuestionFormData } from "@/features/admin/questions/hooks/use-edit-question-form";
import { FetchReferencesDialog } from "@/features/admin/questions/components/dialogs/fetch-references-dialog";
import { EducationalContent } from "@/features/admin/questions/components/create/content-selector";

interface QuestionOptionFormData {
  id?: string;
  text: string;
  is_correct: boolean;
  explanation?: string | null;
  order_index: number;
}

interface ContentTabProps {
  form: UseFormReturn<EditQuestionFormData>;
  question: QuestionWithDetails;
  onUnsavedChanges: () => void;
  answerOptions: QuestionOptionFormData[];
  onAnswerOptionsChange: (options: QuestionOptionFormData[]) => void;
  educationalContext?: EducationalContent | null;
}

export function ContentTab({
  form,
  question,
  onUnsavedChanges,
  answerOptions,
  onAnswerOptionsChange,
  educationalContext,
}: ContentTabProps) {
  const [fetchDialogOpen, setFetchDialogOpen] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementRequest, setEnhancementRequest] = useState("");

  // Determine which AI model to use for refinement
  const refinementModel = useMemo(() => {
    const questionSet = question.set;
    if (questionSet?.source_type === "ai_generated") {
      const sourceDetails = questionSet.source_details as Record<string, unknown> | undefined;
      const modelId = sourceDetails?.primary_model || sourceDetails?.model;
      if (modelId) {
        return String(modelId);
      }
    }
    return "Llama-3.3-8B-Instruct"; // Default fast model
  }, [question]);

  // Handle AI enhancement
  const handleAIEnhancement = async () => {
    const formValues = form.getValues();

    if (!formValues.title || !formValues.stem) {
      toast.error("Please fill in the question title and stem first");
      return;
    }

    setIsEnhancing(true);
    try {
      const response = await fetch("/api/admin/questions/ai-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "refinement",
          content: {
            title: formValues.title,
            stem: formValues.stem,
            answerOptions: answerOptions,
            teaching_point: formValues.teaching_point,
            question_references: formValues.question_references,
          },
          instructions:
            enhancementRequest ||
            "Improve the clarity, accuracy, and pedagogical value of this question while maintaining its core concept.",
          model: refinementModel,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to enhance question");
      }

      const data = await response.json();

      // Update form with enhanced content
      if (data.title) {
        form.setValue("title", data.title);
      }
      if (data.stem) {
        form.setValue("stem", data.stem);
      }
      if (data.teaching_point) {
        form.setValue("teaching_point", data.teaching_point);
      }
      if (data.answer_options) {
        const enhancedOptions = data.answer_options.map(
          (
            option: { text?: string; is_correct?: boolean; explanation?: string },
            index: number
          ) => ({
            ...(answerOptions[index]?.id && { id: answerOptions[index].id }),
            text: option.text || "",
            is_correct: option.is_correct || false,
            explanation: option.explanation || "",
            order_index: index,
          })
        );
        onAnswerOptionsChange(enhancedOptions);
      }

      onUnsavedChanges();
      setEnhancementRequest("");
      toast.success("Question enhanced successfully!");
    } catch (error) {
      console.error("Enhancement error:", error);
      toast.error("Failed to enhance question");
    } finally {
      setIsEnhancing(false);
    }
  };

  // Handle answer option changes
  const updateAnswerOption = (index: number, field: string, value: unknown) => {
    const updatedOptions = [...answerOptions];
    updatedOptions[index] = { ...updatedOptions[index], [field]: value };

    // If marking as correct, unmark others
    if (field === "is_correct" && value === true) {
      updatedOptions.forEach((opt, i) => {
        if (i !== index) opt.is_correct = false;
      });
    }

    onAnswerOptionsChange(updatedOptions);
    onUnsavedChanges();
  };

  // Get search query for references
  const getSearchQuery = () => {
    const formValues = form.getValues();
    const searchParts: string[] = [];

    // Add category if available (remove redundant "Pathology" words)
    if (question.category) {
      const category = question.category.name
        .replace(/Anatomic Pathology/gi, "")
        .replace(/Clinical Pathology/gi, "")
        .replace(/Pathology/gi, "")
        .trim();
      if (category) {
        searchParts.push(category);
      }
    }

    // Add title, teaching point, or stem excerpt
    if (formValues.title) {
      searchParts.push(formValues.title);
    } else if (formValues.teaching_point) {
      searchParts.push(formValues.teaching_point);
    } else if (formValues.stem) {
      searchParts.push(formValues.stem.substring(0, 100));
    }

    return searchParts.join(" ");
  };

  const handleReferencesSelected = (references: string[]) => {
    const currentRefs = form.getValues("question_references") || "";
    const newRefs = references.join("\n\n");
    const updatedRefs = currentRefs ? `${currentRefs}\n\n${newRefs}` : newRefs;

    form.setValue("question_references", updatedRefs);
    onUnsavedChanges();
  };

  return (
    <div className="space-y-6">
      {/* Question Title */}
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-semibold">Question Title</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Brief descriptive title for the question"
                onChange={(e) => {
                  field.onChange(e);
                  onUnsavedChanges();
                }}
                className="text-base"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Question Stem */}
      <FormField
        control={form.control}
        name="stem"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-semibold">Question Stem</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="The main question text..."
                rows={6}
                onChange={(e) => {
                  field.onChange(e);
                  onUnsavedChanges();
                }}
                className="text-base resize-none"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Answer Options */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Answer Options</Label>
        <div className="space-y-3">
          {answerOptions.map((option, index) => (
            <Card
              key={index}
              className={`transition-all ${
                option.is_correct
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <CardContent className="p-4 space-y-3">
                {/* Option Row */}
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="correct-answer"
                    checked={option.is_correct}
                    onChange={() => updateAnswerOption(index, "is_correct", !option.is_correct)}
                    className="h-5 w-5 text-primary focus:ring-primary cursor-pointer"
                  />
                  <Label
                    className="text-sm font-semibold min-w-[70px] cursor-pointer"
                    onClick={() => updateAnswerOption(index, "is_correct", true)}
                  >
                    Option {String.fromCharCode(65 + index)}
                  </Label>
                  <Input
                    value={option.text}
                    onChange={(e) => updateAnswerOption(index, "text", e.target.value)}
                    placeholder="Answer option text..."
                    className="flex-1"
                  />
                  {option.is_correct && (
                    <Badge variant="default" className="ml-2 bg-primary">
                      Correct
                    </Badge>
                  )}
                </div>

                {/* Explanation Row */}
                <div className="flex items-start gap-3 pl-8">
                  <Label className="text-xs text-muted-foreground min-w-[70px] pt-2">
                    Explanation
                  </Label>
                  <Textarea
                    value={option.explanation}
                    onChange={(e) => updateAnswerOption(index, "explanation", e.target.value)}
                    placeholder="Explanation for this option..."
                    rows={2}
                    className="flex-1 text-sm resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Teaching Point */}
      <FormField
        control={form.control}
        name="teaching_point"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-semibold">Teaching Point</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Key learning point or takeaway..."
                rows={4}
                onChange={(e) => {
                  field.onChange(e);
                  onUnsavedChanges();
                }}
                className="resize-none"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* References */}
      <FormField
        control={form.control}
        name="question_references"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between mb-2">
              <FormLabel className="text-base font-semibold">
                References <span className="text-muted-foreground font-normal">(Optional)</span>
              </FormLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const query = getSearchQuery();
                  if (!query.trim()) {
                    toast.error("Please add a question title, teaching point, or stem first");
                    return;
                  }
                  setFetchDialogOpen(true);
                }}
                className="h-8"
              >
                <BookOpen className="h-3 w-3 mr-1.5" />
                Fetch References
              </Button>
            </div>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Citations, sources, or references..."
                rows={3}
                onChange={(e) => {
                  field.onChange(e);
                  onUnsavedChanges();
                }}
                className="resize-none"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* AI Enhancement Section */}
      {educationalContext && (
        <div className="border-t pt-8 mt-8">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-primary" />
                Enhance with AI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Let AI improve your question's clarity, accuracy, and pedagogical value. The AI will
                use the context from your educational content to enhance the question.
              </p>

              <div className="space-y-2.5">
                <Label htmlFor="enhancement-request" className="text-sm font-medium">
                  Enhancement Request{" "}
                  <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Textarea
                  id="enhancement-request"
                  placeholder="e.g., 'Make the question more challenging', 'Focus on differential diagnosis', 'Simplify the language'"
                  value={enhancementRequest}
                  onChange={(e) => setEnhancementRequest(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>

              <Button
                onClick={handleAIEnhancement}
                disabled={isEnhancing}
                className="w-full"
                variant="default"
              >
                {isEnhancing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Enhance Question
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <FetchReferencesDialog
        open={fetchDialogOpen}
        onOpenChange={setFetchDialogOpen}
        searchQuery={getSearchQuery()}
        onReferencesSelected={handleReferencesSelected}
      />
    </div>
  );
}
