"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { SectionCard, StatCard, StatGrid } from "@/shared/components/ui/page-layout";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { CircularProgress } from "@/shared/components/ui/circular-progress";
import { Clock, Target, TrendingUp, Star } from "lucide-react";
import { QuizResult } from "@/features/user/quiz/types/quiz";
import { AchievementCelebrationModal } from "@/features/user/achievements/components/achievement-celebration-modal";
import Link from "next/link";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { getCategoryByName } from "@/shared/config/categories";
import { CategoryBadge } from "@/shared/components/ui/category-badge";
import { useFavoritesGlobal } from "@/features/user/questions/hooks/use-favorites-global";
import { cn } from "@/shared/utils/utils";
import { log } from "@/shared/utils/logging";

interface QuizResultsSummaryProps {
  result: QuizResult;
  onReviewQuestions?: () => void;
}

export function QuizResultsSummary({ result, onReviewQuestions }: QuizResultsSummaryProps) {
  const sessionId = result.sessionId;
  const percentage = Math.round((result.correctAnswers / result.totalQuestions) * 100);
  const incorrectCount = result.totalQuestions - result.correctAnswers;
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [celebrationShown, setCelebrationShown] = useState(false);

  // Global favorites hook - shared across all components
  const { isFavorited, toggleFavorite } = useFavoritesGlobal();

  const formatTime = (timeValue: number): string => {
    // Handle invalid input (but allow 0)
    if (timeValue == null || isNaN(timeValue) || timeValue < 0) {
      return "0:00";
    }

    const seconds = timeValue;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // 2-tier performance system
  const getPerformanceTier = (score: number) => {
    return score < 60 ? "low" : "good";
  };

  const getPerformanceMessage = (score: number): { message: string; color: string } => {
    if (score < 50)
      return {
        message: "Don't give up! Review the material and try again.",
        color: "text-red-600",
      };
    if (score < 60)
      return { message: "Keep practicing! You're making progress.", color: "text-red-600" };
    if (score < 70)
      return { message: "Good start! Keep building your knowledge.", color: "text-primary" };
    if (score < 80)
      return { message: "Well done! You're getting the hang of it.", color: "text-primary" };
    if (score < 90)
      return { message: "Great job! Your understanding is solid.", color: "text-primary" };
    if (score < 95)
      return { message: "Excellent work! You've mastered this material.", color: "text-primary" };
    return { message: "Outstanding! Perfect performance!", color: "text-primary" };
  };

  const performance = getPerformanceMessage(percentage);
  const tier = getPerformanceTier(percentage);
  const hasNewAchievements = (result.newAchievements?.length ?? 0) > 0;

  // Show celebration modal for new achievements
  useEffect(() => {
    if (hasNewAchievements && !celebrationShown) {
      setShowCelebrationModal(true);
      setCelebrationShown(true);
    }
  }, [hasNewAchievements, celebrationShown]);

  // Auto-trigger confetti scaled to quiz score (only after celebration modal is closed)
  useEffect(() => {
    // Don't trigger confetti if celebration modal is showing
    if (showCelebrationModal) return;
    if (percentage < 50) return; // No confetti for scores below 50%

    const timer = setTimeout(() => {
      // Scale confetti intensity based on score
      // 50% = 50 particles, 60% = 70, 70% = 90, 80% = 120, 90% = 150, 100% = 200
      const particleCount = Math.round(50 + (percentage - 50) * 3);
      const spread = 60 + (percentage - 50); // 60° at 50%, up to 110° at 100%

      log.debug("[Confetti] Score-based confetti:", { percentage, particleCount, spread });

      // Standard confetti colors (no custom colors - uses default colorful confetti)
      confetti({
        particleCount,
        spread,
        origin: { x: 0.5, y: 0.6 },
        startVelocity: 30,
        zIndex: 9999,
      });
    }, 1500); // Delay to let animations start

    return () => clearTimeout(timer);
  }, [percentage, showCelebrationModal]);

  return (
    <div className="w-full space-y-6">
      {/* Achievement Celebration Modal */}
      <AchievementCelebrationModal
        achievements={result.newAchievements || []}
        open={showCelebrationModal}
        onClose={() => setShowCelebrationModal(false)}
      />

      {/* Header with Text Animations */}
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          {tier === "good" ? (
            // Good Performance (≥60%): Letter drop animation
            <span className="inline-block">
              {"Nice Work!".split("").map((letter, index) => (
                <span
                  key={`${percentage}-${index}`}
                  className="inline-block animate-letter-drop"
                  style={{
                    animationDelay: `${index * 80 + 300}ms`,
                    animationFillMode: "both",
                  }}
                >
                  {letter === " " ? "\u00A0" : letter}
                </span>
              ))}
            </span>
          ) : percentage < 50 ? (
            // Very Low Performance (<50%): Tremble animation
            <span key={`tremble-${percentage}`} className="animate-tremble inline-block">
              Keep Practicing!
            </span>
          ) : (
            // Low Performance (50-59%): Static text
            "Keep Going!"
          )}
        </h1>
        <p className="text-sm text-foreground sm:text-base">{performance.message}</p>
      </div>

      {/* Main Score Display — the hero metric, intentionally larger than the stat scale */}
      <SectionCard contentClassName="text-center">
        <div className="flex justify-center">
          <CircularProgress
            key={`progress-${percentage}`}
            value={percentage}
            size={160}
            strokeWidth={12}
            animationDuration={2000}
          />
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-bold">
            {result.correctAnswers} out of {result.totalQuestions} correct
          </p>
          <p className="text-sm text-muted-foreground">You scored {percentage}% on this quiz</p>
        </div>
      </SectionCard>

      {/* Metrics Grid */}
      <StatGrid>
        <StatCard
          label="Correct"
          value={
            <span className="text-green-600 dark:text-green-500">{result.correctAnswers}</span>
          }
          icon={Target}
          tone="success"
        />
        <StatCard label="Incorrect" value={incorrectCount} icon={Target} tone="danger" />
        <StatCard label="Total Time" value={formatTime(result.totalTimeSpent)} icon={Clock} />
        <StatCard
          label="Average per Question"
          value={formatTime(result.averageTimePerQuestion)}
          icon={TrendingUp}
        />
      </StatGrid>

      {/* Category Breakdown */}
      {result.categoryBreakdown && result.categoryBreakdown.length > 0 && (
        <SectionCard flush title="Performance by Category">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">
                  <span className="hidden sm:inline">Correct</span>
                  <span className="sm:hidden">✓</span>
                </TableHead>
                <TableHead className="text-center">
                  <span className="hidden sm:inline">Incorrect</span>
                  <span className="sm:hidden">✗</span>
                </TableHead>
                <TableHead className="hidden text-center md:table-cell">Total</TableHead>
                <TableHead className="hidden text-center md:table-cell">Time</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.categoryBreakdown.map((category) => {
                const incorrect = category.total - category.correct;
                const categoryPercentage =
                  category.total > 0 ? Math.round((category.correct / category.total) * 100) : 0;

                return (
                  <TableRow key={category.categoryId}>
                    <TableCell>
                      <CategoryBadge
                        category={{
                          id: category.categoryId,
                          color: category.categoryColor,
                          short_form: category.categoryShortForm,
                          parent_short_form: category.parentShortForm,
                          name: category.categoryName,
                        }}
                        label={category.categoryName}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`font-semibold ${category.correct > 0 ? "text-green-600 dark:text-green-500" : "text-muted-foreground"}`}
                      >
                        {category.correct}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`font-semibold ${incorrect > 0 ? "text-red-600 dark:text-red-500" : "text-muted-foreground"}`}
                      >
                        {incorrect}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-center font-semibold md:table-cell">
                      {category.total}
                    </TableCell>
                    <TableCell className="hidden text-center text-xs text-muted-foreground md:table-cell">
                      {formatTime(category.averageTime)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {categoryPercentage}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SectionCard>
      )}

      {/* Question-by-Question Breakdown */}
      {result.questionDetails && result.questionDetails.length > 0 && (
        <SectionCard title="Performance by Question">
          <div className="space-y-2">
            {result.questionDetails.map((question, index) => {
              const category = getCategoryByName(question.category);
              const categoryShort = category?.shortForm || question.category;
              const successRatePercentage = Math.round(question.successRate);

              return (
                <Link
                  key={question.id}
                  href={`/dashboard/quiz/${sessionId}?review=true&question=${index}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 sm:items-center"
                >
                  {/* Question number */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {index + 1}
                  </div>

                  {/* Question details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="line-clamp-1 min-w-0 flex-1 text-sm font-medium">
                        {question.title || `Question ${index + 1}`}
                      </div>
                      {/* Result badge - moved to top right on mobile */}
                      <Badge
                        variant="outline"
                        className={`flex-shrink-0 text-xs sm:hidden ${
                          question.isCorrect
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : question.selectedAnswerId === null
                              ? "border-gray-300 bg-gray-50 text-gray-700"
                              : "border-red-300 bg-red-50 text-red-700"
                        }`}
                      >
                        {question.isCorrect ? "✓" : question.selectedAnswerId === null ? "−" : "✗"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <CategoryBadge
                        category={{
                          color: category?.color,
                          short_form: category?.shortForm,
                          name: category?.name ?? question.category,
                        }}
                        label={categoryShort}
                      />
                      <span className="text-muted-foreground hidden sm:inline">
                        {successRatePercentage}% of users got this correct
                      </span>
                      <span className="text-muted-foreground sm:hidden">
                        {successRatePercentage}% got this correct
                      </span>
                      <span className="text-muted-foreground">
                        • {formatTime(question.timeSpent)}
                      </span>
                    </div>
                  </div>

                  {/* Result badge - desktop only */}
                  <Badge
                    variant="outline"
                    className={`hidden sm:flex flex-shrink-0 ${
                      question.isCorrect
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : question.selectedAnswerId === null
                          ? "border-gray-300 bg-gray-50 text-gray-700"
                          : "border-red-300 bg-red-50 text-red-700"
                    }`}
                  >
                    {question.isCorrect ? (
                      <>
                        <Target className="h-3 w-3 mr-1" />
                        Correct
                      </>
                    ) : question.selectedAnswerId === null ? (
                      <>
                        <Target className="h-3 w-3 mr-1" />
                        Unanswered
                      </>
                    ) : (
                      <>
                        <Target className="h-3 w-3 mr-1" />
                        Incorrect
                      </>
                    )}
                  </Badge>

                  {/* Favorite Star Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(question.id);
                    }}
                    className="h-8 w-8 p-0 flex-shrink-0"
                    title={isFavorited(question.id) ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        isFavorited(question.id) && "fill-yellow-400 text-yellow-400"
                      )}
                    />
                  </Button>
                </Link>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Action Buttons */}
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <Button onClick={onReviewQuestions} className="w-full sm:w-auto sm:min-w-[200px]">
          Review Questions
        </Button>

        <Link href="/dashboard/quiz/new" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto sm:min-w-[200px]">
            Start New Quiz
          </Button>
        </Link>
      </div>
    </div>
  );
}
