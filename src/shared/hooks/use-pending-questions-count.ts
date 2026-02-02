// src/shared/hooks/use-pending-questions-count.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/shared/services/client";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { debounce } from "@/shared/utils/ui/debounce";

interface PendingCounts {
  revisionQueueCount: number; // rejected questions for creators
  reviewQueueCount: number; // pending_review questions for reviewers
  draftsCount: number; // draft questions for creators
}

export function usePendingQuestionsCount() {
  const [counts, setCounts] = useState<PendingCounts>({
    revisionQueueCount: 0,
    reviewQueueCount: 0,
    draftsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();

  const fetchCounts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      // Fetch rejected questions count (for creators - revision queue)
      const { count: rejectedCount } = await supabase
        .from("questions")
        .select("*", { count: "exact", head: true })
        .eq("created_by", user.id)
        .eq("status", "rejected");

      // Fetch pending review questions count (for reviewers - review queue)
      const { count: pendingReviewCount } = await supabase
        .from("questions")
        .select("*", { count: "exact", head: true })
        .eq("reviewer_id", user.id)
        .eq("status", "pending_review");

      // Fetch draft questions count (for creators)
      const { count: draftsCount } = await supabase
        .from("questions")
        .select("*", { count: "exact", head: true })
        .eq("created_by", user.id)
        .eq("status", "draft");

      setCounts({
        revisionQueueCount: rejectedCount || 0,
        reviewQueueCount: pendingReviewCount || 0,
        draftsCount: draftsCount || 0,
      });
    } catch (error) {
      console.error("Error fetching pending questions count:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Keep a ref to the latest fetchCounts
  const fetchCountsRef = useRef(fetchCounts);
  useEffect(() => {
    fetchCountsRef.current = fetchCounts;
  }, [fetchCounts]);

  // Create a stable debounced function that calls the latest fetchCounts via ref
  const debouncedFetch = useRef(
    debounce(() => {
      fetchCountsRef.current();
    }, 500)
  ).current;

  useEffect(() => {
    // Fetch counts immediately on mount or when user changes
    fetchCounts();

    // Set up realtime subscription for question status changes
    const supabase = createClient();
    const channel = supabase
      .channel("pending-questions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "questions",
        },
        () => {
          // Use debounced version to prevent excessive refetches
          debouncedFetch();
        }
      )
      .subscribe();

    // Also listen for manual refresh events (for immediate updates)
    const handleManualRefresh = () => {
      fetchCounts(); // Immediate, non-debounced
    };

    if (typeof window !== "undefined") {
      window.addEventListener("questionStatusChanged", handleManualRefresh);
    }

    return () => {
      supabase.removeChannel(channel);
      if (typeof window !== "undefined") {
        window.removeEventListener("questionStatusChanged", handleManualRefresh);
      }
    };
  }, [fetchCounts, debouncedFetch]);

  return { ...counts, loading };
}
