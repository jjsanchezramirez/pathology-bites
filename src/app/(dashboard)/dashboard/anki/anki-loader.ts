"use client";

// Loading side of anki-sections.ts: the index on page load, one category file
// when a category is opened, and the card-id map only for ?cardId= links. All
// share loadR2Json's per-URL module cache, so revisiting a category in the same
// session is instant, and the content-addressed URLs are safe to HTTP-cache.

import { useEffect, useState } from "react";
import type { AnkiCard } from "@/features/user/anki/types/anki-card";
import { ANKOMA_INDEX_URL, resolveAnkomaIndexUrl } from "@/shared/config/ankoma";
import { loadR2Json, useR2Json } from "@/shared/hooks/use-r2-json";
import { log } from "@/shared/utils/logging";
import { toast } from "@/shared/utils/ui/toast";
import {
  cardsFromCategoryFile,
  type AnkomaCategoryFile,
  type AnkomaIndex,
  type PublishedFile,
} from "./anki-sections";

function reportLoadError(error: string) {
  if (error.includes("Timed out")) {
    toast.error("Request timed out. Please check your network connection.");
  } else if (/network|Failed to fetch/i.test(error)) {
    toast.error("Network connection interrupted. Please refresh the page.");
  } else {
    toast.error(error);
  }
}

/** The deck/category index (a few KB). */
export function useAnkomaIndex() {
  const result = useR2Json<AnkomaIndex>({
    url: ANKOMA_INDEX_URL,
    resolveUrl: resolveAnkomaIndexUrl,
    label: "Anki index",
    timeoutMs: 10000,
  });
  useEffect(() => {
    if (result.error) reportLoadError(result.error);
  }, [result.error]);
  return result;
}

function loadCategoryCards(file: PublishedFile): Promise<AnkiCard[]> {
  return loadR2Json<AnkiCard[]>({
    url: file.url,
    transform: (raw) => cardsFromCategoryFile(raw as AnkomaCategoryFile),
    label: "Anki category",
    timeoutMs: 15000,
  });
}

export function loadCardIdMap(file: PublishedFile): Promise<Record<string, string>> {
  return loadR2Json<Record<string, string>>({
    url: file.url,
    label: "Anki card ids",
    timeoutMs: 15000,
  });
}

interface CategoryCardsState {
  cards: AnkiCard[];
  isLoading: boolean;
  error: string | null;
}

/** Cards of one category, loaded when it is selected. */
export function useCategoryCards(file: PublishedFile | undefined): CategoryCardsState {
  const url = file?.url;
  const [state, setState] = useState<CategoryCardsState & { url?: string }>({
    cards: [],
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!file) {
      setState({ cards: [], isLoading: false, error: null });
      return;
    }
    let active = true;
    setState({ url: file.url, cards: [], isLoading: true, error: null });
    loadCategoryCards(file)
      .then((cards) => {
        if (active) setState({ url: file.url, cards, isLoading: false, error: null });
      })
      .catch((e: Error) => {
        if (!active) return;
        log.error("[Anki category] Failed to load:", e);
        reportLoadError(e.message);
        setState({ url: file.url, cards: [], isLoading: false, error: e.message });
      });
    return () => {
      active = false;
    };
    // Keyed by URL: the file object is recreated with the index but is immutable per URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Never hand back cards from a previous category while the new one loads.
  if (state.url !== url) return { cards: [], isLoading: !!file, error: null };
  return { cards: state.cards, isLoading: state.isLoading, error: state.error };
}
