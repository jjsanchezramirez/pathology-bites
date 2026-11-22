"use client";

import { SectionCard } from "@/shared/components/ui/page-layout";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { RotateCcw } from "lucide-react";

interface ResetSettingsCardProps {
  saving: boolean;
  onResetClick: () => void;
}

export function ResetSettingsCard({ saving, onResetClick }: ResetSettingsCardProps) {
  return (
    <SectionCard
      title="Reset Settings"
      description="Reset all your settings to their default values."
      icon={RotateCcw}
    >
      <div className="space-y-2">
        <Label>Reset All Settings</Label>
        <p className="text-sm text-muted-foreground">
          This will reset all your preferences, quiz settings, and appearance settings to their
          default values
        </p>
        <Button variant="outline" size="sm" onClick={onResetClick} disabled={saving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset All Settings
        </Button>
      </div>
    </SectionCard>
  );
}
