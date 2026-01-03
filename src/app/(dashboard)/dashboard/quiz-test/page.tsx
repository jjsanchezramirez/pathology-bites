"use client";

import React, { useState } from "react";
import { cn } from "@/shared/utils";
import {
  CheckCircle,
  XCircle,
  Circle,
  Clock,
  Pause,
  ArrowLeft,
  ArrowRight,
  PanelLeftOpen,
} from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";

export default function QuizTestPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const totalQuestions = 20;

  const progress = (currentQuestion / totalQuestions) * 100;

  // Mock questions
  const questions = Array.from({ length: totalQuestions }, (_, i) => ({
    id: i + 1,
    status:
      i < currentQuestion - 1 ? "correct" : i === currentQuestion - 1 ? "current" : "unanswered",
  }));

  const getStatusIcon = (status: string) => {
    if (status === "correct") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "incorrect") return <XCircle className="h-4 w-4 text-red-500" />;
    if (status === "current") return <Circle className="h-4 w-4 text-blue-500 fill-blue-500" />;
    return <Circle className="h-4 w-4 text-gray-400" />;
  };

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
        <div className="h-full w-full flex flex-col min-w-[280px]">
          {/* Header */}
          <div className="p-5 border-b border-border shrink-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
              QUIZ PROGRESS
            </div>
            <div className="text-[13px] text-muted-foreground">
              Question {currentQuestion} of {totalQuestions}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* Progress Bar */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Question List */}
            <div className="space-y-1">
              {questions.map((question) => (
                <button
                  key={question.id}
                  onClick={() => {
                    setCurrentQuestion(question.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out flex items-center text-left cursor-pointer gap-2",
                    question.status === "current"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent hover:bg-muted"
                  )}
                >
                  {getStatusIcon(question.status)}
                  <div className="flex-1">
                    <div
                      className={cn(
                        "font-medium text-[14px]",
                        question.status === "current"
                          ? "text-primary-foreground"
                          : "text-foreground"
                      )}
                    >
                      Q{question.id}
                    </div>
                    <div
                      className={cn(
                        "text-[12px] truncate",
                        question.status === "current"
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      )}
                    >
                      Question preview text...
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header - Fixed */}
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
                Questions
              </Button>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
                  QUIZ SESSION TEST
                </div>
                <div className="text-[13px] md:text-[14px] font-medium text-foreground truncate">
                  Question {currentQuestion} of {totalQuestions}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              <div className="hidden md:flex items-center gap-2 text-xs md:text-sm">
                <Clock className="h-4 w-4" />
                <span className="font-mono font-medium">10:45</span>
              </div>

              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                  <Pause className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 px-3 hidden md:flex">
                  Save & Exit
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-auto">
          <div className="flex justify-center p-2 md:p-3">
            <div className="w-full max-w-2xl space-y-3">
              {/* Question Card */}
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Question {currentQuestion}</h3>
                      <p className="text-foreground leading-relaxed">
                        A 45-year-old woman presents with a firm, non-tender mass in the upper outer
                        quadrant of her left breast. Mammography shows a spiculated lesion. Which of
                        the following is the most likely diagnosis?
                      </p>
                    </div>

                    <div className="space-y-2">
                      {[
                        "Fibroadenoma",
                        "Infiltrating ductal carcinoma",
                        "Phyllodes tumor",
                        "Fat necrosis",
                      ].map((option, i) => (
                        <button
                          key={i}
                          className={cn(
                            "w-full p-4 rounded-lg border-2 text-left transition-all duration-200",
                            i === 1
                              ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                              : "border-border hover:border-muted-foreground hover:bg-muted"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                                i === 1 ? "border-green-500 bg-green-500" : "border-border"
                              )}
                            >
                              {i === 1 && <CheckCircle className="h-4 w-4 text-white" />}
                            </div>
                            <span className="font-medium">{option}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Explanation */}
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Explanation
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        The presentation of a spiculated lesion on mammography in a middle-aged
                        woman is highly suggestive of infiltrating ductal carcinoma. This is the
                        most common type of invasive breast cancer.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestion(Math.max(1, currentQuestion - 1))}
                  disabled={currentQuestion === 1}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                <div className="text-sm text-muted-foreground font-medium">
                  {currentQuestion} / {totalQuestions}
                </div>

                <Button
                  variant="default"
                  onClick={() => setCurrentQuestion(Math.min(totalQuestions, currentQuestion + 1))}
                  disabled={currentQuestion === totalQuestions}
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
