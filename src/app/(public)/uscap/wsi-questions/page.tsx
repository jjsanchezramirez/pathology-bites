"use client";

import { WSIQuestionGenerator } from "@/features/user/wsi-questions/components/wsi-question-generator";

export default function USCAPWSIQuestionsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Slide-Based Questions</h1>
        <p className="text-muted-foreground">
          Generate unlimited AI-powered pathology questions from whole slide images.
        </p>
      </div>

      {/* WSI Question Generator Component */}
      <WSIQuestionGenerator showCategoryFilter={true} compact={false} className="w-full" />
    </div>
  );
}
