"use client";

import { useEffect } from "react";
import { AnkomaData, AnkomaDeck } from "@/features/user/anki/types/anki-card";
import { parseAnkomaData } from "@/features/user/anki/utils/ankoma-parser";
import { ANKOMA_JSON_URL } from "@/shared/config/ankoma";
import { useR2Json } from "@/shared/hooks/use-r2-json";
import { toast } from "@/shared/utils/ui/toast";

function transformAnkoma(raw: unknown): AnkomaData {
  return parseAnkomaData(raw as AnkomaDeck);
}

export function useClientAnkoma() {
  // No same-origin fallback: in production we deliberately don't proxy through
  // Vercel to avoid bandwidth/invocations — R2 (with CORS) is the only source.
  const {
    data: ankomaData,
    isLoading,
    error,
  } = useR2Json<AnkomaData>({
    url: ANKOMA_JSON_URL,
    transform: transformAnkoma,
    label: "Ankoma data",
    timeoutMs: 15000,
  });

  // Surface load failures as toasts (network blips, laptop sleep/wake, etc.)
  useEffect(() => {
    if (!error) return;
    if (error.includes("Timed out")) {
      toast.error("Request timed out. Please check your network connection.");
    } else if (/network|Failed to fetch/i.test(error)) {
      toast.error("Network connection interrupted. Please refresh the page.");
    } else {
      toast.error(error);
    }
  }, [error]);

  const totalCards = ankomaData?.totalCards || 0;
  const sections = ankomaData?.sections || [];
  const lastLoaded = ankomaData?.lastLoaded;

  return {
    // Data
    ankomaData,
    sections,
    isLoading,
    error,

    // Metadata
    totalCards,
    lastLoaded,

    // Cache status
    isDataCached: ankomaData !== null,
  };
}
