"use client";

import { useState, useCallback } from "react";
import { LessonQuiz as LessonQuizType, LessonQuizQuestion } from "../types";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Check, X, ChevronRight, Trophy } from "lucide-react";
import { QuestionMarkdown } from "@/shared/components/common/question-markdown";

interface LessonQuizProps {
  quiz: LessonQuizType;
  onComplete: (score: number) => void;
}

export function LessonQuiz({ quiz, onComplete }: LessonQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const question = quiz.questions[currentIndex];
  const isLastQuestion = currentIndex === quiz.questions.length - 1;

  const handleSelect = useCallback(
    (optionId: string) => {
      if (isAnswered) return;
      setSelectedOption(optionId);
      setIsAnswered(true);
      if (optionId === question.correctOptionId) {
        setCorrectCount((c) => c + 1);
      }
    },
    [isAnswered, question.correctOptionId]
  );

  const handleNext = useCallback(() => {
    if (isLastQuestion) {
      const score = Math.round((correctCount / quiz.questions.length) * 100);
      setIsComplete(true);
      onComplete(score);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    }
  }, [isLastQuestion, correctCount, quiz.questions.length, onComplete]);

  if (isComplete) {
    const score = Math.round((correctCount / quiz.questions.length) * 100);
    return (
      <Card className="border-primary/20">
        <CardContent className="p-8 text-center">
          <Trophy className="mx-auto h-10 w-10 text-primary mb-3" />
          <h3 className="text-2xl font-bold">Quiz Complete!</h3>
          <p className="mt-2 text-lg text-muted-foreground">
            You got {correctCount} out of {quiz.questions.length} correct ({score}%)
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Knowledge Check</h3>
        <span className="text-sm text-muted-foreground">
          Question {currentIndex + 1} of {quiz.questions.length}
        </span>
      </div>

      <QuestionCard
        question={question}
        selectedOption={selectedOption}
        isAnswered={isAnswered}
        onSelect={handleSelect}
      />

      {isAnswered && (
        <div className="flex justify-end">
          <Button onClick={handleNext}>
            {isLastQuestion ? "See Results" : "Next Question"}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  selectedOption,
  isAnswered,
  onSelect,
}: {
  question: LessonQuizQuestion;
  selectedOption: string | null;
  isAnswered: boolean;
  onSelect: (id: string) => void;
}) {
  const letters = ["A", "B", "C", "D", "E", "F"];

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <QuestionMarkdown className="text-base font-medium">{question.stem}</QuestionMarkdown>

        <div className="space-y-2">
          {question.options.map((option, i) => {
            const isSelected = selectedOption === option.id;
            const isCorrect = option.id === question.correctOptionId;
            let borderClass = "border-border hover:border-primary/50 cursor-pointer";
            let bgClass = "";

            if (isAnswered) {
              if (isCorrect) {
                borderClass = "border-green-500";
                bgClass = "bg-green-50 dark:bg-green-950/20";
              } else if (isSelected && !isCorrect) {
                borderClass = "border-red-500";
                bgClass = "bg-red-50 dark:bg-red-950/20";
              } else {
                borderClass = "border-border opacity-60";
              }
            }

            return (
              <button
                key={option.id}
                onClick={() => onSelect(option.id)}
                disabled={isAnswered}
                className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${borderClass} ${bgClass}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium">
                  {letters[i]}
                </span>
                <span className="flex-1 text-sm">
                  <QuestionMarkdown inline>{option.text}</QuestionMarkdown>
                </span>
                {isAnswered && isCorrect && <Check className="h-5 w-5 shrink-0 text-green-500" />}
                {isAnswered && isSelected && !isCorrect && (
                  <X className="h-5 w-5 shrink-0 text-red-500" />
                )}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
            <span className="font-semibold">Explanation: </span>
            <QuestionMarkdown inline>{question.explanation}</QuestionMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
