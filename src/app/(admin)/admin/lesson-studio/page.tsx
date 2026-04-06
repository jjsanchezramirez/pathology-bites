// Lesson Studio — the new editor (Phase 7 integration).
// Layout: top bar · library | canvas | inspector · animation track · filmstrip.
// Preview mode swaps the canvas for ExplainerPlayer using a sequence derived
// from the current Lesson via to-sequence.ts.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExplainerPlayer } from "@/shared/components/explainer/explainer-player";
import { fetchAudio } from "@/features/admin/audio/services/audio";
import type { Audio as AudioRecord } from "@/features/admin/audio/types";
import type { ExplainerSequence } from "@/shared/types/explainer";

import { useEditorStore } from "./model/store";
import { lessonToSequence } from "./model/to-sequence";
import { sequenceToLesson } from "./model/from-sequence";
import { emptyLesson } from "./model/types";

import { LibraryPanel } from "./library-panel";
import { ToolPalette } from "./tool-palette";
import { EditorCanvas } from "./canvas/editor-canvas";
import { Inspector } from "./inspector/inspector";
import { AnimationTrack } from "./track/animation-track";
import { Filmstrip } from "./filmstrip/filmstrip";
import { TopBar } from "./top-bar";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";

import { AudioPickerDialog } from "./components/audio-picker-dialog";
import { SaveToDatabaseDialog } from "./components/save-to-database-dialog";
import { LoadFromDatabaseDialog } from "./components/load-from-database-dialog";
import { ExportDialog } from "./components/export-dialog";

export default function LessonStudioPage() {
  const lesson = useEditorStore((s) => s.lesson);
  const mode = useEditorStore((s) => s.mode);
  const setLesson = useEditorStore((s) => s.setLesson);
  const setAudio = useEditorStore((s) => s.setAudio);
  const setLessonMeta = useEditorStore((s) => s.setLessonMeta);

  useKeyboardShortcuts();

  // ---- Derived sequence (for preview, save, export) ----------------------

  const sequence: ExplainerSequence | null = useMemo(() => lessonToSequence(lesson), [lesson]);

  // ---- Audio picker ------------------------------------------------------

  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [audioRecords, setAudioRecords] = useState<AudioRecord[]>([]);
  const [audioSearch, setAudioSearch] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);

  const loadAudioRecords = useCallback(async (search?: string) => {
    setAudioLoading(true);
    try {
      const result = await fetchAudio(search ? { search } : undefined);
      setAudioRecords(result.data);
    } catch (err) {
      console.error("[lesson-studio] audio fetch failed:", err);
    } finally {
      setAudioLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!audioPickerOpen) return;
    const timer = setTimeout(() => loadAudioRecords(audioSearch), 250);
    return () => clearTimeout(timer);
  }, [audioSearch, audioPickerOpen, loadAudioRecords]);

  const onSelectAudio = useCallback(
    (record: AudioRecord) => {
      setAudio({
        url: record.url,
        title: record.title,
        transcript: record.generated_text ?? undefined,
        duration: record.duration_seconds ?? undefined,
      });
      setAudioPickerOpen(false);
    },
    [setAudio]
  );

  // ---- Save / Load / Export dialogs --------------------------------------

  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const onSaveSuccess = useCallback(
    (sequenceId: string) => {
      setLessonMeta({ id: sequenceId });
      setSaveOpen(false);
    },
    [setLessonMeta]
  );

  const onLoadSequence = useCallback(
    (loaded: ExplainerSequence, sequenceId: string, title: string, description: string) => {
      const next = sequenceToLesson(loaded);
      next.id = sequenceId;
      next.title = title;
      next.description = description;
      setLesson(next);
      setLoadOpen(false);
    },
    [setLesson]
  );

  // ---- Layout ------------------------------------------------------------

  const audioUrl = lesson.audio?.url ?? "";
  const inPreview = mode === "preview" && sequence !== null;

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <TopBar
        onAudioPickerOpen={() => setAudioPickerOpen(true)}
        onSaveOpen={() => setSaveOpen(true)}
        onLoadOpen={() => setLoadOpen(true)}
        onExportOpen={() => setExportOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <LibraryPanel />
        <div className="relative flex-1 overflow-hidden bg-gray-100">
          {!inPreview && <ToolPalette />}
          {inPreview && sequence ? (
            <div className="flex h-full w-full items-center justify-center p-4">
              <div className="w-full" style={{ maxHeight: "100%" }}>
                <ExplainerPlayer
                  sequence={sequence}
                  audioUrl={audioUrl}
                  autoPlay
                  captions={sequence.captions}
                  onEnded={() => useEditorStore.getState().setMode("edit")}
                />
              </div>
            </div>
          ) : (
            <EditorCanvas />
          )}
        </div>
        <Inspector />
      </div>

      {!inPreview && <AnimationTrack />}
      <Filmstrip />

      {/* New Lesson button when starting from scratch */}
      {lesson.slides.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto rounded-lg border bg-white p-6 shadow-lg">
            <div className="mb-2 text-sm font-medium">Start a new lesson</div>
            <div className="mb-4 text-xs text-muted-foreground">
              Add images from the library, or load an existing lesson.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLoadOpen(true)}
                className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
              >
                Load lesson
              </button>
              <button
                onClick={() => setLesson(emptyLesson())}
                className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
              >
                Blank
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AudioPickerDialog
        open={audioPickerOpen}
        onOpenChange={setAudioPickerOpen}
        audioRecords={audioRecords}
        audioSearch={audioSearch}
        onSearchChange={setAudioSearch}
        audioLoading={audioLoading}
        selectedAudioUrl={audioUrl}
        onSelectAudio={onSelectAudio}
      />
      <SaveToDatabaseDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        sequence={sequence}
        existingSequenceId={lesson.id}
        existingTitle={lesson.title}
        existingDescription={lesson.description}
        onSaveSuccess={onSaveSuccess}
      />
      <LoadFromDatabaseDialog
        open={loadOpen}
        onOpenChange={setLoadOpen}
        onLoadSequence={onLoadSequence}
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        previewSequence={sequence}
        audioUrl={audioUrl}
      />
    </div>
  );
}
