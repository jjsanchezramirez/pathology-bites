"use client";

import { useState } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Check, X, CircleHelp } from "lucide-react";
import { QuestionMarkdown } from "@/shared/components/common/question-markdown";
import { ImageCarousel } from "@/shared/components/media/image-carousel";
import type { LessonCheckpoint as LessonCheckpointData } from "../types";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/**
 * An inline "check yourself" question placed in the middle of a lesson with
 * :::question[question-id]. The question comes from the question bank, so it
 * stays in sync with edits made there. Answering reveals the per-option
 * explanations and the teaching point; it does not count toward the lesson
 * quiz score or the user's question-bank performance.
 */
export function LessonCheckpoint({ checkpoint }: { checkpoint: LessonCheckpointData }) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;
  const chosen = checkpoint.options.find((o) => o.id === selected);

  return (
    <Card className="my-6 border-primary/30">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <CircleHelp className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Checkpoint</h3>
        </div>

        {checkpoint.stemImages.length > 0 && (
          <ImageCarousel images={checkpoint.stemImages} resetKey={checkpoint.id} />
        )}

        <QuestionMarkdown className="text-base font-medium">{checkpoint.stem}</QuestionMarkdown>

        <div className="space-y-2" role="radiogroup" aria-label="Answer options">
          {checkpoint.options.map((option, i) => {
            const isSelected = selected === option.id;
            let tone = "border-border hover:border-primary/50 cursor-pointer";
            if (answered) {
              if (option.isCorrect) tone = "border-green-500 bg-green-50 dark:bg-green-950/20";
              else if (isSelected) tone = "border-red-500 bg-red-50 dark:bg-red-950/20";
              else tone = "border-border opacity-60";
            }
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => !answered && setSelected(option.id)}
                disabled={answered}
                className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${tone}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium">
                  {LETTERS[i]}
                </span>
                <span className="flex-1 text-sm">
                  <QuestionMarkdown inline>{option.text}</QuestionMarkdown>
                </span>
                {answered && option.isCorrect && (
                  <Check className="h-5 w-5 shrink-0 text-green-500" />
                )}
                {answered && isSelected && !option.isCorrect && (
                  <X className="h-5 w-5 shrink-0 text-red-500" />
                )}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="space-y-3 rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
            <p className="font-semibold">{chosen?.isCorrect ? "Correct." : "Not quite."}</p>
            {checkpoint.options
              .filter((o) => o.explanation && (o.isCorrect || o.id === selected))
              .map((o) => (
                <p key={o.id}>
                  <span className="font-semibold">
                    {o.isCorrect ? "Answer: " : "Your choice: "}
                  </span>
                  <QuestionMarkdown inline>{o.explanation!}</QuestionMarkdown>
                </p>
              ))}
            {checkpoint.teachingPoint && (
              <p>
                <span className="font-semibold">Teaching point: </span>
                <QuestionMarkdown inline>{checkpoint.teachingPoint}</QuestionMarkdown>
              </p>
            )}
            {checkpoint.explanationImages.length > 0 && (
              <ImageCarousel
                images={checkpoint.explanationImages}
                resetKey={`${checkpoint.id}-explanation`}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
