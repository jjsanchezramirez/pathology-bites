// src/shared/hooks/use-r2-json.ts
// Generic loader for static JSON datasets on R2 — the shared skeleton behind
// the per-dataset use-client-* hooks (module-cached promise so each dataset is
// fetched once per session, timeout + same-origin API fallback, optional
// transform).

"use client";

import { useEffect, useState } from "react";
import { log } from "@/shared/utils/logging";

interface R2JsonOptions<T> {
  /** Primary R2 URL for the dataset. */
  url: string;
  /** Same-origin API route to fall back to when R2 is unreachable (e.g. dev). */
  fallbackUrl?: string;
  /** Post-fetch transform (e.g. rewriting relative URLs to R2 public URLs). */
  transform?: (raw: unknown) => T;
  /** Label for log messages, e.g. "CellQuiz Images". */
  label: string;
  timeoutMs?: number;
}

interface UseR2JsonResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

// One cached promise per URL so every consumer of a dataset shares the fetch.
const cachedPromises = new Map<string, Promise<unknown>>();

async function fetchWithTimeout(input: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      cache: "force-cache",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function loadR2Json<T>(options: R2JsonOptions<T>): Promise<T> {
  const { url, fallbackUrl, transform, label, timeoutMs = 8000 } = options;

  const existing = cachedPromises.get(url);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    let res: Response;
    try {
      res = await fetchWithTimeout(url, timeoutMs);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
    } catch (e) {
      if (!fallbackUrl) {
        const err = e as Error;
        throw new Error(
          err?.name === "AbortError"
            ? `Timed out fetching ${label}. Please check your network and try again.`
            : err?.message || `Failed to fetch ${label}.`
        );
      }
      log.warn(`[${label}] R2 fetch failed, falling back to ${fallbackUrl}`, e);
      try {
        res = await fetchWithTimeout(fallbackUrl, timeoutMs);
        if (!res.ok) throw new Error(`Fallback failed: ${res.status}`);
      } catch (fallbackError) {
        const err = e as Error;
        log.error(`[${label}] Both R2 and fallback API failed.`, fallbackError);
        throw new Error(
          err?.name === "AbortError"
            ? `Timed out fetching ${label}. Please check your network and try again.`
            : err?.message || `Failed to fetch ${label}.`
        );
      }
    }

    const raw = await res.json();
    return transform ? transform(raw) : (raw as T);
  })();

  // Drop failed loads from the cache so a retry (remount) can succeed.
  cachedPromises.set(
    url,
    promise.catch((e) => {
      cachedPromises.delete(url);
      throw e;
    })
  );
  return cachedPromises.get(url) as Promise<T>;
}

export function useR2Json<T>(options: R2JsonOptions<T>): UseR2JsonResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { url, fallbackUrl, transform, label, timeoutMs } = options;

  useEffect(() => {
    let mounted = true;

    loadR2Json<T>({ url, fallbackUrl, transform, label, timeoutMs })
      .then((result) => {
        if (!mounted) return;
        setData(result);
        setError(null);
      })
      .catch((e: Error) => {
        if (!mounted) return;
        log.error(`[${label}] Failed to load:`, e);
        setError(e.message);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
    // transform is typically an inline fn; the dataset is keyed by URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, fallbackUrl, label, timeoutMs]);

  return { data, isLoading, error };
}
