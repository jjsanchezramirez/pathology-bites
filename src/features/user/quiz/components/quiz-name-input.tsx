"use client";

import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

interface QuizNameInputProps {
  value: string;
  placeholder: string;
  loadingTitles: boolean;
  onChange: (value: string) => void;
}

export function QuizNameInput({ value, placeholder, loadingTitles, onChange }: QuizNameInputProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Quiz Name</Label>
      <Input
        data-testid="quiz-name-input"
        placeholder={loadingTitles ? "Loading..." : placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        {loadingTitles
          ? "Loading previous quiz names..."
          : `Leave blank to auto-generate: "${placeholder}"`}
      </p>
    </div>
  );
}
