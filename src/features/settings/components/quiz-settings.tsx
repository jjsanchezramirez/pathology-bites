"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { BookOpen } from "lucide-react";
import {
  QuizMode,
  QuizTiming,
  QuestionType,
  CategorySelection,
  QUIZ_MODE_CONFIG,
  QUIZ_TIMING_CONFIG,
  QUESTION_TYPE_CONFIG,
  CATEGORY_SELECTION_CONFIG,
} from "@/features/quiz/types/quiz";
import { type QuizSettings } from "@/shared/services/user-settings";

interface QuizSettingsProps {
  quizSettings: QuizSettings;
  saving: boolean;
  onQuizSettingChange: (key: keyof QuizSettings, value: unknown) => void;
}

export function QuizSettingsCard({ quizSettings, saving, onQuizSettingChange }: QuizSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Quiz Settings
        </CardTitle>
        <CardDescription>Set your default quiz preferences.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Default Questions per Quiz</Label>
          <Select
            value={quizSettings.default_question_count.toString()}
            onValueChange={(value) =>
              onQuizSettingChange("default_question_count", parseInt(value))
            }
            disabled={saving}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 questions</SelectItem>
              <SelectItem value="10">10 questions</SelectItem>
              <SelectItem value="25">25 questions</SelectItem>
              <SelectItem value="50">50 questions</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Default Mode</Label>
          <Select
            value={quizSettings.default_mode}
            onValueChange={(value) => onQuizSettingChange("default_mode", value as QuizMode)}
            disabled={saving}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(QUIZ_MODE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Default Timing</Label>
          <Select
            value={quizSettings.default_timing}
            onValueChange={(value) => onQuizSettingChange("default_timing", value as QuizTiming)}
            disabled={saving}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(QUIZ_TIMING_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Default Question Type</Label>
          <Select
            value={quizSettings.default_question_type}
            onValueChange={(value) =>
              onQuizSettingChange("default_question_type", value as QuestionType)
            }
            disabled={saving}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(QUESTION_TYPE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Default Categories</Label>
          <Select
            value={quizSettings.default_category_selection}
            onValueChange={(value) =>
              onQuizSettingChange("default_category_selection", value as CategorySelection)
            }
            disabled={saving}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_SELECTION_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
