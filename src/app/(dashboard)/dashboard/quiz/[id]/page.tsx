// src/app/(dashboard)/dashboard/quiz/[id]/page.tsx

"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { Play, Pause, PanelLeftOpen, Clock } from "lucide-react";
import { QuizSidebar } from "@/features/quiz/components/quiz-sidebar";
import { QuestionFlagDialog } from "@/features/questions/components/question-flag-dialog";
import { QuizQuestionDisplay } from "@/features/quiz/components/quiz-question-display";
import { QuizNavigation } from "@/features/quiz/components/quiz-navigation";
import { FeatureErrorBoundary } from "@/shared/components/common";
import { QuizResult } from "@/features/quiz/types/quiz";
import { toast } from "@/shared/utils/toast";
import { useState, useEffect, useCallback } from "react";
import { useHybridQuiz, HybridPresets } from "@/features/quiz/hybrid";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCSRFToken } from "@/features/auth/hooks/use-csrf-token";
import { cn } from "@/shared/utils/utils";

export default function QuizSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const isReviewMode = searchParams.get("review") === "true";

  // Review mode state
  const [reviewResult, setReviewResult] = useState<QuizResult | null>(null);
  const [reviewSession, setReviewSession] = useState<unknown>(null);
  const [reviewLoading, setReviewLoading] = useState(isReviewMode);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [_showExplanations, setShowExplanations] = useState<{ [key: string]: boolean }>({});

  // Local pause state (not stored in database)
  const [isPaused, setIsPaused] = useState(false);

  // Exit confirmation dialog state
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [_pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Mobile sidebar state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // CSRF token for POST requests
  const { getToken } = useCSRFToken();

  // Initialize hybrid quiz system (disabled in review mode)
  const [hybridState, hybridActions] = useHybridQuiz({
    sessionId: isReviewMode ? "" : sessionId || "", // Disable in review mode
    ...HybridPresets.TUTOR_MODE,
    csrfTokenGetter: getToken,
    onAnswerSubmitted: () => {
      if (isReviewMode) return; // Skip in review mode
      // Toast messages removed for better UX
    },
    onQuizCompleted: (result) => {
      if (isReviewMode) return; // Skip in review mode
      toast.success(`Quiz completed! Final score: ${result.score}/${result.totalQuestions}`);
    },
    onError: (error) => {
      if (isReviewMode) return; // Skip in review mode

      // Handle "already completed" as a success case, not an error
      if (
        error.includes("already completed") ||
        error.includes("Quiz session is already completed")
      ) {
        console.log("[Hybrid] Quiz already completed, redirecting to results");
        toast.info("Quiz is already completed");
        setTimeout(() => {
          window.location.href = `/dashboard/quiz/${sessionId}/results`;
        }, 1000);
        return;
      }

      console.error("[Hybrid] Quiz error:", error);
      toast.error(`Quiz error: ${error}`);
    },
    onSyncStatusChange: (status) => {
      if (isReviewMode) return; // Skip in review mode
      if (status === "syncing") {
        toast.info("Syncing quiz data...");
      } else if (status === "synced") {
        toast.success("Quiz data synced successfully");
      } else if (status === "error") {
        toast.error("Failed to sync quiz data");
      }
    },
  });

  // Legacy state for review mode compatibility
  const [legacyFlagDialogOpen, setLegacyFlagDialogOpen] = useState(false);

  // Fetch review data if in review mode
  const fetchReviewData = useCallback(async () => {
    if (!isReviewMode || !sessionId) return;

    try {
      setReviewLoading(true);
      setReviewError(null);

      // Create AbortController for timeout handling
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000); // 30 second timeout

      const [sessionResponse, resultsResponse] = await Promise.all([
        fetch(`/api/quiz/sessions/${sessionId}`, {
          signal: abortController.signal,
        }),
        fetch(`/api/quiz/sessions/${sessionId}/results`, {
          signal: abortController.signal,
        }),
      ]);

      clearTimeout(timeoutId);

      if (!sessionResponse.ok || !resultsResponse.ok) {
        const sessionError = !sessionResponse.ok ? await sessionResponse.text() : null;
        const resultsError = !resultsResponse.ok ? await resultsResponse.text() : null;
        throw new Error(`Failed to fetch quiz data: ${sessionError || resultsError}`);
      }

      const [sessionData, resultsData] = await Promise.all([
        sessionResponse.json(),
        resultsResponse.json(),
      ]);

      // Validate session and results data
      if (!sessionData?.success || !sessionData?.data) {
        throw new Error("Quiz session not found or invalid");
      }

      if (!resultsData?.success || !resultsData?.data) {
        throw new Error("Quiz results not found - quiz may not be completed");
      }

      // Additional validation
      if (!resultsData.data.questionDetails || resultsData.data.questionDetails.length === 0) {
        throw new Error("No question data available for review");
      }

      setReviewSession(sessionData.data);
      setReviewResult(resultsData.data);

      // Initialize all explanations to be visible
      const initialExplanations: { [key: string]: boolean } = {};
      resultsData.data.questionDetails?.forEach((q: unknown) => {
        initialExplanations[q.id] = true;
      });
      setShowExplanations(initialExplanations);
    } catch (error) {
      console.error("Error fetching review data:", error);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          const timeoutMessage = "Request timed out. The server may be overloaded.";
          setReviewError(timeoutMessage);
          toast.error(timeoutMessage);
        } else {
          setReviewError(error.message);
          toast.error(`Failed to load quiz review: ${error.message}`);
        }
      } else {
        const genericError = "Failed to load quiz review";
        setReviewError(genericError);
        toast.error(genericError);
      }
    } finally {
      setReviewLoading(false);
    }
  }, [isReviewMode, sessionId]);

  useEffect(() => {
    fetchReviewData();
  }, [fetchReviewData]);

  // Auto-start quiz in tutor mode when initialized
  useEffect(() => {
    if (!isReviewMode && hybridState.isInitialized && hybridState.status === "not_started") {
      console.log("[Quiz Page] Auto-starting quiz in tutor mode");
      hybridActions.startQuiz();
    }
  }, [isReviewMode, hybridState.isInitialized, hybridState.status, hybridActions]);

  // Redirect to results if quiz is already completed (e.g., user hit back button)
  useEffect(() => {
    console.log(
      "[Quiz Page] Checking redirect - isReviewMode:",
      isReviewMode,
      "isInitialized:",
      hybridState.isInitialized,
      "status:",
      hybridState.status
    );
    if (!isReviewMode && hybridState.isInitialized && hybridState.status === "completed") {
      console.log("[Quiz Page] Quiz already completed, redirecting to results");
      toast.info("Quiz is already completed");
      setTimeout(() => {
        window.location.href = `/dashboard/quiz/${sessionId}/results`;
      }, 500);
    }
  }, [isReviewMode, hybridState.isInitialized, hybridState.status, sessionId]);

  // Helper function for time formatting
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Helper functions for review mode
  const handlePreviousReview = () => {
    if (currentReviewIndex > 0) {
      setCurrentReviewIndex(currentReviewIndex - 1);
    }
  };

  const handleNextReview = () => {
    if (reviewResult && currentReviewIndex < reviewResult.questionDetails.length - 1) {
      setCurrentReviewIndex(currentReviewIndex + 1);
    }
  };

  // Exit confirmation handlers
  const handleSaveAndExit = useCallback(async () => {
    if (isReviewMode) return;

    try {
      // Trigger auto-save with manual trigger
      await hybridActions.saveAndExit();

      // Navigate to quizzes page
      window.location.href = "/dashboard/quizzes";
    } catch (error) {
      console.error("Error saving and exiting:", error);
      toast.error("Failed to save quiz progress");
    }
  }, [isReviewMode, hybridActions]);

  const handleExitConfirm = useCallback(async () => {
    await handleSaveAndExit();
    setShowExitDialog(false);
  }, [handleSaveAndExit]);

  const handleExitCancel = useCallback(() => {
    setShowExitDialog(false);
    setPendingNavigation(null);
  }, []);

  // Intercept browser navigation (back button, close tab, etc.)
  useEffect(() => {
    if (isReviewMode || hybridState.status !== "in_progress") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // Chrome requires returnValue to be set
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isReviewMode, hybridState.status]);

  // Early returns for loading and error states
  if (reviewLoading || (!isReviewMode && hybridState.isLoading)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md">
          {/* Sidebar Skeleton */}
          <div className="lg:flex-shrink-0 order-2 lg:order-1">
            <Card className="w-full lg:w-80">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-8" />
                  ))}
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Skeleton */}
          <div className="flex-1 order-1 lg:order-2">
            <div className="space-y-6">
              {/* Header Skeleton */}
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-8 w-64 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-10 w-16" />
                </div>
              </div>

              {/* Question Card Skeleton */}
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-10 w-20" />
                    <Skeleton className="h-10 w-16" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Consistent error handling for all modes
  if (!isReviewMode && !hybridState.isInitialized) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-red-600">Quiz Session Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              The quiz session you're looking for doesn't exist or has been deleted.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()} className="flex-1">
                Try Again
              </Button>
              <Link href="/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle review mode rendering
  if (isReviewMode) {
    if (reviewLoading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold">Loading Quiz Review...</h2>
          </div>
        </div>
      );
    }

    if (!reviewResult || !reviewSession) {
      return (
        <div className="h-full flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle className="text-red-600">Quiz Review Not Available</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {reviewError || "Could not load quiz session or results data for review."}
              </p>
              <div className="flex gap-2">
                <Button onClick={() => fetchReviewData()} className="flex-1">
                  Try Again
                </Button>
                <Link href="/dashboard" className="flex-1">
                  <Button variant="outline" className="w-full">
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    const currentReviewQuestion = reviewSession.questions?.[currentReviewIndex];
    const currentReviewResult = reviewResult.questionDetails?.[currentReviewIndex];

    // Check for missing data
    if (!currentReviewQuestion || !currentReviewResult) {
      // Data validation will be handled below
    }

    if (!currentReviewQuestion || !currentReviewResult) {
      return (
        <div className="h-full flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle className="text-red-600">No questions to review</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`/dashboard/quiz/${sessionId}/results`}>
                <Button className="w-full">Back to Results</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Use the actual session data with review mode modifications
    const reviewModeSession = {
      ...reviewSession,
      title: "Quiz Review",
      currentQuestionIndex: currentReviewIndex,
      config: {
        ...reviewSession.config,
        mode: "tutor" as const,
        showExplanations: true,
      },
      status: "in_progress" as const,
    };

    // Create attempts array for sidebar from results
    const reviewAttempts = reviewResult.questionDetails.map((q: unknown) => ({
      questionId: q.id,
      selectedAnswerId: q.selectedAnswerId,
      isCorrect: q.isCorrect,
      timeSpent: q.timeSpent || 0,
    }));

    return (
      <div className="h-full flex overflow-hidden">
        {/* Mobile Backdrop */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "h-full shrink-0 bg-secondary border-r border-border overflow-hidden z-50 w-[280px]",
            // Desktop: relative positioning, always visible
            "md:relative md:translate-x-0",
            // Mobile: fixed positioning, slide animation
            "fixed left-0 top-0 transition-transform duration-300 ease-in-out",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <FeatureErrorBoundary featureName="Quiz Review Sidebar">
            <QuizSidebar
              session={reviewModeSession as unknown}
              currentQuestionIndex={currentReviewIndex}
              attempts={reviewAttempts}
              onQuestionSelect={(index) => {
                setCurrentReviewIndex(index);
                setMobileSidebarOpen(false);
              }}
              timeRemaining={null}
              isReviewMode={true}
            />
          </FeatureErrorBoundary>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header - Fixed at top */}
          <header className="shrink-0 border-b border-border bg-background p-3 md:p-5">
            <div className="flex items-center justify-between gap-2 md:gap-4">
              <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                {/* Mobile Menu Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                  className="md:hidden"
                >
                  <PanelLeftOpen className="h-4 w-4 mr-2" />
                  Quiz Navigation
                </Button>

                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
                    QUIZ REVIEW
                  </div>
                  <div className="text-[13px] md:text-[14px] font-medium text-foreground truncate">
                    Question {currentReviewIndex + 1} of {reviewResult.questionDetails.length}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/dashboard/quiz/${sessionId}/results`}>
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2 hidden sm:block" />
                    <span className="hidden sm:inline">Back to Results</span>
                    <ArrowLeft className="h-4 w-4 sm:hidden" />
                  </Button>
                </Link>
              </div>
            </div>
          </header>

          {/* Card Content Area - Scrollable */}
          <div className="flex-1 overflow-auto">
            <div className="flex justify-center p-2 md:p-3">
              <div className="w-full max-w-2xl space-y-3">
                {/* Question Display */}
                <FeatureErrorBoundary featureName="Quiz Review Question Display">
                  <QuizQuestionDisplay
                    question={currentReviewQuestion as unknown}
                    selectedAnswerId={currentReviewResult.selectedAnswerId}
                    showExplanation={true}
                    onAnswerSelect={() => {}} // No-op in review mode
                  />
                </FeatureErrorBoundary>

                {/* Navigation */}
                <FeatureErrorBoundary featureName="Quiz Review Navigation">
                  <div className="flex justify-between items-center pt-4">
                    <Button
                      variant="outline"
                      onClick={handlePreviousReview}
                      disabled={currentReviewIndex === 0}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Previous
                    </Button>

                    <div className="text-sm text-muted-foreground">
                      {currentReviewIndex + 1} / {reviewResult.questionDetails.length}
                    </div>

                    <Button
                      variant="outline"
                      onClick={handleNextReview}
                      disabled={currentReviewIndex === reviewResult.questionDetails.length - 1}
                    >
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </FeatureErrorBoundary>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Get current question data from hybrid system
  const currentQuestion = hybridActions.getCurrentQuestion();
  const allQuestions = hybridActions.getQuestions();

  if (!hybridState.isInitialized || !currentQuestion) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The quiz session could not be loaded.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Pause Overlay */}
      {isPaused && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center">
          <Card className="w-96 p-6 text-center">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <Pause className="h-5 w-5" />
                Quiz Paused
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your quiz is paused.{" "}
                {hybridState.timeRemaining !== null
                  ? `Time remaining: ${formatTime(hybridState.timeRemaining)}`
                  : ""}
              </p>
              <Button
                onClick={() => {
                  setIsPaused(false);
                  hybridActions.resumeQuiz();
                }}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Resume Quiz
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Exit Confirmation Dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center">
          <Card className="w-96 p-6">
            <CardHeader>
              <CardTitle>Save and Exit?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your progress will be saved and you can resume this quiz later.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleExitCancel} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleExitConfirm} className="flex-1">
                  Save & Exit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="h-full flex overflow-hidden">
        {/* Mobile Backdrop */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "h-full shrink-0 bg-secondary border-r border-border overflow-hidden z-50 w-[280px]",
            // Desktop: relative positioning, always visible
            "md:relative md:translate-x-0",
            // Mobile: fixed positioning, slide animation
            "fixed left-0 top-0 transition-transform duration-300 ease-in-out",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <FeatureErrorBoundary featureName="Quiz Sidebar">
            <QuizSidebar
              session={{
                id: sessionId || "",
                title: "Quiz Session",
                questions: allQuestions,
                currentQuestionIndex: hybridState.currentQuestion - 1,
                totalQuestions: hybridState.totalQuestions,
                status: hybridState.status,
                userId: "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                config: {
                  mode: "tutor",
                  timing: "untimed",
                  showExplanations: true,
                  questionCount: hybridState.totalQuestions,
                  questionType: "all",
                  categorySelection: "all",
                  selectedCategories: [],
                  shuffleQuestions: false,
                  shuffleAnswers: false,
                  showProgress: true,
                },
              }}
              currentQuestionIndex={hybridState.currentQuestion - 1}
              attempts={allQuestions.map((question) => {
                const answer = hybridActions.getAnswerForQuestion(question.id);
                return {
                  questionId: question.id,
                  selectedAnswerId: answer?.selectedOptionId || null,
                  isCorrect: answer?.isCorrect || false,
                  timeSpent: answer?.timeSpent || 0,
                };
              })}
              onQuestionSelect={(index) => {
                hybridActions.navigateToQuestion(index);
                setMobileSidebarOpen(false);
              }}
              timeRemaining={null}
            />
          </FeatureErrorBoundary>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header - Fixed at top */}
          <header className="shrink-0 border-b border-border bg-background p-3 md:p-5">
            <div className="flex items-center justify-between gap-2 md:gap-4">
              <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                {/* Mobile Menu Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                  className="md:hidden"
                >
                  <PanelLeftOpen className="h-4 w-4 mr-2" />
                  Quiz Navigation
                </Button>

                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
                    QUIZ SESSION
                  </div>
                  <div className="text-[13px] md:text-[14px] font-medium text-foreground truncate">
                    Question {hybridState.currentQuestion} of {hybridState.totalQuestions}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                {hybridState.timeRemaining !== null && (
                  <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                    <Clock className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="font-mono font-medium">
                      {formatTime(hybridState.timeRemaining)}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  {!isPaused ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsPaused(true);
                        hybridActions.pauseQuiz();
                      }}
                      title="Pause quiz"
                      className="h-8 w-8 p-0"
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsPaused(false);
                        hybridActions.resumeQuiz();
                      }}
                      title="Resume quiz"
                      className="h-8 w-8 p-0"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExitDialog(true)}
                    title="Save and exit"
                    className="h-8 px-3 hidden md:flex"
                  >
                    Save & Exit
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Card Content Area - Scrollable */}
          <div className="flex-1 overflow-auto">
            <div className="flex justify-center p-2 md:p-3">
              <div className="w-full max-w-2xl space-y-3">
                {/* Start Quiz Overlay */}
                {hybridState.status === "not_started" && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold text-blue-800">Ready to Start?</h3>
                          <p className="text-blue-700">
                            Take your time to complete {hybridState.totalQuestions} questions.
                          </p>
                          <div className="text-sm text-blue-600 mt-2 space-y-1">
                            <p>🚀 Hybrid System: Instant responses with 96.7% fewer API calls!</p>
                            <p>
                              📊 Current API calls: {hybridState.metrics.totalApiCalls} | Response
                              time: {hybridState.realtimeStats.latency}ms
                            </p>
                          </div>
                        </div>
                        <Button onClick={hybridActions.startQuiz} className="w-full max-w-xs">
                          Start Quiz
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Question Display */}
                {!isPaused && hybridState.status !== "not_started" && (
                  <FeatureErrorBoundary featureName="Quiz Question Display">
                    <QuizQuestionDisplay
                      question={currentQuestion as unknown}
                      selectedAnswerId={
                        hybridActions.getAnswerForQuestion(currentQuestion.id)?.selectedOptionId ||
                        null
                      }
                      showExplanation={
                        hybridActions.getAnswerForQuestion(currentQuestion.id) ? true : false
                      } // Only show explanations after answer is submitted
                      onAnswerSelect={(answerId: string) => {
                        hybridActions.submitAnswer(currentQuestion.id, answerId);
                      }}
                    />
                  </FeatureErrorBoundary>
                )}

                {/* Navigation */}
                {!isPaused && hybridState.status !== "not_started" && (
                  <FeatureErrorBoundary featureName="Quiz Navigation">
                    <QuizNavigation
                      currentQuestionIndex={hybridState.currentQuestion - 1}
                      totalQuestions={hybridState.totalQuestions}
                      selectedAnswerId={
                        hybridActions.getAnswerForQuestion(currentQuestion.id)?.selectedOptionId ||
                        null
                      }
                      showExplanation={
                        hybridActions.getAnswerForQuestion(currentQuestion.id) ? true : false
                      }
                      timing="untimed"
                      onPreviousQuestion={() => {
                        hybridActions.previousQuestion();
                      }}
                      onNextQuestion={async () => {
                        const isLastQuestion =
                          hybridState.currentQuestion === hybridState.totalQuestions;
                        if (isLastQuestion) {
                          // Prevent multiple completion attempts
                          if (hybridState.status === "completed") {
                            toast.info("Quiz is already completed");
                            window.location.href = `/dashboard/quiz/${sessionId}/results`;
                            return;
                          }

                          // Complete the quiz
                          const result = await hybridActions.completeQuiz();
                          if (result.success) {
                            toast.success("Quiz completed successfully!");
                            window.location.href = `/dashboard/quiz/${sessionId}/results`;
                          } else {
                            toast.error("Failed to complete quiz. Please try again.");
                          }
                        } else {
                          hybridActions.nextQuestion();
                        }
                      }}
                      onSubmitAnswer={() => {
                        // Answer is already submitted in onAnswerSelect
                      }}
                      canGoBack={hybridState.currentQuestion > 1}
                      isSubmitting={false}
                    />
                  </FeatureErrorBoundary>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Question Flag Dialog */}
      <QuestionFlagDialog
        question={currentQuestion as unknown}
        open={legacyFlagDialogOpen}
        onOpenChange={setLegacyFlagDialogOpen}
        onFlagComplete={() => {
          toast.success("Question flagged successfully");
        }}
      />
    </>
  );
}
