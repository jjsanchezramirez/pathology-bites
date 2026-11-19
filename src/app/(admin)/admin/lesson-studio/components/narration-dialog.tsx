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
import { Loader2, Mic, Sparkles } from "lucide-react";
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

interface NarrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NarrationDialog({ open, onOpenChange }: NarrationDialogProps) {
  const lesson = useEditorStore((s) => s.lesson);
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
        setVoice(lesson.audio?.voice ?? pick?.id ?? "");
      })
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [open, meta, lesson.audio?.voice]);

  const scripted = useMemo(
    () => lesson.slides.filter((s) => (s.narration?.lines.length ?? 0) > 0),
    [lesson.slides]
  );
  const words = useMemo(
    () =>
      scripted.reduce(
        (n, s) =>
          n + (s.narration?.lines ?? []).reduce((m, l) => m + l.text.split(/\s+/).length, 0),
        0
      ),
    [scripted]
  );

  const custom = meta?.voices.filter((v) => v.type !== "prebuilt") ?? [];
  const prebuilt = meta?.voices.filter((v) => v.type === "prebuilt") ?? [];

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
          title: lesson.title || "Untitled lesson",
          voice,
          style,
          model,
          align,
          slides: lesson.slides.map((s) => ({
            slideId: s.id,
            duration: s.duration,
            lines: (s.narration?.lines ?? []).map((l) => ({ id: l.id, text: l.text })),
          })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Narration failed");
      const { audio, slides, timingNote } = j as {
        audio: LessonAudio;
        slides: SlideCue[];
        timingNote?: string;
      };
      useEditorStore.getState().applyNarration(audio, slides);
      const total = audio.duration ?? 0;
      setResult(
        `Narration ready: ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")}, ` +
          `slides retimed to the voice. ${timingNote ?? "Word times are estimated from each sentence."} ` +
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
              Speaks each slide&apos;s narration script, times every sentence, and fits the slides
              to the voice.
            </DialogDescription>
          </DialogHeader>

          <div className="text-sm text-muted-foreground">
            {scripted.length} of {lesson.slides.length} slides have a script · {words} words · about{" "}
            {Math.round((words / 150) * 60)} s of speech
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
                onChange={(e) => setVoice(e.target.value)}
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
              <button
                type="button"
                className="justify-self-start text-xs text-blue-600 hover:underline"
                onClick={() => setDesignOpen((o) => !o)}
              >
                <Sparkles className="mr-1 inline h-3 w-3" />
                Design a new voice
              </button>
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
              {busy
                ? "Generating…"
                : lesson.audio?.voice
                  ? "Regenerate narration"
                  : "Generate narration"}
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
