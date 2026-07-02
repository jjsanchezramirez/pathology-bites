// src/shared/hooks/use-local-storage.ts
// useState persisted to localStorage (JSON-serialized). SSR-safe: reads lazily
// on the client, serves initialValue during server render.

"use client";

import { useState, useCallback } from "react";
import { log } from "@/shared/utils/logging";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [stored, setStored] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      log.warn(`[useLocalStorage] Failed to read "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch (error) {
          log.warn(`[useLocalStorage] Failed to write "${key}":`, error);
        }
        return next;
      });
    },
    [key]
  );

  return [stored, setValue];
}
