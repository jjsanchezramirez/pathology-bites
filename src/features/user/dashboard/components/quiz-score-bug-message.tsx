"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { userSettingsService } from "@/shared/services/user-settings";

interface QuizScoreBugMessageProps {
  onDismiss: () => void;
}

export function QuizScoreBugMessage({ onDismiss }: QuizScoreBugMessageProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDismiss = async () => {
    setIsLoading(true);
    try {
      await userSettingsService.markQuizScoreBugDismissed();
      onDismiss();
    } catch (error) {
      console.error("Error dismissing quiz scoring bug notice:", error);
      onDismiss();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-card border border-gray-200 overflow-hidden">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold text-foreground">Quiz scoring bug fixed</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0 hover:bg-gray-100"
            onClick={handleDismiss}
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Between April 13 and May 12, a server issue prevented quiz answers from being recorded.
            Affected quizzes are now labeled <strong>Data Lost</strong> in your history and excluded
            from your stats.
          </p>
          <p>— Pathology Bites Admin</p>
        </div>
      </CardContent>
    </Card>
  );
}
