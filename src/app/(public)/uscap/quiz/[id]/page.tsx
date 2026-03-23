// src/app/(public)/uscap/quiz/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  PanelLeftOpen,
  CheckCircle,
  XCircle,
  Circle,
} from "lucide-react";
import { ImageCarousel } from "@/shared/components/media/image-carousel";
import { ReferencesList } from "@/shared/components/common/references-list";
import { cn } from "@/shared/utils";

interface GuestQuizData {
  sessionId: string;
  questions: Array<{
    id: string;
    questionText: string;
    explanation: string;
    difficulty: string;
    category: {
      id: string;
      name: string;
      shortName: string;
      type: string;
    } | null;
    answerOptions: Array<{
      id: string;
      optionText: string;
      isCorrect: boolean;
      explanation: string | null;
    }>;
    images: Array<{
      id: string;
      url: string;
      caption: string | null;
      alt: string;
      questionSection: string;
      orderIndex: number;
    }>;
    questionReferences: string | null;
  }>;
  totalQuestions: number;
  currentQuestionIndex: number;
  config: Record<string, unknown>;
  createdAt: string;
}

interface GuestAnswer {
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  timestamp: number;
}

export default function GuestQuizSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const contentAreaRef = useRef<HTMLDivElement>(null);

  const [quizData, setQuizData] = useState<GuestQuizData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<GuestAnswer[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Load quiz data from local storage
  useEffect(() => {
    if (!sessionId) return;

    const storedData = localStorage.getItem(`pathology-bites-guest-quiz-${sessionId}`);
    if (storedData) {
      const data: GuestQuizData = JSON.parse(storedData);
      setQuizData(data);
    } else {
      router.push("/uscap/quiz");
    }
  }, [sessionId, router]);

  const currentQuestion = quizData?.questions[currentQuestionIndex];
  const currentAnswer = answers.find((a) => a.questionId === currentQuestion?.id);

  const stemImages = useMemo(() => {
    if (!currentQuestion?.images) return [];
    return currentQuestion.images
      .filter((img) => !img.questionSection || img.questionSection === "stem")
      .map((img) => ({
        url: img.url,
        alt: img.alt || img.caption || "Question image",
        caption: img.caption || undefined,
      }));
  }, [currentQuestion]);

  const explanationImages = useMemo(() => {
    if (!currentQuestion?.images) return [];
    return currentQuestion.images
      .filter((img) => img.questionSection === "explanation")
      .map((img) => ({
        url: img.url,
        alt: img.alt || img.caption || "Explanation image",
        caption: img.caption || undefined,
      }));
  }, [currentQuestion]);

  const stemResetKey = currentQuestion?.id ? `stem-${currentQuestion.id}` : undefined;
  const explanationResetKey = currentQuestion?.id ? `expl-${currentQuestion.id}` : undefined;

  const getAnswerForQuestion = (questionId: string): GuestAnswer | undefined => {
    return answers.find((a) => a.questionId === questionId);
  };

  const handleAnswerSelect = (optionId: string) => {
    if (currentAnswer) return;

    const option = currentQuestion?.answerOptions.find((o) => o.id === optionId);
    if (!option || !currentQuestion) return;

    const newAnswer: GuestAnswer = {
      questionId: currentQuestion.id,
      selectedOptionId: optionId,
      isCorrect: option.isCorrect,
      timestamp: Date.now(),
    };

    setAnswers([...answers, newAnswer]);
    setSelectedOptionId(optionId);
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (currentQuestionIndex < (quizData?.totalQuestions || 0) - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOptionId(null);
      setShowExplanation(false);
      contentAreaRef.current?.scrollTo({ top: 0 });
    } else {
      router.push(`/uscap/quiz/${sessionId}/results`);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      const prevQuestion = quizData?.questions[currentQuestionIndex - 1];
      const prevAnswer = answers.find((a) => a.questionId === prevQuestion?.id);
      setSelectedOptionId(prevAnswer?.selectedOptionId || null);
      setShowExplanation(!!prevAnswer);
      contentAreaRef.current?.scrollTo({ top: 0 });
    }
  };

  const navigateToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    const question = quizData?.questions[index];
    const answer = question ? answers.find((a) => a.questionId === question.id) : undefined;
    setSelectedOptionId(answer?.selectedOptionId || null);
    setShowExplanation(!!answer);
    setMobileSidebarOpen(false);
    contentAreaRef.current?.scrollTo({ top: 0 });
  };

  // Save answers to local storage
  useEffect(() => {
    if (sessionId && answers.length > 0) {
      localStorage.setItem(
        `pathology-bites-guest-quiz-answers-${sessionId}`,
        JSON.stringify(answers)
      );
    }
  }, [sessionId, answers]);

  if (!quizData || !currentQuestion) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const isLastQuestion = currentQuestionIndex === quizData.totalQuestions - 1;
  const isCurrentAnswered = !!currentAnswer;

  const getOptionLabel = (index: number): string => {
    return String.fromCharCode(65 + index);
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Quiz Sidebar - Question Navigation */}
      {/* Desktop */}
      <aside className="hidden lg:flex h-full shrink-0 bg-secondary border-r border-border w-[280px] flex-col">
        <div className="p-5 border-b border-border shrink-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
            QUIZ NAVIGATION
          </div>
          <div className="text-[13px] text-muted-foreground">
            {answers.length} of {quizData.totalQuestions} answered
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-5 gap-1.5">
            {quizData.questions.map((q, index) => {
              const answer = getAnswerForQuestion(q.id);
              const isCurrent = index === currentQuestionIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => navigateToQuestion(index)}
                  className={cn(
                    "w-full aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-colors",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : answer
                        ? answer.isCorrect
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                  title={`Question ${index + 1}${answer ? (answer.isCorrect ? " (Correct)" : " (Incorrect)") : ""}`}
                >
                  {isCurrent ? (
                    <Circle className="h-3.5 w-3.5 fill-current" />
                  ) : answer ? (
                    answer.isCorrect ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )
                  ) : (
                    index + 1
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="fixed left-0 top-0 z-50 h-full w-[280px] bg-secondary border-r border-border flex flex-col lg:hidden">
            <div className="p-5 border-b border-border shrink-0 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
                  QUIZ NAVIGATION
                </div>
                <div className="text-[13px] text-muted-foreground">
                  {answers.length} of {quizData.totalQuestions} answered
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileSidebarOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-5 gap-1.5">
                {quizData.questions.map((q, index) => {
                  const answer = getAnswerForQuestion(q.id);
                  const isCurrent = index === currentQuestionIndex;

                  return (
                    <button
                      key={q.id}
                      onClick={() => navigateToQuestion(index)}
                      className={cn(
                        "w-full aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-colors",
                        isCurrent
                          ? "bg-primary text-primary-foreground"
                          : answer
                            ? answer.isCorrect
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {isCurrent ? (
                        <Circle className="h-3.5 w-3.5 fill-current" />
                      ) : answer ? (
                        answer.isCorrect ? (
                          <CheckCircle className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )
                      ) : (
                        index + 1
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-border bg-background p-5">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden"
              >
                <PanelLeftOpen className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Navigation</span>
              </Button>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
                  QUIZ SESSION
                </div>
                <div className="text-[13px] md:text-[14px] font-medium text-foreground truncate">
                  Question {currentQuestionIndex + 1} of {quizData.totalQuestions}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/uscap/quiz")}
                title="Exit quiz"
                className="h-8 px-3 hidden md:flex"
              >
                Exit Quiz
              </Button>
            </div>
          </div>
        </header>

        {/* Scrollable content area */}
        <div ref={contentAreaRef} className="flex-1 overflow-auto">
          <div className="flex justify-center p-2 md:p-3 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
            <div className="w-full max-w-2xl space-y-3">
              {/* Question Display */}
              <Card>
                <CardContent className="space-y-6 pt-6">
                  {/* Question Stem */}
                  <div>
                    <p className="text-muted-foreground">{currentQuestion.questionText}</p>
                  </div>

                  {/* Stem Images */}
                  {stemImages.length > 0 && (
                    <div>
                      <ImageCarousel
                        images={stemImages}
                        className="border rounded-lg"
                        resetKey={stemResetKey}
                      />
                    </div>
                  )}

                  {/* Answer Options */}
                  <div className="grid gap-2" role="listbox" aria-label="Answer options">
                    {currentQuestion.answerOptions.map((option, index) => {
                      const isSelected = selectedOptionId === option.id;
                      const isAnswered = !!currentAnswer;
                      const showCorrect = showExplanation && option.isCorrect;
                      const showIncorrect = showExplanation && isSelected && !option.isCorrect;
                      const label = getOptionLabel(index);

                      return (
                        <button
                          key={option.id}
                          onClick={() => !isAnswered && handleAnswerSelect(option.id)}
                          disabled={isAnswered}
                          className={cn(
                            "w-full p-3 text-left border rounded-lg transition-colors",
                            isSelected && !showExplanation && "border-blue-500 bg-blue-500/10",
                            !isSelected &&
                              !showExplanation &&
                              !showCorrect &&
                              "border-gray-200 dark:border-gray-700",
                            showCorrect && "border-green-500 bg-green-500/5",
                            showIncorrect && "border-red-500 bg-red-500/5",
                            !showExplanation &&
                              "hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer",
                            showExplanation && "cursor-default"
                          )}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium",
                                isSelected &&
                                  !showExplanation &&
                                  "border-blue-500 bg-blue-500 text-white",
                                !isSelected &&
                                  !showCorrect &&
                                  !showIncorrect &&
                                  "border-gray-300 dark:border-gray-600",
                                showCorrect && "border-green-600 bg-green-600 text-white",
                                showIncorrect && "border-red-600 bg-red-600 text-white"
                              )}
                            >
                              {label}
                            </span>
                            <span className="flex-1">{option.optionText}</span>
                            {showCorrect && <Check className="w-4 h-4 text-green-600" />}
                            {showIncorrect && <X className="w-4 h-4 text-red-600" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation Section */}
                  {showExplanation && (
                    <div className="p-4 rounded-lg bg-muted/50 text-sm space-y-4">
                      {/* Teaching Point */}
                      {currentQuestion.explanation && (
                        <div>
                          <h4 className="font-medium text-xs uppercase mb-2">Teaching Point</h4>
                          <div className="text-muted-foreground">{currentQuestion.explanation}</div>
                        </div>
                      )}

                      {/* Individual Option Explanations */}
                      {currentQuestion.answerOptions.some((o) => o.explanation) && (
                        <div>
                          <h4 className="font-medium text-xs uppercase mb-2">
                            Answer Explanations
                          </h4>
                          <div className="space-y-2 text-muted-foreground">
                            {currentQuestion.answerOptions
                              .filter((opt) => opt.explanation)
                              .map((option) => (
                                <div key={option.id} className="flex gap-2">
                                  <span className="font-medium">
                                    {getOptionLabel(currentQuestion.answerOptions.indexOf(option))}.
                                  </span>
                                  <span>{option.explanation}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Explanation Images */}
                      {explanationImages.length > 0 && (
                        <div>
                          <h4 className="font-medium text-xs uppercase mb-2">Reference Images</h4>
                          <ImageCarousel
                            images={explanationImages}
                            className="bg-white border rounded-lg"
                            resetKey={explanationResetKey}
                          />
                        </div>
                      )}

                      {/* References */}
                      {currentQuestion.questionReferences && (
                        <ReferencesList references={currentQuestion.questionReferences} />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                <div className="flex gap-2">
                  {isCurrentAnswered ? (
                    <Button onClick={handleNext}>
                      {isLastQuestion ? "Complete Quiz" : "Next"}
                      {!isLastQuestion && <ChevronRight className="h-4 w-4 ml-2" />}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={handleNext}>
                      Skip Question
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
