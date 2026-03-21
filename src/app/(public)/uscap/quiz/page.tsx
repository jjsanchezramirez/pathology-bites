// src/app/(public)/uscap/quiz/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";

import { toast } from "@/shared/utils/ui/toast";
import { QuestionCountSelector, CategorySelector } from "@/features/user/quiz/components";
import {
  QuestionType,
  CategorySelection,
  CategoryWithStats,
  QuestionTypeStats,
} from "@/features/user/quiz/types/quiz";
import { Loader2, Sparkles } from "lucide-react";

interface GuestQuizForm {
  questionCount: number;
  questionType: QuestionType;
  categorySelection: CategorySelection;
  selectedCategories: string[];
}

interface QuizOptionsData {
  categories: CategoryWithStats[];
  questionTypeStats: {
    all: QuestionTypeStats;
    ap_only: QuestionTypeStats;
    cp_only: QuestionTypeStats;
  };
}

export default function GuestQuizPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<GuestQuizForm>({
    questionCount: 10,
    questionType: "all",
    categorySelection: "all",
    selectedCategories: [],
  });
  const [quizOptions, setQuizOptions] = useState<QuizOptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Fetch quiz options
  useEffect(() => {
    async function fetchQuizOptions() {
      try {
        console.log("[Quiz Config] Fetching from /api/public/uscap/init");
        const response = await fetch("/api/public/uscap/init");
        console.log("[Quiz Config] Response status:", response.status, response.statusText);

        if (!response.ok) {
          const responseText = await response.text();
          console.error("[Quiz Config] Error response:", responseText);
          let errorData;
          try {
            errorData = JSON.parse(responseText);
          } catch {
            errorData = { error: `HTTP ${response.status}: ${responseText}` };
          }
          console.error("[Quiz Config] Parsed error:", errorData);
          throw new Error(errorData.error || "Failed to fetch quiz options");
        }
        const data = await response.json();
        setQuizOptions({
          categories: data.data.categories,
          questionTypeStats: data.data.questionTypeStats,
        });
      } catch (error) {
        console.error("Error fetching quiz options:", error);
        toast.error("Failed to load quiz options");
      } finally {
        setLoading(false);
      }
    }

    fetchQuizOptions();
  }, []);

  // Get available questions for current configuration
  const getAvailableQuestions = useCallback((): number => {
    if (!quizOptions) return 0;

    if (formData.categorySelection === "all") {
      return quizOptions.questionTypeStats.all[formData.questionType];
    } else if (formData.categorySelection === "ap_only") {
      return quizOptions.questionTypeStats.ap_only[formData.questionType];
    } else if (formData.categorySelection === "cp_only") {
      return quizOptions.questionTypeStats.cp_only[formData.questionType];
    } else {
      // Custom selection
      return formData.selectedCategories.reduce((total, categoryId) => {
        const category = quizOptions.categories.find((c) => c.id === categoryId);
        return total + (category?.questionStats[formData.questionType] || 0);
      }, 0);
    }
  }, [quizOptions, formData.categorySelection, formData.questionType, formData.selectedCategories]);

  // Auto-adjust question count when available questions change
  useEffect(() => {
    if (!quizOptions) return;

    const availableQuestions = getAvailableQuestions();

    // If current question count exceeds available questions, adjust it
    if (formData.questionCount > availableQuestions && availableQuestions > 0) {
      setFormData((prev) => ({
        ...prev,
        questionCount: Math.min(prev.questionCount, availableQuestions),
      }));
    }
  }, [formData.questionCount, quizOptions, getAvailableQuestions]);

  const handleCategorySelectionChange = (selection: CategorySelection) => {
    setFormData((prev) => ({
      ...prev,
      categorySelection: selection,
      selectedCategories: selection === "custom" ? prev.selectedCategories : [],
    }));
  };

  const handleCategoryToggle = (categoryId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(categoryId)
        ? prev.selectedCategories.filter((id) => id !== categoryId)
        : [...prev.selectedCategories, categoryId],
    }));
  };

  const validateQuizConfig = () => {
    if (formData.categorySelection === "custom" && formData.selectedCategories.length === 0) {
      return { isValid: false, error: "Please select at least one category" };
    }

    const availableQuestions = getAvailableQuestions();
    if (availableQuestions === 0) {
      return { isValid: false, error: "No questions available for the selected criteria" };
    }

    return { isValid: true, error: null };
  };

  const handleSubmit = async () => {
    const validation = validateQuizConfig();
    if (!validation.isValid) {
      toast.error(validation.error!);
      return;
    }

    setCreating(true);
    try {
      const finalQuestionCount = Math.min(formData.questionCount, availableQuestions);

      const response = await fetch("/api/public/uscap/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionCount: finalQuestionCount,
          questionType: formData.questionType,
          categorySelection: formData.categorySelection,
          selectedCategories: formData.selectedCategories,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create quiz");
      }

      const result = await response.json();

      // Store quiz in local storage for guest access
      const guestSessionId = result.data.sessionId;
      localStorage.setItem(
        `pathology-bites-guest-quiz-${guestSessionId}`,
        JSON.stringify(result.data)
      );

      toast.success("Quiz created successfully!");

      // Redirect to guest quiz session
      router.push(`/uscap/quiz/${guestSessionId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create quiz");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-6 flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading quiz options...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quizOptions) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">Failed to load quiz options. Please refresh the page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availableQuestions = getAvailableQuestions();
  const questionCountOptions = [5, 10, 25, 50];
  const constrainedQuestionCount = Math.min(
    formData.questionCount,
    Math.max(1, availableQuestions)
  );
  const effectiveFormData = {
    ...formData,
    questionCount: constrainedQuestionCount,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">New Quiz</h1>
        <p className="text-muted-foreground">
          Configure your quiz and experience real pathology questions - no account needed
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Info Banner */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Guest Mode - No Signup Required</p>
                <p className="text-muted-foreground">
                  Configure and take a quiz with real questions. Your results will be shown but not
                  saved. Create a free account to track your progress!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Configuration Card */}
        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Question Count */}
            <QuestionCountSelector
              questionCount={effectiveFormData.questionCount}
              availableQuestions={availableQuestions}
              questionCountOptions={questionCountOptions}
              onChange={(count) => setFormData((prev) => ({ ...prev, questionCount: count }))}
            />

            <Separator />

            {/* Question Type - Simplified for guests (only "all") */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Question Type</Label>
                <p className="text-xs text-muted-foreground">
                  Guest mode uses all available questions
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Button variant="default" size="sm" disabled>
                  <div className="text-center">
                    <div className="font-medium text-xs">
                      All Questions ({quizOptions.questionTypeStats.all.all})
                    </div>
                  </div>
                </Button>
              </div>
            </div>

            <Separator />

            {/* Categories */}
            <CategorySelector
              categorySelection={formData.categorySelection}
              selectedCategories={formData.selectedCategories}
              questionType={formData.questionType}
              categories={quizOptions.categories}
              questionTypeStats={quizOptions.questionTypeStats}
              onCategorySelectionChange={handleCategorySelectionChange}
              onCategoryToggle={handleCategoryToggle}
            />

            <Separator />

            {/* Start Button */}
            <div className="space-y-4">
              <Button
                onClick={handleSubmit}
                disabled={creating || !validateQuizConfig().isValid}
                className="w-full"
                size="lg"
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Quiz...
                  </>
                ) : (
                  <>Start Demo Quiz ({effectiveFormData.questionCount} questions)</>
                )}
              </Button>
              {validateQuizConfig().error && (
                <p className="text-sm text-destructive text-center">{validateQuizConfig().error}</p>
              )}
              <p className="text-xs text-muted-foreground text-center">
                Available questions: {availableQuestions}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
