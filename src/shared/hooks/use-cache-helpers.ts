// src/shared/hooks/use-cache-helpers.ts
//
// Provider-scoped binding for cache-helpers. The helpers in
// `shared/utils/cache/cache-helpers.ts` take `mutate` as their first arg so
// they can be called from non-React code, but every in-app caller should use
// this hook to get versions pre-bound to the SWR cache `useSWR` actually
// reads from. See the comment at the top of cache-helpers.ts.

"use client";

import { useMemo } from "react";
import { useSWRConfig } from "swr";
import {
  invalidateUnifiedData,
  invalidateUserSettings,
  invalidateQuizSessions,
  patchCachedQuizSession,
  invalidateAllCaches,
  refreshAllCaches,
  updateCacheAfterQuiz,
  onQuizComplete,
  onSettingsUpdate,
  onLogout,
} from "@/shared/utils/cache/cache-helpers";
import type { QuizResult } from "@/features/user/quiz/types/quiz";

export function useCacheHelpers() {
  const { mutate } = useSWRConfig();

  return useMemo(
    () => ({
      invalidateUnifiedData: (revalidate = true) => invalidateUnifiedData(mutate, revalidate),
      invalidateUserSettings: (revalidate = true) => invalidateUserSettings(mutate, revalidate),
      invalidateQuizSessions: (revalidate = true) => invalidateQuizSessions(mutate, revalidate),
      patchCachedQuizSession,
      invalidateAllCaches: () => invalidateAllCaches(mutate),
      refreshAllCaches: () => refreshAllCaches(mutate),
      updateCacheAfterQuiz: (
        quizResult: QuizResult,
        newAchievements: QuizResult["newAchievements"] = [],
        serverMetadata?: { totalQuizzes: number; lastQuizTimestamp: string }
      ) => updateCacheAfterQuiz(mutate, quizResult, newAchievements, serverMetadata),
      onQuizComplete: () => onQuizComplete(mutate),
      onSettingsUpdate: () => onSettingsUpdate(mutate),
      onLogout: () => onLogout(mutate),
    }),
    [mutate]
  );
}
