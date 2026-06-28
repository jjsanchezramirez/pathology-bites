"use client";

import { Button } from "@/shared/components/ui/button";
import { Info, RefreshCw } from "lucide-react";
import { FakeSelectionHighlight } from "@/shared/components/common/fake-selection-highlight";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { type GeneratedQuestion } from "@/shared/hooks/use-wsi-question-generator";
import { getOptionLabel, formatTokenUsage } from "./wsi-question-generator-utils";

interface WSIExplanationProps {
  question: GeneratedQuestion["question"];
  metadata: GeneratedQuestion["metadata"];
  isGenerating: boolean;
  showExplanation: boolean;
  onNewQuestion: () => void;
  allSlides: VirtualSlide[];
  onViewSlide: (slide: VirtualSlide) => void;
}

export function WSIExplanation({
  question,
  metadata,
  isGenerating,
  showExplanation,
  onNewQuestion,
  allSlides,
  onViewSlide,
}: WSIExplanationProps) {
  return (
    <div
      className={`transform transition-all duration-500 ${
        showExplanation ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <div className="p-2 sm:p-3 rounded-lg bg-muted/50 text-xs sm:text-sm">
        <FakeSelectionHighlight
          allSlides={allSlides}
          onViewSlide={onViewSlide}
          className="space-y-3 sm:space-y-4"
        >
          {/* Teaching Point */}
          <div>
            <h4 className="font-medium text-xs uppercase mb-1">Teaching Point</h4>
            <div className="text-muted-foreground leading-relaxed">
              {question.options?.find((option) => option.is_correct)?.explanation ||
                "No explanation available."}
            </div>
          </div>

          {/* Option Explanations */}
          {question.options?.some((opt) => opt.explanation) && (
            <div>
              <h4 className="font-medium text-xs uppercase mb-1">Answer Explanations</h4>
              <div className="space-y-2 text-muted-foreground">
                {question.options
                  ?.sort((a, b) => a.id.localeCompare(b.id)) // Ensure consistent ordering
                  ?.filter((option) => option.explanation && !option.is_correct)
                  .map((option) => {
                    const sortedOptions =
                      question.options?.sort((a, b) => a.id.localeCompare(b.id)) ?? [];
                    const optionIndex = sortedOptions.findIndex((opt) => opt.id === option.id);
                    const optionLabel = getOptionLabel(option.id, optionIndex);

                    return (
                      <div key={option.id} className="leading-relaxed">
                        <span className="font-medium">{optionLabel}.</span> {option.explanation}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* AI Disclaimer */}
          <div className="pt-2 border-t">
            <div className="flex items-start gap-2 text-xs text-amber-700">
              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                AI-generated content. May contain inaccuracies. Verify with authoritative sources.
              </span>
            </div>
          </div>

          {/* Generation Metadata - Single Line */}
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground text-center mb-3 leading-relaxed">
              <div className="break-words">
                {metadata.successful_model || metadata.model} •{" "}
                {formatTokenUsage(metadata.token_usage)} • {metadata.generation_time_ms}ms
                {(metadata.fallback_attempts || 0) > 1 && (
                  <span className="text-amber-600"> • Backup system used</span>
                )}
              </div>
            </div>

            {/* Try Another Button */}
            <div className="flex justify-center sm:justify-end">
              <Button
                onClick={onNewQuestion}
                disabled={isGenerating}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                data-no-highlight=""
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Another
              </Button>
            </div>
          </div>
        </FakeSelectionHighlight>
      </div>
    </div>
  );
}
