// src/app/(public)/uscap/quiz/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { Separator } from "@/shared/components/ui/separator";
import { Check, X, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { PublicHero } from "@/shared/components/common/public-hero";
import Image from "next/image";

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
      orderIndex: number;
    }>;
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

  const [quizData, setQuizData] = useState<GuestQuizData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<GuestAnswer[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [_quizCompleted, setQuizCompleted] = useState(false);

  // Load quiz data from local storage
  useEffect(() => {
    if (!sessionId) return;

    const storedData = localStorage.getItem(`pathology-bites-guest-quiz-${sessionId}`);
    if (storedData) {
      const data: GuestQuizData = JSON.parse(storedData);
      setQuizData(data);
    } else {
      // Quiz not found, redirect back
      router.push("/uscap/quiz");
    }
  }, [sessionId, router]);

  const currentQuestion = quizData?.questions[currentQuestionIndex];
  const currentAnswer = answers.find((a) => a.questionId === currentQuestion?.id);

  const handleAnswerSelect = (optionId: string) => {
    if (currentAnswer) return; // Already answered

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
    } else {
      // Quiz completed, navigate to results
      setQuizCompleted(true);
      router.push(`/uscap/quiz/${sessionId}/results`);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      // Check if previous question was answered
      const prevQuestion = quizData?.questions[currentQuestionIndex - 1];
      const prevAnswer = answers.find((a) => a.questionId === prevQuestion?.id);
      setSelectedOptionId(prevAnswer?.selectedOptionId || null);
      setShowExplanation(!!prevAnswer);
    }
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
      <div className="flex min-h-screen flex-col">
        <PublicHero title="Loading Quiz..." description="Please wait" />
        <div className="container mx-auto py-8">
          <div className="max-w-3xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">Loading...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const progressPercentage = ((currentQuestionIndex + 1) / quizData.totalQuestions) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">Demo Quiz - USCAP 2026</div>
              <Badge variant="outline">
                Question {currentQuestionIndex + 1} of {quizData.totalQuestions}
              </Badge>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <section className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Info Banner - shown on first question */}
            {currentQuestionIndex === 0 && !currentAnswer && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium mb-1">Interactive Demo Quiz</p>
                      <p className="text-muted-foreground">
                        Select your answer and get immediate feedback with detailed explanations.
                        Results shown at the end (not saved).
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Question Card */}
            <Card>
              <CardContent className="p-6">
                {/* Category & Difficulty */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {currentQuestion.category && (
                    <Badge variant="secondary">
                      {currentQuestion.category.shortName || currentQuestion.category.name}
                    </Badge>
                  )}
                  <Badge
                    variant={
                      currentQuestion.difficulty === "easy"
                        ? "default"
                        : currentQuestion.difficulty === "hard"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {currentQuestion.difficulty}
                  </Badge>
                </div>

                {/* Question Text */}
                <div
                  className="prose prose-sm max-w-none mb-6"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.questionText }}
                />

                {/* Images */}
                {currentQuestion.images && currentQuestion.images.length > 0 && (
                  <div className="mb-6 space-y-4">
                    {currentQuestion.images
                      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                      .map((image) => (
                        <div key={image.id} className="space-y-2">
                          <Image
                            src={image.url}
                            alt={image.caption || "Question image"}
                            width={800}
                            height={600}
                            className="w-full rounded-lg border"
                          />
                          {image.caption && (
                            <p className="text-sm text-muted-foreground text-center">
                              {image.caption}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                )}

                <Separator className="my-6" />

                {/* Answer Options */}
                <div className="space-y-3">
                  {currentQuestion.answerOptions.map((option) => {
                    const isSelected = selectedOptionId === option.id;
                    const isAnswered = !!currentAnswer;
                    const isCorrectOption = option.isCorrect;
                    const showCorrect = isAnswered && isCorrectOption;
                    const showIncorrect = isAnswered && isSelected && !isCorrectOption;

                    return (
                      <button
                        key={option.id}
                        onClick={() => !isAnswered && handleAnswerSelect(option.id)}
                        disabled={isAnswered}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          showCorrect
                            ? "border-green-500 bg-green-50 dark:bg-green-950"
                            : showIncorrect
                              ? "border-red-500 bg-red-50 dark:bg-red-950"
                              : isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                        } ${isAnswered ? "cursor-default" : "cursor-pointer"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {showCorrect && (
                              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                            {showIncorrect && (
                              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                                <X className="w-3 h-3 text-white" />
                              </div>
                            )}
                            {!isAnswered && (
                              <div
                                className={`w-5 h-5 rounded-full border-2 ${
                                  isSelected
                                    ? "border-primary bg-primary"
                                    : "border-muted-foreground"
                                }`}
                              />
                            )}
                          </div>
                          <div className="flex-1">
                            <div
                              className="prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: option.optionText }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {showExplanation && currentQuestion.explanation && (
                  <div className="mt-6 p-4 rounded-lg bg-muted">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <span className="text-primary">Explanation</span>
                      {currentAnswer?.isCorrect ? (
                        <Badge className="bg-green-500">Correct!</Badge>
                      ) : (
                        <Badge variant="destructive">Incorrect</Badge>
                      )}
                    </h4>
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: currentQuestion.explanation }}
                    />
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
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>

              {currentQuestionIndex < quizData.totalQuestions - 1 ? (
                <Button onClick={handleNext} disabled={!currentAnswer}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleNext} disabled={!currentAnswer}>
                  View Results
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
