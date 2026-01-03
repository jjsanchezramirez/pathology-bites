// src/features/progress/components/progress-vs-performance-cards.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { TrendingUp, BarChart3 } from "lucide-react";

export function ProgressVsPerformanceCards() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border-purple-200 bg-purple-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-800">
            <TrendingUp className="h-5 w-5" />
            Progress Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-purple-700 mb-4">
            <strong>Progress</strong> focuses on your learning journey over time - tracking
            milestones, study streaks, module completion, and personal growth metrics.
          </p>
          <ul className="text-sm text-purple-600 space-y-1">
            <li>• Learning milestones and achievements</li>
            <li>• Study streaks and consistency</li>
            <li>• Module and lesson completion rates</li>
            <li>• Time spent learning</li>
            <li>• Personal growth over time</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <BarChart3 className="h-5 w-5" />
            Performance Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-blue-700 mb-4">
            <strong>Performance</strong> focuses on your competency and accuracy - analyzing quiz
            results, identifying knowledge gaps, and measuring mastery of pathology topics.
          </p>
          <ul className="text-sm text-blue-600 space-y-1">
            <li>• Quiz scores and accuracy trends</li>
            <li>• Knowledge gaps analysis</li>
            <li>• Topic mastery levels</li>
            <li>• Comparative performance metrics</li>
            <li>• Areas needing improvement</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
