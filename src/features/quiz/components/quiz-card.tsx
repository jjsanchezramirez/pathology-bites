"use client";

import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Play,
  Target,
  Calendar,
  Hash,
  Trophy,
  Trash2,
  Eye,
  Timer,
  TimerOff,
  BookOpen,
  GraduationCap,
  HelpCircle,
  Star,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react";
import Link from "next/link";

export interface QuizSessionListItem {
  id: string;
  title: string;
  status: string;
  mode: string;
  difficulty?: string;
  totalQuestions: number;
  score?: number;
  correctAnswers?: number;
  createdAt: string;
  completedAt?: string;
  totalTimeSpent?: number;
  currentQuestionIndex?: number;
  timeLimit?: number;
  timeRemaining?: number;
  isTimedMode?: boolean;
  config?: {
    mode: string;
    timing: string;
    questionType: string;
    categorySelection: string;
  };
}

interface QuizCardProps {
  quiz: QuizSessionListItem;
  onDelete: (quiz: QuizSessionListItem) => void;
  formatDate: (dateString: string) => string;
  formatTimeSpent?: (seconds: number) => string;
}

const formatShortDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Invalid";
  }
};

export function QuizCard({ quiz, _onDelete, formatDate, formatTimeSpent }: QuizCardProps) {
  // Default time formatter if not provided
  const defaultFormatTimeSpent = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const timeFormatter = formatTimeSpent || defaultFormatTimeSpent;
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "in_progress":
        return <Badge variant="secondary">In Progress</Badge>;
      case "not_started":
        return <Badge variant="destructive">Not Started</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getModeDisplayText = (mode: string | undefined) => {
    if (!mode) return "Unknown";

    switch (mode.toLowerCase()) {
      case "practice":
        return "Practice";
      case "tutor":
        return "Tutor";
      case "timed":
        return "Timed";
      case "untimed":
        return "Untimed";
      default:
        return mode.charAt(0).toUpperCase() + mode.slice(1);
    }
  };

  const getQuestionTypeDisplay = (quiz: QuizSessionListItem) => {
    const questionType = quiz.config?.questionType || "all";
    const questionTypeMap = {
      all: "All Qs",
      unused: "Unused Qs",
      needsReview: "Qs for Review",
      marked: "Marked Qs",
      mastered: "Mastered Qs",
    };
    return questionTypeMap[questionType as keyof typeof questionTypeMap] || "All Qs";
  };

  const getTimingIcon = (quiz: QuizSessionListItem) => {
    return quiz.isTimedMode ? <Timer className="h-4 w-4" /> : <TimerOff className="h-4 w-4" />;
  };

  const getModeIcon = (quiz: QuizSessionListItem) => {
    return quiz.mode === "tutor" ? (
      <GraduationCap className="h-4 w-4" />
    ) : (
      <BookOpen className="h-4 w-4" />
    );
  };

  const getQuestionTypeIcon = (quiz: QuizSessionListItem) => {
    const questionType = quiz.config?.questionType || "all";
    const iconMap = {
      all: <HelpCircle className="h-4 w-4" />,
      unused: <Circle className="h-4 w-4" />,
      needsReview: <Target className="h-4 w-4" />,
      marked: <Star className="h-4 w-4" />,
      mastered: <CheckCircle2 className="h-4 w-4" />,
    };
    return iconMap[questionType as keyof typeof iconMap] || <HelpCircle className="h-4 w-4" />;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between">
          {/* Left side content */}
          <div className="flex-1 space-y-2">
            {/* Top left: Quiz title and status */}
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">{quiz.title}</h3>
              {getStatusBadge(quiz.status)}
            </div>

            {/* Bottom left: All metadata in one row */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              {/* Total Questions */}
              <div className="flex items-center gap-1">
                <Hash className="h-4 w-4" />
                <span>{quiz.totalQuestions} questions</span>
              </div>

              {/* Questions Remaining (for in-progress quizzes) */}
              {quiz.status === "in_progress" && (
                <div className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  <span>{quiz.totalQuestions - (quiz.currentQuestionIndex || 0)} remaining</span>
                </div>
              )}

              {/* Time Remaining (for in-progress timed quizzes) */}
              {quiz.status === "in_progress" &&
                quiz.isTimedMode &&
                quiz.timeRemaining !== undefined &&
                quiz.timeRemaining !== null && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{timeFormatter(quiz.timeRemaining)} left</span>
                  </div>
                )}

              {/* Score (for completed quizzes) */}
              {quiz.score !== undefined && quiz.score !== null && (
                <div className="flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  <span>Score {Math.round(quiz.score)}%</span>
                </div>
              )}

              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(quiz.createdAt)}</span>
              </div>

              <div className="flex items-center gap-1">
                {getModeIcon(quiz)}
                <span>{getModeDisplayText(quiz.mode)}</span>
              </div>

              <div className="flex items-center gap-1">
                {getTimingIcon(quiz)}
                <span>{quiz.isTimedMode ? "Timed" : "Untimed"}</span>
              </div>

              <div className="flex items-center gap-1">
                {getQuestionTypeIcon(quiz)}
                <span>{getQuestionTypeDisplay(quiz)}</span>
              </div>

              {/* Total Time Spent (for completed quizzes only, not in-progress) */}
              {quiz.status === "completed" &&
                quiz.totalTimeSpent !== undefined &&
                quiz.totalTimeSpent !== null &&
                quiz.totalTimeSpent > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{timeFormatter(quiz.totalTimeSpent)}</span>
                  </div>
                )}
            </div>
          </div>

          {/* Right side: Action buttons */}
          <div className="flex items-center gap-2 ml-4">
            {quiz.status === "in_progress" && (
              <Link href={`/dashboard/quiz/${quiz.id}`}>
                <Button size="sm" className="w-[180px]">
                  Continue
                </Button>
              </Link>
            )}
            {quiz.status === "completed" && (
              <>
                <Link href={`/dashboard/quiz/${quiz.id}/results`}>
                  <Button size="sm" className="w-[85px]">
                    Results
                  </Button>
                </Link>
                <Link href={`/dashboard/quiz/${quiz.id}?review=true`}>
                  <Button size="sm" variant="outline" className="w-[85px]">
                    Review
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold truncate flex-1">{quiz.title}</h3>
            {getStatusBadge(quiz.status)}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {/* Total Questions */}
            <div className="flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" />
              <span>{quiz.totalQuestions} Qs</span>
            </div>

            {/* Questions Remaining (for in-progress) */}
            {quiz.status === "in_progress" && (
              <div className="flex items-center gap-1">
                <Target className="h-3.5 w-3.5" />
                <span>{quiz.totalQuestions - (quiz.currentQuestionIndex || 0)} left</span>
              </div>
            )}

            {/* Time Remaining (for in-progress timed) */}
            {quiz.status === "in_progress" &&
              quiz.isTimedMode &&
              quiz.timeRemaining !== undefined &&
              quiz.timeRemaining !== null && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{timeFormatter(quiz.timeRemaining)} left</span>
                </div>
              )}

            {/* Score (for completed) */}
            {quiz.score !== undefined && quiz.score !== null && (
              <div className="flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" />
                <span>{Math.round(quiz.score)}%</span>
              </div>
            )}

            <div className="flex items-center gap-1">
              {getModeIcon(quiz)}
              <span>{getModeDisplayText(quiz.mode)}</span>
            </div>
            <div className="flex items-center gap-1">
              {getTimingIcon(quiz)}
              <span>{quiz.isTimedMode ? "Timed" : "Untimed"}</span>
            </div>

            {/* Total Time Spent (for completed only) */}
            {quiz.status === "completed" &&
              quiz.totalTimeSpent !== undefined &&
              quiz.totalTimeSpent !== null &&
              quiz.totalTimeSpent > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{timeFormatter(quiz.totalTimeSpent)}</span>
                </div>
              )}

            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatShortDate(quiz.createdAt)}</span>
            </div>
          </div>

          {quiz.status === "in_progress" && (
            <Link href={`/dashboard/quiz/${quiz.id}`}>
              <Button size="sm" className="w-full">
                Continue
              </Button>
            </Link>
          )}
          {quiz.status === "completed" && (
            <div className="flex gap-2">
              <Link href={`/dashboard/quiz/${quiz.id}/results`} className="flex-1">
                <Button size="sm" className="w-full">
                  Results
                </Button>
              </Link>
              <Link href={`/dashboard/quiz/${quiz.id}?review=true`} className="flex-1">
                <Button size="sm" variant="outline" className="w-full">
                  Review
                </Button>
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
