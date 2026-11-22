"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { SectionCard } from "@/shared/components/ui/page-layout";
import { Button } from "@/shared/components/ui/button";
import { userSettingsService } from "@/shared/services/user-settings";
import { log } from "@/shared/utils/logging";

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
      log.error("Error dismissing quiz scoring bug notice:", error);
      onDismiss();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SectionCard>
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-lg font-semibold leading-tight tracking-tight">
          Quiz scoring bug fixed
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0"
          aria-label="Dismiss"
          onClick={handleDismiss}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-sm text-muted-foreground space-y-2">
        <p>
          Between April 13 and May 12, a server issue prevented quiz answers from being recorded.
          This issue has since been resolved. Affected quizzes are now labeled{" "}
          <strong>Data Lost</strong>
          in your history and excluded from your stats.
        </p>
        <p>— Pathology Bites Admin</p>
      </div>
    </SectionCard>
  );
}
