// src/features/dashboard/components/v1-release-message.tsx
"use client";

import { useState } from "react";
import { X, MessageSquarePlus, Users } from "lucide-react";
import { SectionCard } from "@/shared/components/ui/page-layout";
import { Button } from "@/shared/components/ui/button";
import { userSettingsService } from "@/shared/services/user-settings";
import Link from "next/link";
import { log } from "@/shared/utils/logging";

interface V1ReleaseMessageProps {
  onDismiss: () => void;
}

export function V1ReleaseMessage({ onDismiss }: V1ReleaseMessageProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDismiss = async () => {
    setIsLoading(true);
    try {
      await userSettingsService.markV1ReleaseDismissed();
      onDismiss();
    } catch (error) {
      log.error("Error dismissing v1.0 release message:", error);
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
          🎉 Pathology Bites v1.0 is Live!
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

      <div className="text-sm text-muted-foreground space-y-3">
        <p>
          We're excited to announce major new features to help you master pathology more
          effectively:
        </p>

        <ul className="ml-2 list-inside list-disc space-y-1">
          <li>
            <strong>Take Quizzes:</strong> Customizable practice tests with tutor and timed modes
          </li>
          <li>
            <strong>Review Your Performance:</strong> Detailed analytics and quiz history
          </li>
          <li>
            <strong>Earn Achievements:</strong> Track milestones and celebrate progress
          </li>
          <li>
            <strong>Compare with Peers:</strong> See your percentile ranking and performance
          </li>
          <li>
            <strong>Interactive Slides:</strong> Unlimited AI-generated slide-based questions
          </li>
        </ul>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <Link
            href={`/contact?type=technical&subject=${encodeURIComponent("Feature Suggestion")}&message=${encodeURIComponent("I have a suggestion for improving Pathology Bites:")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1"
          >
            <Button size="sm" variant="outline" className="w-full">
              <MessageSquarePlus className="h-4 w-4" />
              <span>Suggest Improvements</span>
            </Button>
          </Link>
          <Link
            href={`/contact?type=general&subject=${encodeURIComponent("Join as Question Creator/Editor")}&message=${encodeURIComponent("I'm interested in joining the Pathology Bites team as a question creator or editor. Here's some information about my background:")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1"
          >
            <Button size="sm" className="w-full">
              <Users className="h-4 w-4" />
              <span>Join as Creator/Editor</span>
            </Button>
          </Link>
        </div>
      </div>
    </SectionCard>
  );
}
