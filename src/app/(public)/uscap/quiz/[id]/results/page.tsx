// src/app/(public)/uscap/quiz/[id]/results/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { CircularProgress } from "@/shared/components/ui/circular-progress";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import { VisuallyHidden } from "@/shared/components/ui/visually-hidden";
import { Trophy, Target, Clock, TrendingUp, RefreshCw, Home, UserPlus } from "lucide-react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { getCategoryColor } from "@/shared/utils/category-colors";
import { getCategoryStyle } from "@/shared/config/categories";
import { AchievementLottie } from "@/features/user/achievements/components/achievement-lottie";

interface GuestQuizData {
  sessionId: string;
  questions: Array<{
    id: string;
    questionText: string;
    difficulty: string;
    explanation: string;
    category: {
      id: string;
      name: string;
      shortName: string;
    } | null;
  }>;
  totalQuestions: number;
  config: Record<string, unknown>;
}

interface GuestAnswer {
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  timestamp: number;
}

export default function GuestQuizResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [quizData, setQuizData] = useState<GuestQuizData | null>(null);
  const [answers, setAnswers] = useState<GuestAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFirstQuizModal, setShowFirstQuizModal] = useState(false);
  const [celebrationShown, setCelebrationShown] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    // Load quiz data
    const storedQuizData = localStorage.getItem(`pathology-bites-guest-quiz-${sessionId}`);
    const storedAnswers = localStorage.getItem(`pathology-bites-guest-quiz-answers-${sessionId}`);

    if (storedQuizData && storedAnswers) {
      setQuizData(JSON.parse(storedQuizData));
      setAnswers(JSON.parse(storedAnswers));

      // Check if this is the first quiz completed
      const firstQuizFlag = localStorage.getItem("pathology-bites-guest-first-quiz-completed");
      if (!firstQuizFlag) {
        setShowFirstQuizModal(true);
        localStorage.setItem("pathology-bites-guest-first-quiz-completed", "true");
      }
    } else {
      // Data not found
      router.push("/uscap/quiz");
    }

    setLoading(false);
  }, [sessionId, router]);

  // Trigger confetti for achievement modal
  useEffect(() => {
    if (!showFirstQuizModal || celebrationShown) return;

    const timer = setTimeout(() => {
      const colors = ["#fbbf24", "#f59e0b", "#d97706", "#fef3c7", "#fcd34d"];

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.5, y: 0.5 },
        colors,
        startVelocity: 30,
        zIndex: 9999,
      });

      setCelebrationShown(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [showFirstQuizModal, celebrationShown]);

  // Trigger regular score-based confetti (only after modal is closed)
  useEffect(() => {
    if (!quizData || !answers.length) return;
    if (showFirstQuizModal) return; // Don't trigger if modal is showing

    const totalQuestions = quizData.totalQuestions;
    const correctAnswers = answers.filter((a) => a.isCorrect).length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);

    if (score < 50) return; // No confetti for low scores

    const timer = setTimeout(() => {
      const particleCount = Math.round(50 + (score - 50) * 3);
      const spread = 60 + (score - 50);

      confetti({
        particleCount,
        spread,
        origin: { x: 0.5, y: 0.6 },
        startVelocity: 30,
        zIndex: 9999,
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [quizData, answers, showFirstQuizModal]);

  if (loading || !quizData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold">Loading Results...</h1>
            <p className="text-muted-foreground mt-2">Please wait</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate results
  const totalQuestions = quizData.totalQuestions;
  const correctAnswers = answers.filter((a) => a.isCorrect).length;
  const score = Math.round((correctAnswers / totalQuestions) * 100);

  // Calculate difficulty breakdown
  const difficultyBreakdown = {
    easy: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    hard: { correct: 0, total: 0 },
  };

  quizData.questions.forEach((question) => {
    const answer = answers.find((a) => a.questionId === question.id);
    const difficulty = question.difficulty as "easy" | "medium" | "hard";

    if (difficultyBreakdown[difficulty]) {
      difficultyBreakdown[difficulty].total++;
      if (answer?.isCorrect) {
        difficultyBreakdown[difficulty].correct++;
      }
    }
  });

  // Calculate time spent (in seconds for consistency with authenticated version)
  const totalTimeSpent =
    answers.length > 0
      ? Math.round((answers[answers.length - 1].timestamp - answers[0].timestamp) / 1000)
      : 0;
  const averageTimePerQuestion =
    totalQuestions > 0 ? Math.round(totalTimeSpent / totalQuestions) : 0;

  // Format time helper
  const formatTime = (timeValue: number): string => {
    if (timeValue == null || isNaN(timeValue) || timeValue < 0) return "0:00";
    const seconds = timeValue;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get performance message (matching authenticated version)
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

  // Get performance tier (for animations)
  const getPerformanceTier = (score: number) => (score < 60 ? "low" : "good");

  const performance = getPerformanceMessage(score);
  const tier = getPerformanceTier(score);

  // Calculate category breakdown
  const categoryBreakdown: Record<
    string,
    {
      correct: number;
      total: number;
      time: number;
      name: string;
      shortName: string;
      id: string;
    }
  > = {};

  quizData.questions.forEach((question) => {
    const answer = answers.find((a) => a.questionId === question.id);
    const categoryId = question.category?.id || "unknown";
    const categoryName = question.category?.name || "Unknown";
    const categoryShortName = question.category?.shortName || categoryName;

    if (!categoryBreakdown[categoryId]) {
      categoryBreakdown[categoryId] = {
        correct: 0,
        total: 0,
        time: 0,
        name: categoryName,
        shortName: categoryShortName,
        id: categoryId,
      };
    }

    categoryBreakdown[categoryId].total++;
    if (answer?.isCorrect) categoryBreakdown[categoryId].correct++;

    // Calculate time spent on this question
    const questionIndex = answers.findIndex((a) => a.questionId === question.id);
    if (questionIndex >= 0 && questionIndex < answers.length - 1) {
      const timeSpent =
        (answers[questionIndex + 1].timestamp - answers[questionIndex].timestamp) / 1000;
      categoryBreakdown[categoryId].time += timeSpent;
    }
  });

  const incorrectCount = totalQuestions - correctAnswers;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Achievement Celebration Modal */}
        <Dialog open={showFirstQuizModal} onOpenChange={setShowFirstQuizModal}>
          <DialogContent
            className="max-w-lg border-none bg-transparent shadow-none p-8 overflow-visible"
            showCloseButton={false}
          >
            <VisuallyHidden>
              <DialogTitle>Achievement Unlocked: First Quiz Complete</DialogTitle>
            </VisuallyHidden>

            <div className="flex flex-col items-center gap-8">
              {/* Title */}
              <h2 className="text-2xl font-bold text-foreground text-center">
                New Achievement Unlocked!
              </h2>

              {/* Achievement animation */}
              <div className="w-48 h-48">
                <AchievementLottie
                  animationType="trophy_large"
                  isUnlocked={true}
                  className="w-full h-full"
                />
              </div>

              {/* Achievement details */}
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-foreground">First Quiz Complete</h3>
                <p className="text-sm text-primary font-semibold uppercase">Getting Started</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Congratulations! You've completed your first quiz. This is just the beginning of
                  your pathology learning journey.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 w-full">
                <Button onClick={() => setShowFirstQuizModal(false)} className="w-full">
                  Continue
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Header with Text Animations */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary">
            {tier === "good" ? (
              // Good Performance (≥60%): Letter drop animation
              <span className="inline-block">
                {"Nice Work!".split("").map((letter, index) => (
                  <span
                    key={`${score}-${index}`}
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
            ) : score < 50 ? (
              // Very Low Performance (<50%): Tremble animation
              <span key={`tremble-${score}`} className="animate-tremble inline-block">
                Keep Practicing!
              </span>
            ) : (
              // Low Performance (50-59%): Static text
              "Keep Going!"
            )}
          </h1>
          <p className="text-lg text-foreground">{performance.message}</p>
        </div>

        {/* Main Score Display with Circular Progress */}
        <Card className="text-center">
          <CardContent className="pt-8 pb-6">
            <div className="flex justify-center mb-6">
              <CircularProgress
                key={`progress-${score}`}
                value={score}
                size={160}
                strokeWidth={12}
                animationDuration={2000}
              />
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold">
                {correctAnswers} out of {totalQuestions} correct
              </p>
              <p className="text-muted-foreground">You scored {score}% on this quiz</p>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-2">
                <Target className="h-6 w-6 text-green-600 dark:text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                {correctAnswers}
              </div>
              <div className="text-sm text-muted-foreground">Correct</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-2">
                <Target className="h-6 w-6 text-red-600 dark:text-red-500" />
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-500">
                {incorrectCount}
              </div>
              <div className="text-sm text-muted-foreground">Incorrect</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-2">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div className="text-2xl font-bold text-primary">{formatTime(totalTimeSpent)}</div>
              <div className="text-sm text-muted-foreground">Total Time</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-2">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div className="text-2xl font-bold text-primary">
                {formatTime(averageTimePerQuestion)}
              </div>
              <div className="text-sm text-muted-foreground">Average per Question</div>
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown Table */}
        {Object.keys(categoryBreakdown).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">Category</th>
                      <th className="text-center py-2 px-2 font-medium">
                        <span className="hidden sm:inline">Correct</span>
                        <span className="sm:hidden">✓</span>
                      </th>
                      <th className="text-center py-2 px-2 font-medium">
                        <span className="hidden sm:inline">Incorrect</span>
                        <span className="sm:hidden">✗</span>
                      </th>
                      <th className="text-center py-2 px-2 font-medium hidden sm:table-cell">
                        Total
                      </th>
                      <th className="text-center py-2 px-2 font-medium">Time</th>
                      <th className="text-right py-2 px-2 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(categoryBreakdown).map(([categoryId, stats]) => {
                      const incorrect = stats.total - stats.correct;
                      const categoryPercentage =
                        stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                      const avgTime = stats.total > 0 ? Math.round(stats.time / stats.total) : 0;

                      // Get category color using utility
                      const categoryColor = getCategoryColor({
                        id: stats.id,
                        color: null,
                        short_form: stats.shortName,
                        parent_short_form: null,
                        name: stats.name,
                      });
                      const categoryStyle = getCategoryStyle(categoryColor);

                      return (
                        <tr key={categoryId}>
                          <td className="py-2 px-2">
                            <Badge
                              variant="outline"
                              className="text-xs border [&]:dark:brightness-90"
                              style={categoryStyle?.light}
                            >
                              {stats.name}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`font-semibold text-sm ${
                                stats.correct > 0
                                  ? "text-green-600 dark:text-green-500"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {stats.correct}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`font-semibold text-sm ${
                                incorrect > 0
                                  ? "text-red-600 dark:text-red-500"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {incorrect}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center font-semibold text-sm hidden sm:table-cell">
                            {stats.total}
                          </td>
                          <td className="py-2 px-2 text-center text-xs text-muted-foreground">
                            {formatTime(avgTime)}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <span className="text-sm font-semibold">{categoryPercentage}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Question-by-Question Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance by Question</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quizData.questions.map((question, index) => {
                const answer = answers.find((a) => a.questionId === question.id);
                const isCorrect = answer?.isCorrect ?? false;

                // Calculate time spent on this question
                const questionIndex = answers.findIndex((a) => a.questionId === question.id);
                let timeSpent = 0;
                if (questionIndex >= 0 && questionIndex < answers.length - 1) {
                  timeSpent = Math.round(
                    (answers[questionIndex + 1].timestamp - answers[questionIndex].timestamp) / 1000
                  );
                } else if (questionIndex === answers.length - 1 && answers.length > 1) {
                  // For last question, use average of previous questions
                  const totalTime = answers[answers.length - 1].timestamp - answers[0].timestamp;
                  timeSpent = Math.round(totalTime / answers.length / 1000);
                }

                // Get category color
                const categoryColor = question.category
                  ? getCategoryColor({
                      id: question.category.id,
                      color: null,
                      short_form: question.category.shortName,
                      parent_short_form: null,
                      name: question.category.name,
                    })
                  : null;
                const categoryStyle = categoryColor ? getCategoryStyle(categoryColor) : null;

                return (
                  <div
                    key={question.id}
                    className="flex items-start sm:items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-card"
                  >
                    {/* Question number */}
                    <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 rounded-full bg-muted text-xs font-semibold">
                      {index + 1}
                    </div>

                    {/* Question details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="font-medium text-xs sm:text-sm line-clamp-2 flex-1">
                          {question.questionText.substring(0, 120)}
                          {question.questionText.length > 120 ? "..." : ""}
                        </div>
                        {/* Result badge - moved to top right on mobile */}
                        <Badge
                          variant={
                            isCorrect
                              ? "outline"
                              : answer?.selectedOptionId === null
                                ? "secondary"
                                : "destructive"
                          }
                          className={`flex-shrink-0 text-xs sm:hidden ${
                            isCorrect
                              ? "bg-green-100 text-green-800 border-0 dark:bg-green-900/20 dark:text-green-300"
                              : answer?.selectedOptionId === null
                                ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                : ""
                          }`}
                        >
                          {isCorrect ? "✓" : answer?.selectedOptionId === null ? "−" : "✗"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
                        {question.category && (
                          <Badge
                            variant="outline"
                            className="border [&]:dark:brightness-90"
                            style={categoryStyle?.light}
                          >
                            {question.category.shortName}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`capitalize ${
                            question.difficulty === "easy"
                              ? "border-green-500 text-green-700 dark:text-green-400"
                              : question.difficulty === "hard"
                                ? "border-red-500 text-red-700 dark:text-red-400"
                                : "border-yellow-500 text-yellow-700 dark:text-yellow-400"
                          }`}
                        >
                          {question.difficulty}
                        </Badge>
                        <span className="text-muted-foreground">• {formatTime(timeSpent)}</span>
                      </div>
                    </div>

                    {/* Result badge - desktop only */}
                    <Badge
                      variant={
                        isCorrect
                          ? "outline"
                          : answer?.selectedOptionId === null
                            ? "secondary"
                            : "destructive"
                      }
                      className={`hidden sm:flex flex-shrink-0 ${
                        isCorrect
                          ? "bg-green-100 text-green-800 border-0 dark:bg-green-900/20 dark:text-green-300"
                          : answer?.selectedOptionId === null
                            ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            : ""
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <Target className="h-3 w-3 mr-1" />
                          Correct
                        </>
                      ) : answer?.selectedOptionId === null ? (
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
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* CTA Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <Trophy className="h-12 w-12 text-primary mx-auto" />
              <div>
                <h3 className="text-xl font-bold mb-2">Want to Save Your Progress?</h3>
                <p className="text-muted-foreground mb-4">
                  Create a free account to track your learning, review questions, earn achievements,
                  and access the full question bank.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/signup">
                  <Button size="lg" className="w-full sm:w-auto sm:min-w-[200px]">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Sign Up Free
                  </Button>
                </Link>
                <Link href="/uscap/quiz">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto sm:min-w-[200px]">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Take Another Quiz
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto w-full sm:justify-center">
          <Link href="/uscap" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto sm:min-w-[200px]">
              <Home className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <Link href="/tools/virtual-slides" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto sm:min-w-[200px]">
              Explore Virtual Slides
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
