// Preview for the script studio. While editing it shows a still frame: the
// moment the selected sentence has fully appeared (or the whole scene, when no
// sentence is selected). Play swaps in the real lesson player from that scene.

"use client";

import { useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ExplainerPlayer } from "@/shared/components/explainer/explainer-player";
import { ScriptStage } from "@/shared/components/explainer/script-stage";
import { MOTION } from "@/shared/lesson/script/motion";
import { computeTimeline, type ScriptTimeline } from "@/shared/lesson/script/timeline";
import type { ScriptLesson } from "@/shared/lesson/script/types";
import { useScriptStudio } from "./store";

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Absolute time of the still frame for the current selection. */
export function stillTime(
  lesson: ScriptLesson,
  timeline: ScriptTimeline,
  sceneId: string | null,
  beatId: string | null
): { time: number; sceneIndex: number } {
  const found = lesson.scenes.findIndex((s) => s.id === sceneId);
  const si = found >= 0 ? found : 0;
  const st = timeline.scenes[si];
  if (!st) return { time: 0, sceneIndex: 0 };
  // Stop short of the crossfade into the next scene.
  const last = Math.max(0, st.duration - MOTION.sceneFade - 0.02);
  const bi = lesson.scenes[si].beats.findIndex((b) => b.id === beatId);
  const local = bi >= 0 ? Math.min(st.beats[bi].start + MOTION.zoom + 0.1, last) : last;
  return { time: st.start + local, sceneIndex: si };
}

export function ScriptPreview() {
  const lesson = useScriptStudio((s) => s.lesson);
  const selection = useScriptStudio((s) => s.selection);
  const timeline = useMemo(() => computeTimeline(lesson), [lesson]);
  const [play, setPlay] = useState<{ from: number; nonce: number } | null>(null);

  const { time, sceneIndex } = stillTime(lesson, timeline, selection.sceneId, selection.beatId);
  const scene = lesson.scenes[sceneIndex];
  const beat = scene?.beats.find((b) => b.id === selection.beatId);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        {play ? (
          <ExplainerPlayer
            key={play.nonce}
            lesson={lesson}
            autoPlay
            seekToTime={play.from}
            onEnded={() => setPlay(null)}
          />
        ) : (
          <div
            className="relative w-full"
            style={{ aspectRatio: "16 / 9" }}
            aria-label="Preview of the selected moment"
          >
            <ScriptStage lesson={lesson} timeline={timeline} time={time} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {play ? (
          <Button size="sm" variant="outline" onClick={() => setPlay(null)}>
            <Pause className="mr-1.5 h-3.5 w-3.5" />
            Back to editing
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              onClick={() =>
                setPlay({ from: timeline.scenes[sceneIndex]?.start ?? 0, nonce: Date.now() })
              }
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Play from scene {sceneIndex + 1}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPlay({ from: 0, nonce: Date.now() })}
            >
              Play all
            </Button>
          </>
        )}
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          Scene {sceneIndex + 1} of {lesson.scenes.length} · {formatTime(time)} of{" "}
          {formatTime(timeline.duration)}
        </span>
      </div>

      {!play && beat?.say.trim() && (
        <p className="border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-muted-foreground">
          {beat.say}
        </p>
      )}
    </div>
  );
}
