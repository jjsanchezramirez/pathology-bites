"use client";

/**
 * Queue + worker pool for the image converter.
 *
 * State lives in a ref that is mirrored into React state, because the queue
 * driver is an async loop that has to read the authoritative list between
 * awaits — a plain `useState` read there would be a render behind.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { log } from "@/shared/utils/logging";
import { domCanvasFactory, supportsOffscreenCanvas } from "./converter-canvas";
import { convertImage } from "./converter-core";
import {
  DEFAULT_OPTIONS,
  type ConvertOptions,
  type ConvertedPage,
  type WorkerRequest,
  type WorkerResponse,
} from "./converter-types";

export type ItemStatus = "queued" | "converting" | "done" | "error" | "stale";

export interface ConverterItem {
  id: string;
  file: File;
  status: ItemStatus;
  outputs: ConvertedPage[];
  error?: string;
}

/** Each job holds several full-size rasters at once, so stay conservative. */
const POOL_SIZE = Math.max(1, Math.min(4, (globalThis.navigator?.hardwareConcurrency ?? 4) - 1));

function optionsSignature(options: ConvertOptions): string {
  return JSON.stringify(options);
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `item-${idCounter}`;
}

export function useImageConverter() {
  const [options, setOptions] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [items, setItems] = useState<ConverterItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);

  const itemsRef = useRef<ConverterItem[]>([]);
  const optionsRef = useRef(options);
  const workersRef = useRef<Worker[]>([]);
  const runningRef = useRef(false);
  const signaturesRef = useRef(new Map<string, string>());

  optionsRef.current = options;

  const commit = useCallback((update: (current: ConverterItem[]) => ConverterItem[]) => {
    itemsRef.current = update(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  const patchItem = useCallback(
    (id: string, patch: Partial<ConverterItem>) => {
      commit((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    },
    [commit]
  );

  /* ---------------------------------------------------------------- workers */

  const useWorkers = useMemo(() => supportsOffscreenCanvas(), []);

  const getWorker = useCallback(
    (lane: number): Worker | null => {
      if (!useWorkers) return null;
      const existing = workersRef.current[lane];
      if (existing) return existing;
      try {
        const worker = new Worker(new URL("./converter-worker.ts", import.meta.url), {
          type: "module",
        });
        workersRef.current[lane] = worker;
        return worker;
      } catch (err) {
        log.error("Image converter: worker unavailable, falling back to main thread", err);
        return null;
      }
    },
    [useWorkers]
  );

  useEffect(() => {
    const workers = workersRef.current;
    return () => {
      workers.forEach((worker) => worker.terminate());
      workers.length = 0;
    };
  }, []);

  const runInWorker = useCallback(
    (worker: Worker, request: WorkerRequest): Promise<ConvertedPage[]> =>
      new Promise((resolve, reject) => {
        const onMessage = (event: MessageEvent<WorkerResponse>) => {
          const response = event.data;
          if (response.id !== request.id) return;
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
          if (response.status === "ok") resolve(response.pages);
          else reject(new Error(response.error));
        };
        const onError = (event: ErrorEvent) => {
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
          reject(new Error(event.message || "The converter worker crashed."));
        };
        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", onError);
        worker.postMessage(request, [request.buffer]);
      }),
    []
  );

  /* ------------------------------------------------------------------ queue */

  const processItem = useCallback(
    async (item: ConverterItem, worker: Worker | null) => {
      const currentOptions = optionsRef.current;
      patchItem(item.id, { status: "converting", error: undefined, outputs: [] });
      try {
        const buffer = await item.file.arrayBuffer();
        const pages = worker
          ? await runInWorker(worker, {
              id: item.id,
              name: item.file.name,
              buffer,
              options: currentOptions,
            })
          : await convertImage(buffer, item.file.name, currentOptions, domCanvasFactory);
        signaturesRef.current.set(item.id, optionsSignature(currentOptions));
        patchItem(item.id, { status: "done", outputs: pages });
      } catch (err) {
        signaturesRef.current.delete(item.id);
        patchItem(item.id, {
          status: "error",
          outputs: [],
          error: err instanceof Error ? err.message : "Conversion failed.",
        });
      }
    },
    [patchItem, runInWorker]
  );

  const runQueue = useCallback(async () => {
    if (runningRef.current) return;
    const queue = itemsRef.current.filter(
      (item) => item.status !== "converting" && item.status !== "done"
    );
    if (queue.length === 0) return;

    runningRef.current = true;
    setIsConverting(true);
    let cursor = 0;
    const lanes = Math.min(POOL_SIZE, queue.length);

    try {
      await Promise.all(
        Array.from({ length: lanes }, async (_unused, lane) => {
          const worker = getWorker(lane);
          for (;;) {
            const index = cursor;
            cursor += 1;
            if (index >= queue.length) break;
            // Re-read from the ref: the row may have been removed mid-run.
            const live = itemsRef.current.find((item) => item.id === queue[index].id);
            if (live) await processItem(live, worker);
          }
        })
      );
    } finally {
      runningRef.current = false;
      setIsConverting(false);
    }
  }, [getWorker, processItem]);

  /* ------------------------------------------------------------------- API */

  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const added = files.map<ConverterItem>((file) => ({
        id: nextId(),
        file,
        status: "queued",
        outputs: [],
      }));
      commit((current) => [...current, ...added]);
      void runQueue();
    },
    [commit, runQueue]
  );

  const removeItem = useCallback(
    (id: string) => {
      signaturesRef.current.delete(id);
      commit((current) => current.filter((item) => item.id !== id));
    },
    [commit]
  );

  const clearAll = useCallback(() => {
    signaturesRef.current.clear();
    commit(() => []);
  }, [commit]);

  /** Mark finished rows stale so the user can re-run them under new settings. */
  const updateOptions = useCallback(
    (patch: Partial<ConvertOptions>) => {
      setOptions((current) => {
        const next = { ...current, ...patch };
        const signature = optionsSignature(next);
        commit((rows) =>
          rows.map((item) =>
            item.status === "done" && signaturesRef.current.get(item.id) !== signature
              ? { ...item, status: "stale" }
              : item
          )
        );
        return next;
      });
    },
    [commit]
  );

  const counts = useMemo(() => {
    const tally = { total: items.length, done: 0, error: 0, pending: 0, outputs: 0, bytes: 0 };
    for (const item of items) {
      if (item.status === "done") {
        tally.done += 1;
        tally.outputs += item.outputs.length;
        tally.bytes += item.outputs.reduce((sum, page) => sum + page.blob.size, 0);
      } else if (item.status === "error") tally.error += 1;
      else tally.pending += 1;
    }
    return tally;
  }, [items]);

  return {
    items,
    options,
    counts,
    isConverting,
    usesWorker: useWorkers,
    addFiles,
    removeItem,
    clearAll,
    updateOptions,
    runQueue,
  };
}
