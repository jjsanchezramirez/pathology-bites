// src/app/(dashboard)/dashboard/quiz/[id]/components/dialogs/PauseOverlay.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Play } from "lucide-react";

interface PauseOverlayProps {
  onResume: () => void;
  timing: "timed" | "untimed";
}

export function PauseOverlay({ onResume, timing }: PauseOverlayProps) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Quiz Paused</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            {timing === "timed"
              ? "Your timer is paused. Click resume to continue."
              : "Take your time. Click resume when you're ready to continue."}
          </p>
          <Button onClick={onResume} className="w-full" size="lg">
            <Play className="h-4 w-4 mr-2" />
            Resume Quiz
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
