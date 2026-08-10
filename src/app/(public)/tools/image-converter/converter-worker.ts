/**
 * Web Worker wrapper around `convertImage`.
 *
 * Decoding a large TIFF blocks its thread for seconds, so the work is kept off
 * the main thread. One job at a time per worker; the hook runs a small pool.
 */

import { offscreenCanvasFactory } from "./converter-canvas";
import { convertImage } from "./converter-core";
import type { WorkerRequest, WorkerResponse } from "./converter-types";

// `self` is typed as `Window` under lib.dom; narrow it to the worker surface we use.
const scope = self as unknown as {
  postMessage(message: WorkerResponse): void;
  addEventListener(type: "message", listener: (event: MessageEvent<WorkerRequest>) => void): void;
};

scope.addEventListener("message", (event) => {
  const { id, name, buffer, options } = event.data;
  convertImage(buffer, name, options, offscreenCanvasFactory)
    .then((pages) => scope.postMessage({ id, status: "ok", pages }))
    .catch((err: unknown) =>
      scope.postMessage({
        id,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      })
    );
});
