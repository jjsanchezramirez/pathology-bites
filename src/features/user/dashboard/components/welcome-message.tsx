// src/features/dashboard/components/welcome-message.tsx
"use client";

import { useState } from "react";
import { X, Microscope, BookOpen, ClipboardList } from "lucide-react";
import { SectionCard } from "@/shared/components/ui/page-layout";
import { Button } from "@/shared/components/ui/button";
import { userSettingsService } from "@/shared/services/user-settings";
import Link from "next/link";
import { log } from "@/shared/utils/logging";

interface WelcomeMessageProps {
  onDismiss: () => void;
}

export function WelcomeMessage({ onDismiss }: WelcomeMessageProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDismiss = async () => {
    setIsLoading(true);
    try {
      await userSettingsService.markWelcomeMessageSeen();
      onDismiss();
    } catch (error) {
      log.error("Error dismissing welcome message:", error);
      // Still dismiss the message locally even if the API call fails
      onDismiss();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SectionCard>
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-lg font-semibold leading-tight tracking-tight">
          🎓 Welcome to Pathology Bites!
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

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>We're thrilled to have you join our pathology learning community! 🎉</p>

        <p>
          <strong>Get started with:</strong>
        </p>

        <ul className="ml-2 list-inside list-disc space-y-1">
          <li>
            <strong>Practice Quizzes:</strong> Test yourself with expert-curated multiple-choice
            questions
          </li>
          <li>
            <strong>Slide-Based Questions:</strong> Analyze whole slide images with AI-generated
            multiple-choice questions
          </li>
          <li>
            <strong>Ankoma Deck Viewer:</strong> Master concepts with the most comprehensive Anki
            pathology deck ever built
          </li>
        </ul>

        <p>
          Start with a quiz to assess your current knowledge, or explore our other learning tools.
        </p>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row">
        <Link href="/dashboard/wsi-questions" className="flex-1 min-w-0">
          <Button size="lg" variant="outline" className="w-full px-3">
            <Microscope className="h-4 w-4 shrink-0" />
            <span className="truncate">Slide-Based Questions</span>
          </Button>
        </Link>
        <Link href="/dashboard/anki" className="flex-1 min-w-0">
          <Button size="lg" variant="outline" className="w-full px-3">
            <BookOpen className="h-4 w-4 shrink-0" />
            <span className="truncate">Ankoma Deck Viewer</span>
          </Button>
        </Link>
        <Link href="/dashboard/quiz/new" className="flex-1 min-w-0">
          <Button size="lg" className="w-full px-3">
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span className="truncate">Create Your First Quiz</span>
          </Button>
        </Link>
      </div>
    </SectionCard>
  );
}
