"use client";

// Draft a lesson with AI: a topic, optional notes, a length and up to eight
// library pictures in; template scenes out (title, image with callouts, side by
// side, ladder, take-home), each element tied to its narration sentence. The
// draft replaces the editor's lesson as a new, unsaved lesson; narrate it next.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Search, Wand2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import type { ScriptLesson } from "@/shared/lesson/script/types";
import { lessonFromScript } from "@/shared/lesson/templates";
import type { Lesson } from "@/shared/lesson/types";
import { log } from "@/shared/utils/logging";
import { useEditorStore } from "../model/store";

const MAX_IMAGES = 8;
const LENGTHS = [2, 3, 5, 8];

interface PickedImage {
  url: string;
  title?: string;
  description?: string;
  category?: string;
  width?: number;
  height?: number;
}

interface LibraryImage {
  id: string;
  url: string;
  description?: string | null;
  alt_text?: string | null;
  category?: string | null;
  width?: number | null;
  height?: number | null;
}

/** Pictures already on the slides, so a lesson can be redrafted around them. */
function imagesOnSlides(lesson: Lesson): PickedImage[] {
  const seen = new Map<string, PickedImage>();
  for (const slide of lesson.slides) {
    for (const el of slide.elements) {
      if (el.kind !== "image" || !el.imageUrl || seen.has(el.imageUrl)) continue;
      seen.set(el.imageUrl, {
        url: el.imageUrl,
        category:
          slide.imageCategory && slide.imageCategory !== "blank" ? slide.imageCategory : undefined,
        width: slide.imageWidth,
        height: slide.imageHeight,
      });
    }
  }
  return [...seen.values()].slice(0, MAX_IMAGES);
}

type Phase = "form" | "generating" | "done" | "error";

interface GenerateLessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateLessonDialog({ open, onOpenChange }: GenerateLessonDialogProps) {
  const lesson = useEditorStore((s) => s.lesson);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [minutes, setMinutes] = useState(3);
  const [picked, setPicked] = useState<PickedImage[]>([]);

  // Library search
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(false);

  // Fresh form each time it opens, seeded from the current lesson.
  useEffect(() => {
    if (!open) return;
    setPhase("form");
    setError("");
    setWarnings([]);
    setTopic((t) => t || lesson.title);
    setPicked(imagesOnSlides(lesson));
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ limit: "24" });
    if (debounced) params.set("search", debounced);
    fetch(`/api/admin/library/images?${params}`)
      .then((r) => r.json())
      .then((data) => !cancelled && setItems(data.images ?? []))
      .catch((err) => log.error("[generate-lesson] image search failed:", err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  const pickedUrls = useMemo(() => new Set(picked.map((p) => p.url)), [picked]);

  const toggle = (img: LibraryImage) => {
    setPicked((cur) => {
      if (cur.some((p) => p.url === img.url)) return cur.filter((p) => p.url !== img.url);
      if (cur.length >= MAX_IMAGES) return cur;
      return [
        ...cur,
        {
          url: img.url,
          title: img.description || img.alt_text || undefined,
          description: img.alt_text || undefined,
          category: img.category || undefined,
          width: img.width || undefined,
          height: img.height || undefined,
        },
      ];
    });
  };

  const generate = useCallback(async () => {
    setPhase("generating");
    setError("");
    try {
      const res = await fetch("/api/admin/lesson-studio/generate-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          notes: notes.trim() || undefined,
          minutes,
          images: picked,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      const script = data.script as ScriptLesson;
      const draft = lessonFromScript(script);
      const store = useEditorStore.getState();
      store.setLesson(draft);
      // A new, unsaved lesson: Save creates a row instead of overwriting the old one.
      store.setLessonMeta({ id: null, title: script.title || topic.trim() });
      setWarnings(data.warnings ?? []);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }, [topic, notes, minutes, picked]);

  const busy = phase === "generating";

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" /> Draft a lesson with AI
          </DialogTitle>
          <DialogDescription>
            Writes the narration and builds template scenes around your pictures. Every element
            stays editable; narrate it when the script reads right.
          </DialogDescription>
        </DialogHeader>

        {(phase === "form" || phase === "error" || busy) && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="gen-topic">Topic</Label>
              <Input
                id="gen-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Barrett esophagus: diagnosis and dysplasia grading"
                disabled={busy}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gen-notes">Notes (optional)</Label>
              <Textarea
                id="gen-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Outline, points it must make, look-alikes to compare, audience…"
                disabled={busy}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Length</span>
              {LENGTHS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={minutes === m ? "default" : "outline"}
                  className="h-7 px-2.5"
                  onClick={() => setMinutes(m)}
                  disabled={busy}
                >
                  {m} min
                </Button>
              ))}
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  Pictures ({picked.length}/{MAX_IMAGES})
                </span>
                <span className="text-xs text-muted-foreground">
                  Optional. Vision finds the feature to point at in each.
                </span>
              </div>
              {picked.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {picked.map((p) => (
                    <div key={p.url} className="relative h-14 w-20 overflow-hidden rounded border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.title ?? ""} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label="Remove picture"
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                        onClick={() => setPicked((cur) => cur.filter((x) => x.url !== p.url))}
                        disabled={busy}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Search the image library"
                  className="pl-9"
                  disabled={busy}
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {loading && !items.length ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
                ) : !items.length ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No pictures match.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                    {items.map((img) => {
                      const on = pickedUrls.has(img.url);
                      return (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => toggle(img)}
                          disabled={busy || (!on && picked.length >= MAX_IMAGES)}
                          title={img.description || img.alt_text || ""}
                          className={`overflow-hidden rounded border-2 transition disabled:opacity-40 ${on ? "border-primary" : "border-transparent hover:border-muted-foreground/40"}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={img.alt_text ?? ""}
                            className="aspect-[4/3] w-full bg-muted object-cover"
                            loading="lazy"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {lesson.slides.length > 0 && (
              <p className="text-xs text-muted-foreground">
                The draft replaces what&apos;s in the editor as a new, unsaved lesson. Save first if
                you want to keep the current one.
              </p>
            )}
            {phase === "error" && (
              <p className="flex items-start gap-2 rounded-md bg-red-50 p-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={generate} disabled={busy || topic.trim().length < 3}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                {busy
                  ? picked.length
                    ? "Looking at the pictures and writing…"
                    : "Writing…"
                  : "Draft lesson"}
              </Button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="grid gap-3">
            <p className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Draft ready:{" "}
              {useEditorStore.getState().lesson.slides.length} scenes. Read it through, fix anything
              wrong, then use File → Narrate with Gemini.
            </p>
            {warnings.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-800">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
