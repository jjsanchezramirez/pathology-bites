"use client";

import { useCallback, useRef } from "react";
import { useAuth } from "@/shared/hooks/use-auth";
import { useCounterSettings } from "@/shared/hooks/use-user-settings";
import { userSettingsService } from "@/shared/services/user-settings";
import type { CounterConfig } from "@/shared/config/user-settings-defaults";

const DEBOUNCE_MS = 2000;

export function useCounterSync() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const {
    data: serverConfig,
    isLoading: isSettingsLoading,
    invalidate,
  } = useCounterSettings({
    enabled: isAuthenticated,
  });

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveConfigToServer = useCallback(
    (config: CounterConfig) => {
      if (!isAuthenticated) return;

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(async () => {
        try {
          await userSettingsService.updateCounterSettings(config);
          invalidate();
        } catch (error) {
          console.error("[CounterSync] Failed to save config to server:", error);
        }
      }, DEBOUNCE_MS);
    },
    [isAuthenticated, invalidate]
  );

  return {
    serverConfig,
    isLoadingServer: isAuthLoading || (isAuthenticated && isSettingsLoading),
    isAuthenticated,
    saveConfigToServer,
  };
}
