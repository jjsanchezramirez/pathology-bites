"use client";

import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  QuizMode,
  QuizTiming,
  QUIZ_MODE_CONFIG,
  QUIZ_TIMING_CONFIG,
} from "@/features/quiz/types/quiz";

interface ModeTimingSelectorProps {
  mode: QuizMode;
  timing: QuizTiming;
  onModeChange: (mode: QuizMode) => void;
  onTimingChange: (timing: QuizTiming) => void;
}

export function ModeTimingSelector({
  mode,
  timing,
  onModeChange,
  onTimingChange,
}: ModeTimingSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Label className="text-sm font-medium">Mode</Label>
        <div className="grid grid-cols-1 gap-2">
          {Object.entries(QUIZ_MODE_CONFIG).map(([key, config]) => (
            <Button
              key={key}
              variant={mode === key ? "default" : "outline"}
              onClick={() => onModeChange(key as QuizMode)}
            >
              {config.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Timing</Label>
        <div className="grid grid-cols-1 gap-2">
          {Object.entries(QUIZ_TIMING_CONFIG).map(([key, config]) => (
            <Button
              key={key}
              variant={timing === key ? "default" : "outline"}
              onClick={() => onTimingChange(key as QuizTiming)}
            >
              {config.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
