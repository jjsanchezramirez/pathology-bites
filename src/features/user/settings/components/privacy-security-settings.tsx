"use client";

import { SectionCard } from "@/shared/components/ui/page-layout";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Shield, RefreshCw } from "lucide-react";

interface PrivacySecuritySettingsProps {
  isExporting: boolean;
  onDataExport: () => void;
}

export function PrivacySecuritySettings({
  isExporting,
  onDataExport,
}: PrivacySecuritySettingsProps) {
  return (
    <SectionCard
      title="Privacy & Security"
      description="Manage your privacy and security settings."
      icon={Shield}
    >
      <div className="space-y-2">
        <Label>Data Export</Label>
        <p className="text-sm text-muted-foreground">
          Download a complete copy of your account data
        </p>
        <Button variant="outline" size="sm" onClick={onDataExport} disabled={isExporting}>
          {isExporting ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            "Request Data Export"
          )}
        </Button>
      </div>
    </SectionCard>
  );
}
