// src/features/dashboard/components/welcome-message.tsx
"use client";

import { useState } from "react";
import { X, Microscope, BookOpen, Plus } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { userSettingsService } from "@/shared/services/user-settings";
import Link from "next/link";

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
      console.error("Error dismissing welcome message:", error);
      // Still dismiss the message locally even if the API call fails
      onDismiss();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="relative bg-card border border-gray-200 overflow-hidden">
      <CardContent className="p-6">
        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-4 right-4 h-8 w-8 p-0 hover:bg-gray-100"
          onClick={handleDismiss}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="pr-8">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            🎓 Welcome to Pathology Bites!
          </h3>

          <div className="text-sm text-muted-foreground space-y-2 mb-4">
            <p>We're thrilled to have you join our pathology learning community! 🎉</p>

            <p>
              <strong>Get started with:</strong>
            </p>

            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong>Practice Quizzes:</strong> Test yourself with expert-curated multiple-choice
                questions
              </li>
              <li>
                <strong>Slide-Based Questions:</strong> Analyze whole slide images with AI-generated
                multiple-choice questions
              </li>
              <li>
                <strong>Ankoma Deck Viewer:</strong> Master concepts with the most comprehensive
                Anki pathology deck ever built
              </li>
            </ul>

            <p>
              Start with a quiz to assess your current knowledge, or explore our other learning
              tools.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
            <Link href="/dashboard/quiz/new" className="flex-1 min-w-0">
              <Button
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 flex items-center justify-center gap-2 px-3"
              >
                <Plus className="h-4 w-4 flex-shrink-0" />
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                  Create Your First Quiz
                </span>
              </Button>
            </Link>
            <Link href="/dashboard/wsi-questions" className="flex-1 min-w-0">
              <Button
                size="lg"
                variant="outline"
                className="w-full flex items-center justify-center gap-2 px-3"
              >
                <Microscope className="h-4 w-4 flex-shrink-0" />
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                  Slide-Based Questions
                </span>
              </Button>
            </Link>
            <Link href="/dashboard/anki" className="flex-1 min-w-0">
              <Button
                size="lg"
                variant="outline"
                className="w-full flex items-center justify-center gap-2 px-3"
              >
                <BookOpen className="h-4 w-4 flex-shrink-0" />
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                  Ankoma Deck Viewer
                </span>
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
