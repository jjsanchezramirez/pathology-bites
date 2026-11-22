"use client";

import { SectionCard } from "@/shared/components/ui/page-layout";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";

interface DangerZoneProps {
  onDeleteAccountClick: () => void;
}

export function DangerZone({ onDeleteAccountClick }: DangerZoneProps) {
  return (
    <SectionCard
      className="border-red-200 dark:border-red-800"
      title={
        // Red icon + title is the destructive-section signal, so it is rendered
        // inline rather than through SectionCard's muted `icon` slot.
        <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Danger Zone
        </span>
      }
      description="Irreversible and destructive actions."
    >
      <div className="space-y-2">
        <Label>Delete Account</Label>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all associated data
        </p>
        <Button variant="destructive" size="sm" onClick={onDeleteAccountClick}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Account
        </Button>
      </div>
    </SectionCard>
  );
}
