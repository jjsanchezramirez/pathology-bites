"use client";

import { Check, X } from "lucide-react";
import { FakeSelectionHighlight } from "@/shared/components/common/fake-selection-highlight";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { type GeneratedQuestion } from "@/shared/hooks/use-wsi-question-generator";
import { getOptionLabel } from "./wsi-question-generator-utils";

type QuestionOptions = GeneratedQuestion["question"]["options"];

interface WSIAnswerOptionsProps {
  options: QuestionOptions;
  selectedOption: string | null;
  isAnswered: boolean;
  onOptionClick: (optionId: string) => void;
  allSlides: VirtualSlide[];
  onViewSlide: (slide: VirtualSlide) => void;
}

export function WSIAnswerOptions({
  options,
  selectedOption,
  isAnswered,
  onOptionClick,
  allSlides,
  onViewSlide,
}: WSIAnswerOptionsProps) {
  return (
    <FakeSelectionHighlight allSlides={allSlides} onViewSlide={onViewSlide}>
      <div className="grid gap-2" role="listbox" aria-label="Answer options">
        {options
          ?.sort((a, b) => a.id.localeCompare(b.id)) // consistent A, B, C, D, E order
          ?.map((option, index) => {
            const isSelected = selectedOption === option.id;
            const showCorrect = isAnswered && option.is_correct;
            const showIncorrect = isAnswered && isSelected && !option.is_correct;
            const optionLabel = getOptionLabel(option.id, index);

            return (
              <button
                key={option.id}
                onClick={() => onOptionClick(option.id)}
                {...(isAnswered ? {} : { "data-no-highlight": "" })}
                className={`
                    p-2 sm:p-3 rounded-md text-left border text-xs sm:text-sm transition-colors duration-200
                    ${isAnswered ? "" : "select-none"}
                    ${!isAnswered ? "hover:border-muted-foreground/50 hover:bg-muted/30" : ""}
                    ${isSelected && !showCorrect && !showIncorrect ? "border-muted-foreground/70" : "border-muted-foreground/30"}
                    ${showCorrect ? "bg-green-50 border-green-600 dark:bg-green-950/30" : ""}
                    ${showIncorrect ? "bg-red-50 border-red-600 dark:bg-red-950/30" : ""}
                  `}
                // aria-disabled (not `disabled`) once answered: onOptionClick already
                // no-ops when answered, and a real disabled button blocks text selection —
                // this keeps the option's diagnosis selectable for look-up in review.
                aria-disabled={isAnswered}
                role="option"
                aria-selected={isSelected}
              >
                <div className="flex items-center gap-2">
                  <span
                    data-no-highlight=""
                    className={`
                      flex items-center justify-center w-5 h-5 rounded-full border text-xs
                      ${isSelected && !showCorrect && !showIncorrect ? "border-muted-foreground/70" : "border-muted-foreground/30"}
                      ${showCorrect ? "border-green-600" : ""}
                      ${showIncorrect ? "border-red-600" : ""}
                    `}
                  >
                    {optionLabel}
                  </span>
                  <span className="flex-1">{option.text}</span>
                  {showCorrect && <Check className="w-4 h-4 text-green-600" />}
                  {showIncorrect && <X className="w-4 h-4 text-red-600" />}
                </div>
              </button>
            );
          })}
      </div>
    </FakeSelectionHighlight>
  );
}
