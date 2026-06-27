"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Check, X, RotateCcw, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useImageCacheHandler } from "@/shared/hooks/use-smart-image-cache";
import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { useClientCellQuiz } from "@/shared/hooks/use-client-cell-quiz";
import { type Question, findReferenceCellInfo, generateRandomQuestion } from "./cell-quiz-helpers";
import { CellTutorial } from "./cell-tutorial";

const QUESTIONS_PER_ROUND = 10;

export default function CellQuizPage() {
  // ✅ Use optimized client-side R2 direct fetch - zero Vercel usage in production
  const { cellData, bloodCellsReference, isLoading, error } = useClientCellQuiz();

  const [mode, setMode] = useState<"menu" | "quiz" | "tutorial" | "results">("menu");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [questionNumber, setQuestionNumber] = useState(0); // Current question in round (1-10)
  const [_isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ✅ Fix: Call useImageCacheHandler at top level to avoid hook rule violations
  const handleImageLoad = useImageCacheHandler(currentQuestion?.imagePath || "", true);

  // Define functions with useCallback to prevent unnecessary re-renders
  const handleAnswerSelect = useCallback(
    (answer: string) => {
      if (selectedAnswer) return; // Already answered

      const correct = answer === currentQuestion?.correctAnswer;
      setSelectedAnswer(answer);
      setShowExplanation(true);
      setIsCorrect(correct);
      setTotalQuestions((prev) => prev + 1);

      if (correct) {
        setScore((prev) => prev + 1);
      }
    },
    [currentQuestion?.correctAnswer, selectedAnswer]
  );

  const nextQuestion = useCallback(() => {
    if (!cellData || !bloodCellsReference) return;

    // Check if we've completed the round
    if (questionNumber >= QUESTIONS_PER_ROUND) {
      setMode("results");
      return;
    }

    setCurrentQuestion(generateRandomQuestion(cellData, bloodCellsReference));
    setSelectedAnswer(null);
    setShowExplanation(false);
    setIsCorrect(null);
    setQuestionNumber((prev) => prev + 1);

    // Scroll to top of the quiz component with padding above
    if (containerRef.current) {
      const elementTop = containerRef.current.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementTop - 100; // 100px above the element

      window.scrollTo({
        top: Math.max(0, offsetPosition), // Don't scroll past top of page
        behavior: "smooth",
      });
    }
  }, [cellData, bloodCellsReference, questionNumber]);

  // Show loading state while data is being fetched
  const hasError = error;

  // Keyboard navigation for quiz mode (desktop only)
  useEffect(() => {
    if (mode !== "quiz" || !currentQuestion) return;

    // Check if we're on a mobile device (screen width < 768px)
    const isMobile = () => window.innerWidth < 768;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip keyboard handling on mobile devices
      if (isMobile()) return;

      // Prevent default behavior for our handled keys
      if (["ArrowLeft", "ArrowRight", "Space", "Enter", "1", "2", "3", "4"].includes(event.code)) {
        event.preventDefault();
      }

      // Number keys (1-4) for selecting options
      if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(event.code)) {
        const optionIndex = parseInt(event.code.replace("Digit", "")) - 1;
        if (optionIndex < currentQuestion.options.length && !selectedAnswer) {
          handleAnswerSelect(currentQuestion.options[optionIndex]);
        }
        return;
      }

      // Space or Enter to proceed to next question (when explanation is shown)
      if ((event.code === "Space" || event.code === "Enter") && showExplanation) {
        nextQuestion();
        return;
      }

      // Arrow keys for navigation (when explanation is shown)
      if (event.code === "ArrowRight" && showExplanation) {
        nextQuestion();
        return;
      }

      // Left arrow key is disabled during quiz to prevent accidental menu return
      if (event.code === "ArrowLeft") {
        // Do nothing - prevents accidental return to menu
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mode, currentQuestion, selectedAnswer, showExplanation, handleAnswerSelect, nextQuestion]);

  const startGame = () => {
    if (!cellData || !bloodCellsReference) return;
    setMode("quiz");
    setCurrentQuestion(generateRandomQuestion(cellData, bloodCellsReference));
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore(0);
    setTotalQuestions(0);
    setQuestionNumber(1);
  };

  const continueQuiz = () => {
    if (!cellData || !bloodCellsReference) return;
    setMode("quiz");
    setCurrentQuestion(generateRandomQuestion(cellData, bloodCellsReference));
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore(0);
    setTotalQuestions(0);
    setQuestionNumber(1);
  };

  const startTutorial = () => {
    setMode("tutorial");
  };

  const backToMenu = () => {
    setMode("menu");
  };

  const resetGame = () => {
    setMode("menu");
    setCurrentQuestion(null);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setIsCorrect(null);
    setScore(0);
    setTotalQuestions(0);
    setQuestionNumber(0);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHero
          title="Cell Identification Quiz"
          description="Test your hematology skills with our interactive cell identification quiz."
        />
        <section className="relative py-8">
          <div className="flex items-center justify-center p-4">
            <Card className="w-full max-w-sm p-6 md:p-8 text-center shadow-lg">
              <CardContent className="space-y-4">
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-200 rounded mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
                <p className="text-sm text-muted-foreground">Loading cell quiz data...</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  // Show error state
  if (hasError) {
    const errorMessage = error || "Unknown error occurred";
    const isR2Error = errorMessage.includes("Failed to fetch");

    return (
      <div className="flex min-h-screen flex-col">
        <PublicHero
          title="Cell Identification Quiz"
          description="Test your hematology skills with our interactive cell identification quiz."
        />
        <section className="relative py-8">
          <div className="flex items-center justify-center p-4">
            <Card className="w-full max-w-lg p-6 md:p-8 text-center shadow-lg">
              <CardContent className="space-y-4">
                <div className="text-red-600">
                  <X className="h-8 w-8 mx-auto mb-2" />
                  <h3 className="font-semibold">Failed to Load Quiz Data</h3>
                  <p className="text-sm text-muted-foreground mt-2">{errorMessage}</p>
                  {isR2Error && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-left">
                      <p className="text-xs text-yellow-800">
                        <strong>R2 Data Missing:</strong> Please upload the following files to
                        Cloudflare R2 bucket 'pathology-bites-data':
                      </p>
                      <ul className="text-xs text-yellow-700 mt-2 space-y-1">
                        <li>• cell-quiz-images.json</li>
                        <li>• cell-quiz-references.json</li>
                      </ul>
                      <p className="text-xs text-yellow-600 mt-2">
                        Use the debug menu → Cloudflare R2 tab to manage files.
                      </p>
                    </div>
                  )}
                </div>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  // Tutorial mode
  if (mode === "tutorial") {
    return (
      <CellTutorial
        onBack={backToMenu}
        bloodCellsReference={bloodCellsReference}
        cellData={cellData}
      />
    );
  }

  // Results mode - End of round screen
  if (mode === "results") {
    const percentage = Math.round((score / QUESTIONS_PER_ROUND) * 100);
    let message = "";

    if (percentage >= 90) {
      message = "Excellent work!";
    } else if (percentage >= 70) {
      message = "Great job!";
    } else if (percentage >= 50) {
      message = "Good effort!";
    } else {
      message = "Keep practicing!";
    }

    return (
      <div className="flex min-h-screen flex-col">
        <PublicHero
          title="Cell Identification Quiz"
          description="Test your hematology skills with our interactive cell identification quiz."
        />
        <section className="relative py-8">
          <div className="flex items-center justify-center p-4">
            <Card className="w-full max-w-sm p-6 md:p-8 text-center shadow-lg">
              <CardContent className="space-y-6">
                <h2 className="text-xl font-semibold text-muted-foreground">Round Complete</h2>
                <div className="text-5xl font-bold text-primary">
                  {score}/{QUESTIONS_PER_ROUND}
                </div>
                <p className="text-lg font-medium">{message}</p>
                <div className="space-y-3 pt-4">
                  <Button onClick={continueQuiz} size="lg" className="w-full">
                    Keep Going
                  </Button>
                  <Button onClick={resetGame} size="lg" variant="outline" className="w-full">
                    Back to Menu
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
        <div className="flex-1" />
        <JoinCommunitySection description="Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone." />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Cell Identification Quiz"
        description="Test your hematology skills with our interactive cell identification quiz. Identify different types of blood cells and learn from detailed explanations."
      />

      {/* Quiz Content Section */}
      <section className={`relative ${mode === "quiz" ? "py-2 md:py-8" : "py-8"}`}>
        <div className="flex items-center justify-center p-2 md:p-4">
          {mode === "menu" ? (
            <Card className="w-full max-w-sm p-6 md:p-8 text-center shadow-lg">
              <CardContent className="space-y-4 md:space-y-6">
                <h1 className="text-xl md:text-2xl font-bold">Cell Quiz</h1>
                {totalQuestions > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Last: {score}/{totalQuestions} correct
                  </div>
                )}
                <div className="space-y-3">
                  <Button onClick={startGame} size="lg" className="w-full">
                    Start Quiz
                  </Button>
                  <Button onClick={startTutorial} size="lg" variant="outline" className="w-full">
                    Learn Cells
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : mode === "quiz" && currentQuestion ? (
            <Card ref={containerRef} className="w-full max-w-4xl shadow-lg border-0 md:border">
              <CardContent className="p-3 md:p-6">
                {/* Mobile Header - Question number and score at top */}
                <div className="flex items-center justify-between mb-3 md:hidden">
                  <div className="flex items-center gap-2">
                    <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full text-xs font-medium">
                      Q {questionNumber}/{QUESTIONS_PER_ROUND}
                    </div>
                    <div className="bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-medium">
                      {score} correct
                    </div>
                  </div>
                  <Button
                    onClick={resetGame}
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>

                {/* Desktop header with score */}
                <div className="hidden md:flex items-center justify-between mb-6">
                  <div className="text-sm text-muted-foreground">
                    Question {questionNumber} of {QUESTIONS_PER_ROUND} • Score: {score}/
                    {totalQuestions}
                  </div>
                  <Button onClick={resetGame} variant="outline" size="sm">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>

                {/* Desktop question title */}
                <h2 className="hidden md:block text-xl font-semibold mb-6 text-center">
                  What cell type is this?
                </h2>

                {/* Responsive Layout: Vertical on mobile, Horizontal on desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8">
                  {/* Image - Full width on mobile, larger display */}
                  <div className="flex justify-center -mx-2 md:mx-0">
                    <div className="relative w-full aspect-[4/3] md:max-w-sm md:aspect-square md:h-80 rounded-xl overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 shadow-inner">
                      <Image
                        src={currentQuestion.imagePath}
                        alt="Cell to identify"
                        fill
                        className="object-contain p-1"
                        unoptimized={true}
                        onLoad={handleImageLoad}
                      />
                    </div>
                  </div>

                  {/* Options - Clean, modern buttons */}
                  <div className="space-y-2 md:space-y-3">
                    {currentQuestion.options.map((option, index) => {
                      const isSelected = selectedAnswer === option;
                      const isCorrect = option === currentQuestion.correctAnswer;
                      const showResult = showExplanation;

                      let buttonClass =
                        "border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-primary/5";
                      if (showResult) {
                        if (isCorrect) {
                          buttonClass =
                            "bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-600";
                        } else if (isSelected) {
                          buttonClass =
                            "bg-red-50 border-red-400 text-red-700 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600";
                        }
                      }

                      return (
                        <Button
                          key={index}
                          variant="outline"
                          className={`w-full justify-start text-left h-auto py-2.5 px-3 md:py-3 md:px-4 rounded-xl transition-all ${buttonClass}`}
                          onClick={() => handleAnswerSelect(option)}
                          disabled={!!selectedAnswer}
                        >
                          <div className="flex items-center gap-2 md:gap-3">
                            <span className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400 flex-shrink-0">
                              {index + 1}
                            </span>
                            {showResult && isCorrect && (
                              <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                            )}
                            {showResult && isSelected && !isCorrect && (
                              <X className="h-4 w-4 text-red-600 flex-shrink-0" />
                            )}
                            <span className="text-sm md:text-base font-medium">{option}</span>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Explanation - Clean card style */}
                {showExplanation && (
                  <div className="mt-3 md:mt-6 p-3 md:p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl">
                    {/* Get detailed information for the correct answer */}
                    {(() => {
                      // Find the cell data for the correct answer
                      const correctCellEntry = Object.entries(cellData).find(([cellKey, cell]) => {
                        const referenceInfo = findReferenceCellInfo(cellKey, bloodCellsReference);
                        return (
                          (referenceInfo ? referenceInfo.name : cell.name) ===
                          currentQuestion.correctAnswer
                        );
                      });

                      const correctCellKey = correctCellEntry?.[0];
                      const referenceInfo = correctCellKey
                        ? findReferenceCellInfo(correctCellKey, bloodCellsReference)
                        : null;

                      if (!referenceInfo) {
                        return (
                          <p className="text-xs md:text-sm text-muted-foreground">
                            {currentQuestion.explanation}
                          </p>
                        );
                      }

                      return (
                        <div className="space-y-1 text-xs md:text-sm text-slate-600 dark:text-slate-400">
                          {/* Size and N:C Ratio - inline */}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {referenceInfo.size && (
                              <span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  Size:
                                </span>{" "}
                                {referenceInfo.size}
                              </span>
                            )}
                            {referenceInfo.nc_ratio && (
                              <span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  N:C:
                                </span>{" "}
                                {referenceInfo.nc_ratio}
                              </span>
                            )}
                          </div>

                          {/* Key Features */}
                          {referenceInfo.key_features && (
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Features:
                              </span>{" "}
                              {referenceInfo.key_features}
                            </div>
                          )}

                          {/* Nucleus */}
                          {referenceInfo.nucleus && (
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Nucleus:
                              </span>{" "}
                              {referenceInfo.nucleus}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Next Button - Full width, prominent on mobile */}
                {showExplanation && (
                  <div className="mt-3 md:hidden">
                    <Button
                      onClick={nextQuestion}
                      className="w-full h-11 text-base font-medium rounded-xl bg-primary hover:bg-primary/90"
                    >
                      Next Question
                      <ChevronRight className="h-5 w-5 ml-1" />
                    </Button>
                  </div>
                )}

                {/* Keyboard Instructions - Desktop only */}
                <div className="border-t pt-6 mt-4 hidden md:block">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      <strong>Keyboard shortcuts:</strong> Press{" "}
                      <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                        1-4
                      </kbd>{" "}
                      to select options and{" "}
                      <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                        Space
                      </kbd>{" "}
                      or{" "}
                      <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                        Enter
                      </kbd>{" "}
                      to advance
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div>Loading...</div>
          )}
        </div>
      </section>

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community - Hidden on mobile during quiz */}
      <div className={mode === "quiz" ? "hidden md:block" : ""}>
        <JoinCommunitySection description="Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone." />
      </div>
    </div>
  );
}

// Cell Tutorial Component
