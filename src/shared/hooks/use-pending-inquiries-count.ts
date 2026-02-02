// src/shared/hooks/use-pending-inquiries-count.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/shared/services/client";
import { debounce } from "@/shared/utils/ui/debounce";

export function usePendingInquiriesCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchPendingCount = useCallback(async () => {
    try {
      setLoading(true);
      const { count: pendingCount, error } = await supabase
        .from("inquiries")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      if (error) {
        console.error("Error fetching pending inquiries count:", error);
        return;
      }

      setCount(pendingCount || 0);
    } catch (error) {
      console.error("Unexpected error fetching pending inquiries count:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Keep a ref to the latest fetchPendingCount
  const fetchPendingCountRef = useRef(fetchPendingCount);
  useEffect(() => {
    fetchPendingCountRef.current = fetchPendingCount;
  }, [fetchPendingCount]);

  // Create a stable debounced function that calls the latest fetchPendingCount via ref
  const debouncedFetch = useRef(
    debounce(() => {
      fetchPendingCountRef.current();
    }, 500)
  ).current;

  useEffect(() => {
    // Fetch counts immediately on mount
    fetchPendingCount();

    // Subscribe to real-time updates on all inquiry changes
    // We listen to all events (not just pending) because status can change from pending to resolved
    const channel = supabase
      .channel("inquiries-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inquiries",
        },
        () => {
          // Use debounced version to prevent excessive refetches
          debouncedFetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPendingCount, supabase, debouncedFetch]);

  return { count, loading };
}
