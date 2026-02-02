// src/app/(dashboard)/dashboard/quiz/new/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useZeroApiNetworkStatus } from "@/shared/hooks/use-zero-api-network-status";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { useQuizSettings } from "@/shared/hooks/use-user-settings";
import { useUnifiedData } from "@/shared/hooks/use-unified-data";
import { useCSRFToken } from "@/features/auth/hooks/use-csrf-token";

import {
  QuestionType,
  CategorySelection,
  QuizCreationForm,
  CategoryWithStats,
  QuestionTypeStats,
  QUIZ_MODE_CONFIG,
  DEFAULT_QUIZ_CONFIG,
} from "@/features/user/quiz/types/quiz";
import { toast } from "@/shared/utils/ui/toast";
import {
  NewQuizLoading,
  QuizNameInput,
  QuestionCountSelector,
  ModeTimingSelector,
  QuestionTypeSelector,
  CategorySelector,
  StartQuizButton,
} from "@/features/user/quiz/components";

interface QuizOptionsData {
  categories: CategoryWithStats[];
  questionTypeStats: {
    all: QuestionTypeStats;
    ap_only: QuestionTypeStats;
    cp_only: QuestionTypeStats;
  };
}

// Remove local interface since we're using the one from the service

export default function NewQuizPage() {
  const router = useRouter();
  const { isOnline } = useZeroApiNetworkStatus();
  const [formData, setFormData] = useState<QuizCreationForm>(DEFAULT_QUIZ_CONFIG);
  const [quizOptions, setQuizOptions] = useState<QuizOptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [previousQuizTitles, setPreviousQuizTitles] = useState<string[]>([]);
  const [loadingTitles, setLoadingTitles] = useState(true);

  // Use cached quiz settings hook (eliminates redundant API calls)
  const { data: userSettings } = useQuizSettings();

  // Use unified data hook (eliminates separate quiz init API call!)
  const { data: unifiedData, isLoading: unifiedLoading } = useUnifiedData();

  // CSRF token for POST requests
  const { getToken, addTokenToHeaders } = useCSRFToken();

  // Apply user settings when available
  useEffect(() => {
    if (userSettings) {
      setFormData((prev) => ({
        ...prev,
        questionCount: userSettings.default_question_count,
        mode: userSettings.default_mode,
        timing: userSettings.default_timing,
        questionType: userSettings.default_question_type,
        categorySelection: userSettings.default_category_selection,
      }));
    }
  }, [userSettings]);

  // Apply quiz init data from unified data when available
  useEffect(() => {
    if (unifiedData?.quizInit) {
      // Set quiz options from unified data
      setQuizOptions({
        categories: unifiedData.quizInit.categories,
        questionTypeStats: unifiedData.quizInit.questionTypeStats,
      });

      // Set previous quiz titles from unified data
      setPreviousQuizTitles(unifiedData.quizInit.sessionTitles);

      // Update loading states
      setLoadingTitles(false);
    }
  }, [unifiedData]);

  // Sync loading state with unified data - only set loading to false when data is available
  useEffect(() => {
    if (!unifiedLoading && unifiedData?.quizInit) {
      setLoading(false);
    } else if (unifiedLoading) {
      setLoading(true);
    }
  }, [unifiedLoading, unifiedData]);

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

  // Generate sequential quiz title based on previous quizzes
  const generateQuizTitle = (): string => {
    // Guard clause to ensure all required data is available
    if (!formData || !previousQuizTitles) {
      return "New Quiz";
    }

    let baseTitle: string;
    let pattern: RegExp;

    switch (formData.categorySelection) {
      case "all":
        baseTitle = "AP/CP Quiz";
        pattern = /^AP\/CP Quiz No (\d+)$/;
        break;
      case "ap_only":
        baseTitle = "AP Only Quiz";
        pattern = /^AP Only Quiz No (\d+)$/;
        break;
      case "cp_only":
        baseTitle = "CP Only Quiz";
        pattern = /^CP Only Quiz No (\d+)$/;
        break;
      default:
        baseTitle = "Custom Quiz";
        pattern = /^Custom Quiz No (\d+)$/;
        break;
    }

    // Find the highest number for this quiz type
    let highestNumber = 0;
    previousQuizTitles.forEach((title) => {
      const match = title.match(pattern);
      if (match) {
        const number = parseInt(match[1], 10);
        if (number > highestNumber) {
          highestNumber = number;
        }
      }
    });

    const nextNumber = highestNumber + 1;
    return `${baseTitle} No ${nextNumber}`;
  };

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

  const handleQuestionTypeChange = (questionType: QuestionType) => {
    setFormData((prev) => ({
      ...prev,
      questionType,
    }));
  };

  // Simple validation function
  const validateQuizConfig = () => {
    if (!isOnline) {
      return {
        isValid: false,
        error: "No internet connection. Please check your network and try again.",
      };
    }

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
    // Early network check to prevent unnecessary processing
    if (!isOnline) {
      toast.error("No internet connection. Quiz creation requires an active network connection.");
      return;
    }

    // Simple validation
    const validation = validateQuizConfig();
    if (!validation.isValid) {
      toast.error(validation.error!);
      return;
    }

    setCreating(true);
    try {
      // Generate title if not provided
      const title =
        formData.title?.trim() ||
        (formData && previousQuizTitles ? generateQuizTitle() : "New Quiz");

      // Use the effective question count (already constrained)
      const finalQuestionCount = Math.min(effectiveFormData.questionCount, availableQuestions);

      // Create quiz payload
      const quizPayload = {
        ...effectiveFormData,
        title,
        questionCount: finalQuestionCount,
        showExplanations: QUIZ_MODE_CONFIG[formData.mode].showExplanations,
      };

      // Get CSRF token
      const csrfToken = await getToken();

      const response = await fetch("/api/user/quiz/sessions", {
        method: "POST",
        headers: addTokenToHeaders(
          {
            "Content-Type": "application/json",
          },
          csrfToken
        ),
        body: JSON.stringify(quizPayload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create quiz");
      }

      const result = await response.json();
      toast.success("Quiz created successfully!");

      // Redirect to quiz session
      router.push(`/dashboard/quiz/${result.data.sessionId}`);
    } catch (error) {
      // Check if this might be a network error
      if (error instanceof TypeError && error.message.includes("fetch")) {
        toast.error("Network error: Please check your internet connection and try again.");
      } else if (
        error instanceof Error &&
        (error.message.includes("NetworkError") || error.message.includes("fetch"))
      ) {
        toast.error("Connection failed: Unable to reach the server. Please check your network.");
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to create quiz");
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <NewQuizLoading />;
  }

  if (!quizOptions) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Quiz</h1>
            <p className="text-muted-foreground text-red-600">
              Failed to load quiz options. Please refresh the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Get standard question count options (always show all, but some may be disabled)
  const getQuestionCountOptions = (): number[] => {
    return [5, 10, 25, 50];
  };

  // Get current available questions and ensure form data is constrained
  const availableQuestions = getAvailableQuestions();
  const questionCountOptions = getQuestionCountOptions();

  // Ensure current question count doesn't exceed available questions
  const constrainedQuestionCount = Math.min(
    formData.questionCount,
    Math.max(1, availableQuestions)
  );
  const effectiveFormData = {
    ...formData,
    questionCount: constrainedQuestionCount,
  };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Quiz</h1>
          <p className="text-muted-foreground">Configure your quiz settings and start learning</p>
        </div>

        {/* Main Configuration Card */}
        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Quiz Name */}
            <QuizNameInput
              value={formData.title || ""}
              placeholder={formData && previousQuizTitles ? generateQuizTitle() : "New Quiz"}
              loadingTitles={loadingTitles}
              onChange={(value) => setFormData((prev) => ({ ...prev, title: value }))}
            />

            <Separator />

            {/* Question Count */}
            <QuestionCountSelector
              questionCount={effectiveFormData.questionCount}
              availableQuestions={availableQuestions}
              questionCountOptions={questionCountOptions}
              onChange={(count) => setFormData((prev) => ({ ...prev, questionCount: count }))}
            />

            <Separator />

            {/* Learning Mode & Timing */}
            <ModeTimingSelector
              mode={formData.mode}
              timing={formData.timing}
              onModeChange={(mode) => setFormData((prev) => ({ ...prev, mode }))}
              onTimingChange={(timing) => setFormData((prev) => ({ ...prev, timing }))}
            />

            <Separator />

            {/* Question Type and Categories - Vertical Layout */}
            <div className="space-y-6">
              {/* Question Type */}
              <QuestionTypeSelector
                questionType={formData.questionType}
                categorySelection={formData.categorySelection}
                selectedCategories={formData.selectedCategories}
                categories={quizOptions.categories}
                questionTypeStats={quizOptions.questionTypeStats}
                onChange={handleQuestionTypeChange}
              />

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
            </div>

            <Separator />

            {/* Start Button */}
            <StartQuizButton
              creating={creating}
              isOnline={isOnline}
              isValid={validateQuizConfig().isValid}
              validationError={validateQuizConfig().error}
              onClick={handleSubmit}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
