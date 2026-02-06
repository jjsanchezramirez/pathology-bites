// src/app/(dashboard)/dashboard/quiz/[id]/components/QuizReviewView.tsx

import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { QuizQuestionDisplay } from "@/features/user/quiz/components/quiz-question-display";
import { QuizSidebar } from "@/features/user/quiz/components/quiz-sidebar";
import { FeatureErrorBoundary } from "@/shared/components/common";
import { ArrowLeft, ArrowRight, RefreshCw, Home, PanelLeftOpen, Star, Flag } from "lucide-react";
import Link from "next/link";
import { QuizSession, QuizResult } from "@/features/user/quiz/types/quiz";
import { UIQuizQuestion } from "@/features/user/quiz/types/quiz-question";
import { QuizAnswer } from "@/features/user/quiz/types/quiz-question";
import { RefObject } from "react";
import dynamic from "next/dynamic";
import { useLottieAnimation } from "@/shared/hooks/use-lottie-animation";
import { cn } from "@/shared/utils/utils";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// Error state component for quiz review
function QuizReviewErrorState({ error }: { error: string | null }) {
  const { animationData } = useLottieAnimation("access_denied");

  const handleRetry = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        {/* Lottie Animation */}
        {animationData && (
          <div className="w-full max-w-[150px] mx-auto">
            <Lottie
              animationData={animationData}
              loop={true}
              style={{ width: "100%", height: "auto" }}
            />
          </div>
        )}

        {/* Title */}
        <div className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tight">Unable to Load Quiz Review</h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {error || "We couldn't load the quiz review data. This might be a temporary issue."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center justify-center gap-3 pt-4">
          <Button
            onClick={handleRetry}
            size="lg"
            className="flex items-center justify-center gap-2 py-6 text-lg w-full max-w-xs"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </Button>

          <Link href="/dashboard/quizzes" className="w-full max-w-xs">
            <Button
              size="lg"
              variant="ghost"
              className="flex items-center justify-center gap-2 py-6 text-lg w-full"
            >
              <Home className="w-5 h-5" />
              Back to Quizzes
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

interface QuizReviewViewProps {
  // Review data
  reviewSession: QuizSession | null;
  reviewResult: QuizResult | null;
  loading: boolean;
  error: string | null;

  // Current question
  currentIndex: number;
  onNavigateToQuestion: (index: number) => void;
  textZoom: number;

  // Sidebar
  mobileSidebarOpen: boolean;
  onCloseMobileSidebar: () => void;
  onToggleMobileSidebar?: () => void;

  // Navigation
  getAnswerForQuestion: (questionId: string) => QuizAnswer | null;

  // Header props
  sessionId?: string;
  currentQuestionId?: string;
  isQuestionFavorited?: boolean;
  onToggleFavorite?: () => void;
  onFlagQuestion?: () => void;

  // Scroll ref
  contentAreaRef: RefObject<HTMLDivElement>;
}

export function QuizReviewView({
  reviewSession,
  reviewResult,
  loading,
  error,
  currentIndex,
  onNavigateToQuestion,
  textZoom,
  mobileSidebarOpen,
  onCloseMobileSidebar,
  onToggleMobileSidebar,
  getAnswerForQuestion,
  contentAreaRef,
  sessionId,
  currentQuestionId,
  isQuestionFavorited,
  onToggleFavorite,
  onFlagQuestion,
}: QuizReviewViewProps) {
  if (loading) {
    return (
      <div className="flex-1 p-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !reviewSession || !reviewResult) {
    return <QuizReviewErrorState error={error} />;
  }

  const currentQuestion = reviewSession.questions?.[currentIndex];
  const allQuestions = reviewSession.questions || [];

  if (!currentQuestion) {
    return (
      <div className="flex-1 p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">No question found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Transform to UI format
  const uiQuestion: UIQuizQuestion = {
    id: currentQuestion.id,
    title: currentQuestion.title,
    stem: currentQuestion.stem,
    question_options: currentQuestion.question_options || [],
    question_images: currentQuestion.question_images || [],
    teaching_point: currentQuestion.teaching_point,
    question_references: currentQuestion.question_references,
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <QuizSidebar
        questions={allQuestions.map((q) => ({
          id: q.id,
          title: q.title,
          stem: q.stem,
          question_options: q.question_options || [],
          question_images: q.question_images || [],
          teaching_point: q.teaching_point,
          question_references: q.question_references,
        }))}
        currentQuestionIndex={currentIndex}
        getAnswerForQuestion={getAnswerForQuestion}
        onNavigateToQuestion={onNavigateToQuestion}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={onCloseMobileSidebar}
        isReviewMode={true}
      />

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header - Fixed at top */}
        <header className="shrink-0 border-b border-border bg-background p-5">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              {/* Mobile Menu Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleMobileSidebar}
                className="lg:hidden"
              >
                <PanelLeftOpen className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Navigation</span>
              </Button>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
                  QUIZ REVIEW
                </div>
                <div className="text-[13px] md:text-[14px] font-medium text-foreground truncate">
                  Question {currentIndex + 1} of {allQuestions.length}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Star/Favorite Button */}
              {onToggleFavorite && currentQuestionId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleFavorite}
                  title={isQuestionFavorited ? "Remove from favorites" : "Add to favorites"}
                  className="h-8 w-8 p-0"
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      isQuestionFavorited && "fill-yellow-400 text-yellow-400"
                    )}
                  />
                </Button>
              )}

              {/* Flag Button */}
              {onFlagQuestion && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onFlagQuestion}
                  title="Flag question for review"
                  className="h-8 w-8 p-0"
                >
                  <Flag className="h-4 w-4" />
                </Button>
              )}

              {/* Back to Results Button */}
              {sessionId && (
                <Link href={`/dashboard/quiz/${sessionId}/results`}>
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2 hidden sm:block" />
                    <span className="hidden sm:inline">Back to Results</span>
                    <ArrowLeft className="h-4 w-4 sm:hidden" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable content area with max-width constraint */}
        <div className="flex-1 overflow-auto">
          <div className="flex justify-center p-2 md:p-3">
            <div ref={contentAreaRef} className="w-full max-w-2xl space-y-3">
              <FeatureErrorBoundary>
                <QuizQuestionDisplay
                  question={uiQuestion}
                  questionNumber={currentIndex + 1}
                  totalQuestions={allQuestions.length}
                  textZoom={textZoom}
                  mode="tutor"
                  selectedAnswerId={
                    getAnswerForQuestion(currentQuestion.id)?.selectedOptionId || null
                  }
                  onAnswerSelect={() => {}}
                  showExplanation={true}
                  isReviewMode={true}
                />
              </FeatureErrorBoundary>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => onNavigateToQuestion(currentIndex - 1)}
                  disabled={currentIndex === 0}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                <span className="text-sm text-muted-foreground">
                  Question {currentIndex + 1} of {allQuestions.length}
                </span>

                <Button
                  variant="outline"
                  onClick={() => onNavigateToQuestion(currentIndex + 1)}
                  disabled={currentIndex === allQuestions.length - 1}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
