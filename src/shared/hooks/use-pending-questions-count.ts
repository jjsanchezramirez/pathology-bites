// src/shared/hooks/use-pending-questions-count.ts
"use client";

// Sidebar badge counts for the signed-in user's questions.
//
// One cached copy (SWR) shared by every component that shows a badge, the four counts
// fetched in parallel, and one realtime subscription per page. Each mounted sidebar used
// to run its own four queries one after another plus its own subscription, which on
// /admin queued the dashboard's requests behind a dozen duplicate counts.

import { useEffect } from "react";
import useSWR from "swr";
import { createClient } from "@/shared/services/client";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { debounce } from "@/shared/utils/ui/debounce";
import { log } from "@/shared/utils/logging";

interface PendingCounts {
  revisionQueueCount: number; // rejected questions for creators
  reviewQueueCount: number; // pending_review questions for reviewers
  draftsCount: number; // draft questions for creators
  flaggedCount: number; // flagged questions for creators
  myQuestionsCount: number; // combined count: drafts + rejected + flagged
}

const EMPTY: PendingCounts = {
  revisionQueueCount: 0,
  reviewQueueCount: 0,
  draftsCount: 0,
  flaggedCount: 0,
  myQuestionsCount: 0,
};

async function fetchCounts(userId: string): Promise<PendingCounts> {
  const supabase = createClient();
  const count = (
    column: "created_by" | "reviewer_id",
    status: "rejected" | "pending_review" | "draft" | "flagged"
  ) =>
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq(column, userId)
      .eq("status", status)
      .then(({ count: n, error }) => {
        if (error) log.error("Error fetching pending questions count:", error);
        return n ?? 0;
      });

  const [rejected, pendingReview, drafts, flagged] = await Promise.all([
    count("created_by", "rejected"),
    count("reviewer_id", "pending_review"),
    count("created_by", "draft"),
    count("created_by", "flagged"),
  ]);

  return {
    revisionQueueCount: rejected,
    reviewQueueCount: pendingReview,
    draftsCount: drafts,
    flaggedCount: flagged,
    myQuestionsCount: drafts + rejected + flagged,
  };
}

// --- One realtime channel + one refresh listener per page -------------------------------
// Every hook instance registers a revalidate callback; a change revalidates once (all
// instances share the SWR cache entry, so one refetch updates every badge).
const listeners = new Set<() => void>();
let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

const revalidateOnce = () => listeners.values().next().value?.();
const revalidateDebounced = debounce(revalidateOnce, 500);

function subscribe(revalidate: () => void): () => void {
  listeners.add(revalidate);
  if (!channel) {
    channel = createClient()
      .channel("pending-questions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "questions" }, () =>
        revalidateDebounced()
      )
      .subscribe();
    if (typeof window !== "undefined") {
      // Fired after a status change in this tab, for an immediate update.
      window.addEventListener("questionStatusChanged", revalidateOnce);
    }
  }
  return () => {
    listeners.delete(revalidate);
    if (listeners.size === 0 && channel) {
      createClient().removeChannel(channel);
      channel = null;
      if (typeof window !== "undefined") {
        window.removeEventListener("questionStatusChanged", revalidateOnce);
      }
    }
  };
}

export function usePendingQuestionsCount() {
  const { user } = useAuthContext();
  const key = user ? (["pending-question-counts", user.id] as const) : null;

  const { data, isLoading, mutate } = useSWR(key, () => fetchCounts(user!.id), {
    dedupingInterval: 30_000,
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!key) return;
    return subscribe(() => {
      void mutate();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-subscribe per user only
  }, [user?.id, mutate]);

  return { ...(data ?? EMPTY), loading: !!key && isLoading };
}
