"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Privacy & Security
        </CardTitle>
        <CardDescription>Manage your privacy and security settings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}
