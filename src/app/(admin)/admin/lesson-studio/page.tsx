// Lesson Studio: the canvas editor (timed elements, camera moves, waypoints),
// with scene templates whose elements time themselves from the narration.
// Scripts (JSON or plain text) import as template scenes; rows saved by the
// retired script studio open here converted to canvas and save back in place.
//
// Layout: top bar · library | canvas | inspector · animation track · filmstrip.
// Preview mode swaps the canvas for ExplainerPlayer playing the current Lesson.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExplainerPlayer } from "@/shared/components/explainer/explainer-player";
import { fetchAudio, fetchAudioById } from "@/features/admin/audio/services/audio";
import type { Audio as AudioRecord } from "@/features/admin/audio/types";
import { slideStarts } from "@/shared/lesson/evaluate";
import { normalizeStoredSequence } from "@/shared/lesson/normalize";
import type { ScriptLesson } from "@/shared/lesson/script/types";
import { lessonFromScript } from "@/shared/lesson/templates";

import { useEditorStore } from "./model/store";
import { newBlankLesson } from "./model/slide-factory";

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
import { GenerateLessonDialog } from "./components/generate-lesson-dialog";
import { NarrationDialog } from "./components/narration-dialog";
import { EmbedDialog } from "./components/embed-dialog";
import { ImportDialog } from "./components/import-dialog";
import { log } from "@/shared/utils/logging";

