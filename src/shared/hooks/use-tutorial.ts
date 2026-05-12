"use client";

import { useState, useCallback, useEffect } from "react";
import { useUISettings } from "@/shared/hooks/use-user-settings";
import { userSettingsService } from "@/shared/services/user-settings";
import type { UISettings } from "@/shared/config/user-settings-defaults";

const LEGACY_PREFIX = "tutorial:";

/**
 * Map a tutorial id (e.g. "dashboard", "study-schedule") to the ui_settings field name
 * that tracks its completion (e.g. "tutorial_dashboard_completed").
 */
function fieldNameFor(tutorialId: string): keyof UISettings {
  const snake = tutorialId.replace(/-/g, "_");
  return `tutorial_${snake}_completed` as keyof UISettings;
}

/**
 * Hook to track whether a tutorial has been completed. Persists state in user_settings.ui_settings
 * (server-side) so completion syncs across devices. Falls back to legacy localStorage entries
 * (`tutorial:<id>`) on first run after the migration and pushes them up to the server.
 *
 * @param tutorialId - Unique identifier for the tutorial (e.g. "study-schedule")
 * @returns { showTutorial, completeTutorial, resetTutorial }
 */
export function useTutorial(tutorialId: string) {
  const { data: uiSettings, isLoading, invalidate } = useUISettings();
  const fieldName = fieldNameFor(tutorialId);
  const legacyKey = `${LEGACY_PREFIX}${tutorialId}`;

  // Optimistic local override so dismissals feel instant before the server roundtrip lands.
  const [optimisticallyComplete, setOptimisticallyComplete] = useState(false);

  // Read flag value from settings. We cast through a Record because the keyof lookup is dynamic.
  const serverComplete = !!(uiSettings as unknown as Record<string, unknown>)?.[fieldName];

  // Detect a legacy localStorage entry from before this migration. Hide the tutorial when present
  // even if the server doesn't know yet — the effect below will push it up.
  const [hasLegacy, setHasLegacy] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(legacyKey);
  });

  // One-time migration: legacy localStorage → server ui_settings. Idempotent.
  useEffect(() => {
    if (isLoading || !uiSettings) return;
    if (!hasLegacy) return;
    if (!serverComplete) {
      userSettingsService
        .updateUISettings({ [fieldName]: true } as Partial<UISettings>)
        .then(() => invalidate())
        .catch((err) => console.warn("Tutorial legacy migration failed:", err));
    }
    try {
      localStorage.removeItem(legacyKey);
    } catch {
      // ignore quota / private-mode errors
    }
    setHasLegacy(false);
  }, [isLoading, uiSettings, hasLegacy, serverComplete, fieldName, legacyKey, invalidate]);

  const showTutorial =
    !isLoading && !!uiSettings && !serverComplete && !hasLegacy && !optimisticallyComplete;

  const completeTutorial = useCallback(async () => {
    setOptimisticallyComplete(true);
    try {
      await userSettingsService.updateUISettings({
        [fieldName]: true,
      } as Partial<UISettings>);
      invalidate();
    } catch (error) {
      console.warn("Failed to mark tutorial completed:", error);
    }
  }, [fieldName, invalidate]);

  const resetTutorial = useCallback(async () => {
    setOptimisticallyComplete(false);
    try {
      await userSettingsService.updateUISettings({
        [fieldName]: false,
      } as Partial<UISettings>);
      invalidate();
    } catch (error) {
      console.warn("Failed to reset tutorial:", error);
    }
  }, [fieldName, invalidate]);

  return { showTutorial, completeTutorial, resetTutorial };
}
