"use client";

// Generate the lesson's voiceover from each slide's narration script with
// Gemini, store it in the audio library, and retime slides to it.

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Loader2, Mic, Sparkles, Trash2 } from "lucide-react";
import { useEditorStore } from "../model/store";
import type { SlideCue } from "@/shared/lesson/narration";
import type { LessonAudio } from "../model/types";

interface VoiceOption {
  id: string;
  label: string;
  type: "prebuilt" | "prompted" | "replicated";
  description?: string;
}

interface VoicesResponse {
  voices: VoiceOption[];
  models: { id: string; label: string }[];
  defaultModel: string;
  whisper: boolean;
  warning?: string;
}

/** Gemini's own one-word descriptions of the prebuilt voices that suit teaching. */
const VOICE_HINTS: Record<string, string> = {
  Charon: "informative",
  Rasalgethi: "informative",
  Sadaltager: "knowledgeable",
  Kore: "firm",
  Iapetus: "clear",
  Erinome: "clear",
  Achird: "friendly",
  Schedar: "even",
  Puck: "upbeat",
  Aoede: "breezy",
  Gacrux: "mature",
  Alnilam: "firm",
};

const DEFAULT_STYLE =
  "Calm, clear teaching voice for pathology residents. Steady, unhurried pace; pronounce medical terms carefully.";

const PREFERRED_DEFAULTS = ["mako", "charon"];

/** One slide (or scene) of script for the narration route. */
export interface NarrationSlideRequest {
  slideId: string;
  duration: number;
  lines: { id: string; text: string }[];
}

interface NarrationDialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Voice used last time, preselected when present. */
  previousVoice?: string;
  slides: NarrationSlideRequest[];
  /** What a slide is called in this editor ("slides" or "scenes"). */
  unit: string;
  onNarrated: (audio: LessonAudio, cues: SlideCue[]) => void;
}

interface NarrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Classic canvas studio: narrates each slide's script and retimes the slides. */
export function NarrationDialog({ open, onOpenChange }: NarrationDialogProps) {
  const lesson = useEditorStore((s) => s.lesson);
  const slides = useMemo(
    () =>
      lesson.slides.map((s) => ({
        slideId: s.id,
        duration: s.duration,
        lines: (s.narration?.lines ?? []).map((l) => ({ id: l.id, text: l.text })),
      })),
    [lesson.slides]
  );
  return (
    <NarrationDialogBase
      open={open}
      onOpenChange={onOpenChange}
      title={lesson.title}
      previousVoice={lesson.audio?.voice}
      slides={slides}
      unit="slides"
      onNarrated={(audio, cues) => useEditorStore.getState().applyNarration(audio, cues)}
    />
  );
}

