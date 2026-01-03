// src/features/progress/components/temporary-actions-card.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Settings, BarChart3, CheckCircle, Trophy } from "lucide-react";
import Link from "next/link";

export function TemporaryActionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          In the Meantime
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          While we're building the Progress feature, you can still track your learning using these
          existing tools:
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/performance">
            <Button variant="outline" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              View Performance Analytics
            </Button>
          </Link>
          <Link href="/dashboard/quizzes">
            <Button variant="outline" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Review Quiz History
            </Button>
          </Link>
          <Link href="/dashboard/learning">
            <Button variant="outline" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Continue Learning Modules
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
