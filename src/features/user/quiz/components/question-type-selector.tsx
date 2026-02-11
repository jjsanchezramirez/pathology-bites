"use client";

import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Label } from "@/shared/components/ui/label";
import {
  QuestionType,
  CategorySelection,
  QUESTION_TYPE_CONFIG,
  CategoryWithStats,
} from "@/features/user/quiz/types/quiz";

interface QuestionTypeSelectorProps {
  questionType: QuestionType;
  categorySelection: CategorySelection;
  selectedCategories: string[];
  categories: CategoryWithStats[];
  questionTypeStats: {
    all: Record<QuestionType, number>;
    ap_only: Record<QuestionType, number>;
    cp_only: Record<QuestionType, number>;
  };
  onChange: (questionType: QuestionType) => void;
}

export function QuestionTypeSelector({
  questionType,
  categorySelection,
  selectedCategories,
  categories,
  questionTypeStats,
  onChange,
}: QuestionTypeSelectorProps) {
  const getQuestionCount = (key: QuestionType): number => {
    if (categorySelection === "all") {
      return questionTypeStats.all[key];
    } else if (categorySelection === "ap_only") {
      return questionTypeStats.ap_only[key];
    } else if (categorySelection === "cp_only") {
      return questionTypeStats.cp_only[key];
    } else {
      // Custom selection
      return selectedCategories.reduce((total, categoryId) => {
        const category = categories.find((c) => c.id === categoryId);
        return total + (category?.questionStats[key] || 0);
      }, 0);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Question Type</Label>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {Object.entries(QUESTION_TYPE_CONFIG).map(([key, config]) => {
          const count = getQuestionCount(key as QuestionType);

          return (
            <Button
              key={key}
              data-testid={`question-type-${key}`}
              variant={questionType === key ? "default" : "outline"}
              className="h-auto p-3 justify-between"
              onClick={() => onChange(key as QuestionType)}
            >
              <div className="text-left">
                <div className="font-medium text-sm">{config.label}</div>
              </div>
              <Badge variant="secondary" className="text-xs">
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
