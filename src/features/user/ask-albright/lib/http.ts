import "server-only";

import { NextResponse } from "next/server";
import { type AskEvent, type AskResult, NoPassagesError } from "./ask";
import { log } from "@/shared/utils/logging";

// Shared by the signed-in route (/api/user/ask-albright) and the signed-out
// homepage teaser (/api/public/ask-albright).

export const NDJSON = "application/x-ndjson";

/** One JSON object per line: meta, delta…, then done (with historyId) or error. */
export function streamResponse(
  events: AsyncGenerator<AskEvent>,
  finish: (result: AskResult) => Promise<Record<string, unknown>>,
  /** Called once if the answer fails (404 nothing found, 502 upstream), with the error. */
  onError?: (err: unknown) => Promise<void>
): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
      try {
        for await (const ev of events) {
          if (ev.type === "done") send({ type: "done", ...(await finish(ev.result)) });
          else send(ev);
        }
      } catch (err) {
        await onError?.(err).catch(() => {});
        if (err instanceof NoPassagesError)
          send({ type: "error", status: 404, error: err.message });
        else {
          log.error("[ask-albright] failed", err);
          send({
            type: "error",
            status: 502,
            error: "Dr. Albright couldn't answer that right now",
          });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": NDJSON, "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

export function limited(resetTime: number, message: string): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
  return NextResponse.json(
    { error: message, retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
