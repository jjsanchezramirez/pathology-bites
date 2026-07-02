"use client";

import { useMemo } from "react";
import type { ABPathData } from "@/shared/types/abpath";
import { useR2Json } from "@/shared/hooks/use-r2-json";
import { log } from "@/shared/utils/logging";

// Direct R2 access - CORS is configured on bucket.
// `.json.br` object on R2 stored w/ HTTP `Content-Encoding: br` — browser
// auto-decompresses, so the fetch sees plain JSON. Same pattern as
// virtual-slides v8 / ankoma / cell-quiz.
const ABPATH_API_URL =
  "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/ab-path/content-specs.json.br?v=1";

interface UseClientABPathResult {
  data: ABPathData | null;
  isLoading: boolean;
  error: string | null;
}

// This dataset never surfaces an error — on fetch failure or malformed payload
// the hook returns an empty-but-valid structure so consumers don't crash.
function emptyABPathData(): ABPathData {
  return {
    content_specifications: {
      ap_sections: [],
      cp_sections: [],
    },
    metadata: {
      total_sections: 0,
      ap_sections: 0,
      cp_sections: 0,
      last_updated: new Date().toISOString(),
      data_source: "fallback",
    },
  };
}

function transformABPathData(raw: unknown): ABPathData {
  const data = raw as ABPathData | null;
  // Validate data structure and provide defaults if missing
  if (!data || !data.content_specifications) {
    log.warn("[ABPath] Invalid data structure, using fallback");
    return emptyABPathData();
  }
  return data;
}

export function useClientABPath(): UseClientABPathResult {
  const { data, isLoading, error } = useR2Json<ABPathData>({
    url: ABPATH_API_URL,
    transform: transformABPathData,
    label: "ABPath content specifications",
  });

  const fallback = useMemo(() => (error ? emptyABPathData() : null), [error]);

  // Never expose the error — fetch failures degrade to the empty structure
  // (same behavior as the original hook, which swallowed errors).
  return { data: data ?? fallback, isLoading, error: null };
}
