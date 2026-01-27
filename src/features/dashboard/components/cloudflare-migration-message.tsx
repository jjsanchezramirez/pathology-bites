// src/features/dashboard/components/cloudflare-migration-message.tsx
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { userSettingsService } from "@/shared/services/user-settings";

interface CloudflareMigrationMessageProps {
  onDismiss: () => void;
}

export function CloudflareMigrationMessage({ onDismiss }: CloudflareMigrationMessageProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDismiss = async () => {
    setIsLoading(true);
    try {
      await userSettingsService.markCloudflareMigrationDismissed();
      onDismiss();
    } catch (error) {
      console.error("Error dismissing Cloudflare migration message:", error);
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
          <h3 className="text-lg font-semibold text-foreground mb-2">🚀 Migrated to Cloudflare!</h3>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              We've moved to Cloudflare's global network for faster, more reliable performance
              worldwide—especially if you're accessing from outside the US.
            </p>

            <p>Enjoy the speed boost! ✨</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
