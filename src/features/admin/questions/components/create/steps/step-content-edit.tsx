"use client";

import { useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent } from "@/shared/components/ui/card";
import { SectionCard } from "@/shared/components/ui/page-layout";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/shared/utils/ui/toast";
import { FormState } from "../multi-step-question-form";
import { FetchReferencesDialog } from "@/features/admin/questions/components/dialogs/fetch-references-dialog";
import { log } from "@/shared/utils/logging";
import { DEFAULT_AI_MODEL } from "@/shared/config/ai-models";

interface StepContentEditProps {
  formState: FormState;
  updateFormState: (updates: Partial<FormState>) => void;
  questionSetAIModel?: string | null; // AI model from the question set
}

export function StepContentEdit({
  formState,
  updateFormState,
  questionSetAIModel,
}: StepContentEditProps) {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementRequest, setEnhancementRequest] = useState("");
  const [fetchDialogOpen, setFetchDialogOpen] = useState(false);

  // Determine which AI model to use for refinement
  // Priority: 1. Question set's AI model, 2. Selected AI model from Step 1, 3. Default fast model
  const refinementModel = questionSetAIModel || formState.selectedAIModel || DEFAULT_AI_MODEL;

  // Handle AI enhancement
  const handleAIEnhancement = async () => {
    if (!formState.title || !formState.stem) {
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
            title: formState.title,
            stem: formState.stem,
            answerOptions: formState.answerOptions,
            teaching_point: formState.teaching_point,
            question_references: formState.question_references,
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
      if (data.title) updateFormState({ title: data.title });
      if (data.stem) updateFormState({ stem: data.stem });
      if (data.teaching_point) updateFormState({ teaching_point: data.teaching_point });
      if (data.answer_options) {
        interface AnswerOptionItem {
          text?: string;
          is_correct?: boolean;
          explanation?: string;
        }
        const enhancedOptions = data.answer_options.map(
          (option: AnswerOptionItem, index: number) => ({
            text: option.text || "",
            is_correct: option.is_correct || false,
            explanation: option.explanation || "",
            order_index: index,
          })
        );
        updateFormState({ answerOptions: enhancedOptions });
      }

      setEnhancementRequest("");
      toast.success("Question enhanced successfully!");
    } catch (error) {
      log.error("Enhancement error:", error);
      toast.error("Failed to enhance question");
    } finally {
      setIsEnhancing(false);
    }
  };

  // Build search query for references
  const getSearchQuery = () => {
    const searchParts: string[] = [];

    // Add category if available (remove redundant "Pathology" words)
    if (formState.selectedContent?.category) {
      const category = formState.selectedContent.category
        .replace(/Anatomic Pathology/gi, "")
        .replace(/Clinical Pathology/gi, "")
        .replace(/Pathology/gi, "")
        .trim();
      if (category) {
        searchParts.push(category);
      }
    }

    // Add lesson/subject if available (this is the topic)
    if (formState.selectedContent?.subject) {
      searchParts.push(formState.selectedContent.subject);
    }

    // Add title, teaching point, or stem excerpt
    if (formState.title) {
      searchParts.push(formState.title);
    } else if (formState.teaching_point) {
      searchParts.push(formState.teaching_point);
    } else if (formState.stem) {
      // Use first 100 chars of stem as fallback
      searchParts.push(formState.stem.substring(0, 100));
    }

    return searchParts.join(" ");
  };

  // Handle opening the fetch references dialog
  const handleOpenFetchDialog = () => {
    const query = getSearchQuery();
    if (!query.trim()) {
      toast.error("Please add a question title, teaching point, or stem first");
      return;
    }
    setFetchDialogOpen(true);
  };

  // Handle references selected from dialog
  const handleReferencesSelected = (references: string[]) => {
    const existingRefs = formState.question_references?.trim() || "";
    const newRefsText = references.join("\n");

    // Append new references to existing ones with a newline separator
    const updatedRefs = existingRefs ? `${existingRefs}\n${newRefsText}` : newRefsText;

    updateFormState({ question_references: updatedRefs });
    toast.success(`Added ${references.length} reference${references.length !== 1 ? "s" : ""}`);
  };

  // Handle answer option changes
  const updateAnswerOption = (index: number, field: string, value: unknown) => {
    const updatedOptions = [...formState.answerOptions];
    updatedOptions[index] = { ...updatedOptions[index], [field]: value };

    // If marking as correct, unmark others
    if (field === "is_correct" && value === true) {
      updatedOptions.forEach((opt, i) => {
        if (i !== index) opt.is_correct = false;
      });
    }

    updateFormState({ answerOptions: updatedOptions });
  };

  return (
    <div className="space-y-6">
      {/* Question Title */}
      <div className="space-y-2">
        <Label htmlFor="title" className="font-semibold">
          Question Title
        </Label>
        <Input
          id="title"
          value={formState.title}
          onChange={(e) => updateFormState({ title: e.target.value })}
          placeholder="Brief descriptive title for the question"
        />
      </div>

      {/* Question Stem */}
      <div className="space-y-2">
        <Label htmlFor="stem" className="font-semibold">
          Question Stem
        </Label>
        <Textarea
          id="stem"
          value={formState.stem}
          onChange={(e) => updateFormState({ stem: e.target.value })}
          placeholder="The main question text..."
          rows={6}
          className="resize-none"
        />
      </div>

      {/* Answer Options */}
      <div className="space-y-2">
        <Label className="font-semibold">Answer Options</Label>
        <div className="space-y-2">
          {formState.answerOptions.map((option, index) => (
            <Card
              key={index}
              className={`transition-all ${
                option.is_correct
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <CardContent className="p-4 space-y-2">
                {/* Option Row */}
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-answer"
                    checked={option.is_correct}
                    onChange={() => updateAnswerOption(index, "is_correct", !option.is_correct)}
                    className="h-5 w-5 text-primary focus:ring-primary cursor-pointer"
                  />
                  <Label
                    className="text-sm font-medium shrink-0 sm:min-w-[70px] cursor-pointer"
                    onClick={() => updateAnswerOption(index, "is_correct", true)}
                  >
                    Option {String.fromCharCode(65 + index)}
                  </Label>
                  <Input
                    value={option.text}
                    onChange={(e) => updateAnswerOption(index, "text", e.target.value)}
                    placeholder="Answer option text..."
                    className="min-w-0 flex-1"
                  />
                  {option.is_correct && (
                    <Badge variant="default" className="shrink-0 bg-primary">
                      Correct
                    </Badge>
                  )}
                </div>

                {/* Explanation Row */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:pl-8">
                  <Label className="text-xs text-muted-foreground sm:min-w-[70px] sm:pt-2">
                    Explanation
                  </Label>
                  <Textarea
                    value={option.explanation}
                    onChange={(e) => updateAnswerOption(index, "explanation", e.target.value)}
                    placeholder="Explanation for this option..."
                    rows={2}
                    className="min-w-0 flex-1 text-sm resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Teaching Point */}
      <div className="space-y-2">
        <Label htmlFor="teaching_point" className="font-semibold">
          Teaching Point
        </Label>
        <Textarea
          id="teaching_point"
          value={formState.teaching_point}
          onChange={(e) => updateFormState({ teaching_point: e.target.value })}
          placeholder="Key learning point or takeaway..."
          rows={4}
          className="resize-none"
        />
      </div>

      {/* References */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="question_references" className="font-semibold">
            References <span className="text-muted-foreground font-normal">(Optional)</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenFetchDialog}
            disabled={!formState.title && !formState.teaching_point && !formState.stem}
            className="h-8"
          >
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Fetch References
          </Button>
        </div>
        <Textarea
          id="question_references"
          value={formState.question_references}
          onChange={(e) => updateFormState({ question_references: e.target.value })}
          placeholder="Citations, sources, or references..."
          rows={3}
          className="resize-none"
        />
      </div>

      {/* AI Enhancement Section */}
      <div className="border-t pt-6">
        <SectionCard
          className="bg-primary/5 border-primary/20"
          title="Enhance with AI"
          icon={Sparkles}
          description="Let AI improve your question's clarity, accuracy, and pedagogical value. The AI will use the context from your educational content to enhance the question."
        >
          <div className="space-y-2">
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
        </SectionCard>
      </div>

      {/* Fetch References Dialog */}
      <FetchReferencesDialog
        open={fetchDialogOpen}
        onOpenChange={setFetchDialogOpen}
        searchQuery={getSearchQuery()}
        onReferencesSelected={handleReferencesSelected}
      />
    </div>
  );
}