/** Voice picker and narration request, shared by the classic and script studios. */
export function NarrationDialogBase({
  open,
  onOpenChange,
  title,
  previousVoice,
  slides,
  unit,
  onNarrated,
}: NarrationDialogBaseProps) {
  const [meta, setMeta] = useState<VoicesResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [voice, setVoice] = useState("");
  const [model, setModel] = useState("");
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [align, setAlign] = useState<"estimate" | "whisper">("estimate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const [designOpen, setDesignOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [designName, setDesignName] = useState("");
  const [designText, setDesignText] = useState("");
  const [designBusy, setDesignBusy] = useState(false);

  useEffect(() => {
    if (!open || meta) return;
    let cancelled = false;
    fetch("/api/admin/lesson-studio/narration/voices")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not load voices");
        return j as VoicesResponse;
      })
      .then((j) => {
        if (cancelled) return;
        setMeta(j);
        setModel(j.defaultModel);
        const byName = (n: string) =>
          j.voices.find((v) => v.id.toLowerCase() === n || v.label.toLowerCase() === n);
        const pick = PREFERRED_DEFAULTS.map(byName).find(Boolean) ?? j.voices[0];
        setVoice(previousVoice ?? pick?.id ?? "");
      })
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [open, meta, previousVoice]);

  const scripted = useMemo(() => slides.filter((s) => s.lines.length > 0), [slides]);
  const sentences = useMemo(() => scripted.reduce((n, s) => n + s.lines.length, 0), [scripted]);
  const words = useMemo(
    () =>
      scripted.reduce((n, s) => n + s.lines.reduce((m, l) => m + l.text.split(/\s+/).length, 0), 0),
    [scripted]
  );

  const custom = meta?.voices.filter((v) => v.type !== "prebuilt") ?? [];
  const prebuilt = meta?.voices.filter((v) => v.type === "prebuilt") ?? [];

  const selectedCustom = custom.find((v) => v.id === voice) ?? null;

  // Designed voices persist on the Gemini account until deleted.
  async function deleteSelectedVoice() {
    if (!selectedCustom) return;
    setDeleteBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/lesson-studio/narration/voices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedCustom.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Voice deletion failed");
      const remaining = (meta?.voices ?? []).filter((v) => v.id !== selectedCustom.id);
      setMeta((m) => (m ? { ...m, voices: remaining } : m));
      setVoice(remaining.find((v) => v.type === "prebuilt")?.id ?? remaining[0]?.id ?? "");
      setConfirmDelete(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function designVoice() {
    setDesignBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/lesson-studio/narration/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: designText, displayName: designName || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Voice design failed");
      const v = j.voice as VoiceOption;
      setMeta((m) => (m ? { ...m, voices: [v, ...m.voices] } : m));
      setVoice(v.id);
      setDesignOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDesignBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/admin/lesson-studio/narration/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled lesson",
          voice,
          style,
          model,
          align,
          slides,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Narration failed");
      const {
        audio,
        slides: cues,
        timingNote,
      } = j as {
        audio: LessonAudio;
        slides: SlideCue[];
        timingNote?: string;
      };
      onNarrated(audio, cues);
      const total = audio.duration ?? 0;
      setResult(
        `Narration ready: ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")}, ` +
          `${unit} retimed to the voice. ${timingNote ?? "Word times are estimated from each sentence."} ` +
          `Saved to the audio library; save the lesson to keep it.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const selectCls =
    "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Narrate with Gemini</DialogTitle>
            <DialogDescription>
              Speaks the script one sentence at a time, times every sentence, and fits the {unit} to
              the voice.
            </DialogDescription>
          </DialogHeader>

          <div className="text-sm text-muted-foreground">
            {scripted.length} of {slides.length} {unit} have a script · {words} words · about{" "}
            {Math.round((words / 150) * 60)} s of speech. Gemini speaks one sentence at a time
            within its rate limit, so this takes about{" "}
            {Math.max(1, Math.ceil((sentences * 6.2) / 60))} min.
          </div>

          {loadError && <p className="text-sm text-red-600">{loadError}</p>}
          {meta?.warning && (
            <p className="text-xs text-amber-700">
              Showing Gemini&apos;s stock voices only: {meta.warning}
            </p>
          )}

          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Voice</span>
              <select
                className={selectCls}
                value={voice}
                onChange={(e) => {
                  setVoice(e.target.value);
                  setConfirmDelete(false);
                }}
                disabled={!meta}
              >
                {custom.length > 0 && (
                  <optgroup label="Your voices">
                    {custom.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Gemini voices">
                  {prebuilt.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                      {VOICE_HINTS[v.id] ? ` (${VOICE_HINTS[v.id]})` : ""}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => setDesignOpen((o) => !o)}
                >
                  <Sparkles className="mr-1 inline h-3 w-3" />
                  Design a new voice
                </button>
                {selectedCustom &&
                  (confirmDelete ? (
                    <span className="flex items-center gap-2 text-xs">
                      <span>Delete &ldquo;{selectedCustom.label}&rdquo;?</span>
                      <button
                        type="button"
                        className="font-medium text-red-600 hover:underline disabled:opacity-50"
                        onClick={deleteSelectedVoice}
                        disabled={deleteBusy}
                      >
                        {deleteBusy && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
                        Yes, delete
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:underline"
                        onClick={() => setConfirmDelete(false)}
                        disabled={deleteBusy}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="mr-1 inline h-3 w-3" />
                      Delete this voice
                    </button>
                  ))}
              </div>
            </label>

            {designOpen && (
              <div className="grid gap-2 rounded-md border p-3">
                <Input
                  placeholder="Name (e.g. Pathology narrator)"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                />
                <textarea
                  className="min-h-[70px] rounded-md border border-input px-2 py-1 text-sm"
                  placeholder="Describe the voice: e.g. warm, mid-pitched American voice, confident attending physician explaining slides to residents."
                  value={designText}
                  onChange={(e) => setDesignText(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={designVoice}
                  disabled={designBusy || designText.trim().length < 10}
                >
                  {designBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create voice
                </Button>
              </div>
            )}

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Delivery</span>
              <textarea
                className="min-h-[56px] rounded-md border border-input px-2 py-1 text-sm"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Model</span>
                <select
                  className={selectCls}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={!meta}
                >
                  {meta?.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Word timing</span>
                <select
                  className={selectCls}
                  value={align}
                  onChange={(e) => setAlign(e.target.value as "estimate" | "whisper")}
                >
                  <option value="estimate">Estimate (no extra service)</option>
                  <option value="whisper" disabled={!meta?.whisper}>
                    Whisper{meta?.whisper ? "" : " (not set up)"}
                  </option>
                </select>
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {result && <p className="text-sm text-green-700">{result}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Close
            </Button>
            <Button onClick={generate} disabled={busy || !voice || scripted.length === 0}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mic className="mr-2 h-4 w-4" />
              )}
              {busy ? "Generating…" : previousVoice ? "Regenerate narration" : "Generate narration"}
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