export default function LessonStudioPage() {
  const lesson = useEditorStore((s) => s.lesson);
  const mode = useEditorStore((s) => s.mode);
  const setLesson = useEditorStore((s) => s.setLesson);
  const setAudio = useEditorStore((s) => s.setAudio);
  const setLessonMeta = useEditorStore((s) => s.setLessonMeta);

  // ---- Warn about unsaved changes ----------------------------------------

  const isDirty = useEditorStore((s) => s.isDirty);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ---- Audio picker ------------------------------------------------------

  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [audioRecords, setAudioRecords] = useState<AudioRecord[]>([]);
  const [audioSearch, setAudioSearch] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  // Monotonic request id — lets us ignore stale responses when the user
  // types quickly and an older fetch resolves after a newer one.
  const audioReqIdRef = useRef(0);

  const loadAudioRecords = useCallback(async (search?: string) => {
    const reqId = ++audioReqIdRef.current;
    setAudioLoading(true);
    try {
      const result = await fetchAudio({
        search: search || undefined,
        pageSize: 25,
        withCount: false,
        // Narrow projection: skip `generated_text` (full transcripts can be
        // huge) and other columns the picker doesn't render. The transcript
        // is re-fetched lazily on selection in `onSelectAudio`.
        columns: "id,title,description,url,duration_seconds",
      });
      if (reqId !== audioReqIdRef.current) return; // stale
      setAudioRecords(result.data);
    } catch (err) {
      if (reqId !== audioReqIdRef.current) return;
      log.error("[lesson-studio] audio fetch failed:", err);
    } finally {
      if (reqId === audioReqIdRef.current) setAudioLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!audioPickerOpen) return;
    const timer = setTimeout(() => loadAudioRecords(audioSearch), 150);
    return () => clearTimeout(timer);
  }, [audioSearch, audioPickerOpen, loadAudioRecords]);

  const onSelectAudio = useCallback(
    async (record: AudioRecord) => {
      // Commit the basic metadata immediately so the UI responds instantly.
      // The transcript is excluded from the list query for payload reasons,
      // so re-fetch the full row here to pick it up.
      setAudio({
        url: record.url,
        title: record.title,
        transcript: undefined,
        duration: record.duration_seconds ?? undefined,
      });
      setAudioPickerOpen(false);
      try {
        const full = await fetchAudioById(record.id);
        if (full?.generated_text) {
          setAudio({
            url: record.url,
            title: record.title,
            transcript: full.generated_text,
            duration: record.duration_seconds ?? undefined,
            wordTimings: full.word_timings ?? undefined,
          });
        }
      } catch (err) {
        log.error("[lesson-studio] transcript fetch failed:", err);
      }
    },
    [setAudio]
  );

  // ---- Save / Load dialogs --------------------------------------

  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [narrateOpen, setNarrateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);

  const markClean = useEditorStore((s) => s.markClean);

  const confirmDiscardIfDirty = useCallback((): boolean => {
    if (!useEditorStore.getState().isDirty) return true;
    return window.confirm("You have unsaved changes. Discard them and continue?");
  }, []);

  const onSaveOpen = useCallback(() => {
    if (useEditorStore.getState().lesson.slides.length === 0) return;
    setSaveOpen(true);
  }, []);

  const onLoadOpenGuarded = useCallback(() => {
    if (!confirmDiscardIfDirty()) return;
    setLoadOpen(true);
  }, [confirmDiscardIfDirty]);

  const onNewLesson = useCallback(() => {
    if (!confirmDiscardIfDirty()) return;
    setLesson(newBlankLesson());
  }, [confirmDiscardIfDirty, setLesson]);

  // A script (JSON or text) becomes template scenes: editable elements that
  // time themselves from the narration.
  const onImportScriptOpen = useCallback(() => {
    if (!confirmDiscardIfDirty()) return;
    setImportOpen(true);
  }, [confirmDiscardIfDirty]);

  const onImportScript = useCallback(
    (script: ScriptLesson) => {
      setLesson(lessonFromScript(script));
      setImportOpen(false);
    },
    [setLesson]
  );

  const onSaveAsNew = useCallback(() => {
    if (useEditorStore.getState().lesson.slides.length === 0) return;
    // Clear the id so SaveToDatabaseDialog treats this as a create.
    setLessonMeta({ id: null });
    setSaveOpen(true);
  }, [setLessonMeta]);

  const onClearAudio = useCallback(() => {
    setAudio(null);
  }, [setAudio]);

  const onGenerate = useCallback(() => {
    setGenerateOpen(true);
  }, []);

  useKeyboardShortcuts({
    onSave: onSaveOpen,
    onNew: onNewLesson,
    onOpen: onLoadOpenGuarded,
    onChooseAudio: () => setAudioPickerOpen(true),
  });

  const onSaveSuccess = useCallback(
    (sequenceId: string) => {
      setLessonMeta({ id: sequenceId });
      markClean();
      setSaveOpen(false);
    },
    [setLessonMeta, markClean]
  );

  const onLoadSequence = useCallback(
    (loaded: unknown, sequenceId: string, title: string, description: string) => {
      // Script-studio rows come back converted to canvas; saving writes the
      // canvas version over the same row.
      const next = normalizeStoredSequence(loaded);
      if (!next) {
        window.alert("This sequence can't be opened (legacy format). Please re-create it.");
        return;
      }
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
  const totalDuration = slideStarts(lesson).duration;
  const inPreview = mode === "preview" && lesson.slides.length > 0;

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <TopBar
        onAudioPickerOpen={() => setAudioPickerOpen(true)}
        onSaveOpen={onSaveOpen}
        onLoadOpen={onLoadOpenGuarded}
        onNewLesson={onNewLesson}
        onSaveAsNew={onSaveAsNew}
        onClearAudio={onClearAudio}
        onGenerate={onGenerate}
        onNarrateOpen={() => setNarrateOpen(true)}
        onEmbedOpen={() => setEmbedOpen(true)}
        onImportScript={onImportScriptOpen}
        totalDuration={totalDuration}
      />

      <div className="flex flex-1 overflow-hidden">
        <LibraryPanel />
        <div className="relative flex-1 overflow-hidden bg-gray-100">
          {!inPreview && <ToolPalette />}
          {inPreview ? (
            <div className="flex h-full w-full items-center justify-center p-4">
              <div className="w-full" style={{ maxHeight: "100%" }}>
                <ExplainerPlayer
                  lesson={lesson}
                  audioUrl={audioUrl}
                  autoPlay
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
        onRemoveAudio={onClearAudio}
      />
      <SaveToDatabaseDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        lesson={lesson}
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
      <GenerateLessonDialog open={generateOpen} onOpenChange={setGenerateOpen} />
      <NarrationDialog open={narrateOpen} onOpenChange={setNarrateOpen} />
      <EmbedDialog
        open={embedOpen}
        onOpenChange={setEmbedOpen}
        lessonId={lesson.id}
        title={lesson.title}
        isDirty={isDirty}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={onImportScript} />
    </div>
  );
}
