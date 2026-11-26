"use client";

// A published lesson, by id, anywhere in the app: Learning Modules, question
// explanations, and the bare /embed page other sites frame. Loads through the
// public lesson API, so it works signed out.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { cn } from "@/shared/utils";
import type { Lesson } from "@/shared/lesson/types";
import { normalizeStoredSequence } from "@/shared/lesson/normalize";
import { isLessonId, lessonApiPath } from "@/shared/lesson/embed";

const Spinner = () => (
  <div className="flex aspect-video w-full items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

// The player is heavy; load it only when a lesson is on the page.
const ExplainerPlayer = dynamic(
  () => import("./explainer-player").then((mod) => mod.ExplainerPlayer),
  { ssr: false, loading: Spinner }
);

type State =
  | { status: "loading" }
  | { status: "ready"; lesson: Lesson }
  | { status: "error"; message: string };

interface LessonEmbedProps {
  lessonId: string;
  className?: string;
  autoPlay?: boolean;
}

export function LessonEmbed({ lessonId, className, autoPlay }: LessonEmbedProps) {
  const id = lessonId.trim();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!isLessonId(id)) {
      setState({ status: "error", message: "This lesson link is not valid." });
      return;
    }
    const ctrl = new AbortController();
    setState({ status: "loading" });
    (async () => {
      try {
        const res = await fetch(lessonApiPath(id), { signal: ctrl.signal });
        if (res.status === 404) {
          setState({ status: "error", message: "This lesson isn't available." });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { lesson: row } = await res.json();
        const lesson = normalizeStoredSequence(row.sequence_data);
        if (!lesson) {
          setState({ status: "error", message: "This lesson can't be played." });
          return;
        }
        setState({
          status: "ready",
          lesson: { ...lesson, id: row.id, title: row.title ?? lesson.title },
        });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setState({
          status: "error",
          message:
            err instanceof Error
              ? `Couldn't load the lesson (${err.message}).`
              : "Couldn't load the lesson.",
        });
      }
    })();
    return () => ctrl.abort();
  }, [id]);

  return (
    // data-no-highlight keeps the player clickable inside question text highlighting.
    <div data-no-highlight className={cn("w-full overflow-hidden rounded-2xl", className)}>
      {state.status === "loading" && <Spinner />}
      {state.status === "error" && (
        <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
          {state.message}
        </div>
      )}
      {state.status === "ready" && <ExplainerPlayer lesson={state.lesson} autoPlay={autoPlay} />}
    </div>
  );
}
