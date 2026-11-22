// Lesson Studio: script first. A lesson is a list of scenes; each scene uses
// one of five templates, and each sentence of narration is one beat on screen.
// Timing comes from the narration, motion is fixed, and whole lessons can be
// imported from a script. The free-form canvas editor lives at ./classic.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  FilePlus2,
  FolderOpen,
  Mic,
  Plus,
  Redo2,
  Save,
  Undo2,
  Upload,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { exportScriptJson, lintScriptLesson } from "@/shared/lesson/script/import";
import {
  applyScriptNarration,
  clearScriptNarration,
  computeTimeline,
  isNarrationStale,
  narrationSlides,
} from "@/shared/lesson/script/timeline";
import {
  TEMPLATES,
  TEMPLATE_ORDER,
  emptyScriptLesson,
  isScriptLesson,
  newId,
  type ImageRegion,
  type SceneImage,
  type ScriptLesson,
} from "@/shared/lesson/script/types";

import { SaveToDatabaseDialog } from "../components/save-to-database-dialog";
import { ExportDialog } from "../components/export-dialog";
import { LoadFromDatabaseDialog } from "../components/load-from-database-dialog";
import { NarrationDialogBase } from "../components/narration-dialog";
import { ImagePickerDialog } from "./image-picker-dialog";
import { ImportDialog } from "./import-dialog";
import { RegionDialog } from "./region-dialog";
import { SceneCard } from "./scene-card";
import { ScriptPreview, formatTime } from "./preview";
import { selectIsDirty, useScriptStudio } from "./store";

const DRAFT_KEY = "script-studio:draft";

/** Give every scene and sentence an id, whatever the stored lesson held. */
function withIds(lesson: ScriptLesson): ScriptLesson {
  return {
    ...lesson,
    scenes: lesson.scenes.map((s) => ({
      ...s,
      id: s.id || newId("scene"),
      beats: (s.beats?.length ? s.beats : [{ id: "", say: "" }]).map((b) => ({
        ...b,
        id: b.id || newId("beat"),
        say: b.say ?? "",
      })),
    })),
  };
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "lesson"
  );
}

export default function ScriptStudioPage() {
  const lesson = useScriptStudio((s) => s.lesson);
  const isDirty = useScriptStudio(selectIsDirty);
  const canUndo = useScriptStudio((s) => s.past.length > 0);
  const canRedo = useScriptStudio((s) => s.future.length > 0);
  const { setLesson, setMeta, addScene, updateScene, updateBeat, undo, redo, markClean, change } =
    useScriptStudio.getState();

  const timeline = useMemo(() => computeTimeline(lesson), [lesson]);
  const warnings = useMemo(() => lintScriptLesson(lesson), [lesson]);
  const narration = !lesson.audio?.url ? "none" : isNarrationStale(lesson) ? "stale" : "current";

  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [narrateOpen, setNarrateOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [imageTarget, setImageTarget] = useState<{ sceneId: string; beatId?: string } | null>(null);
  const [regionTarget, setRegionTarget] = useState<{ sceneId: string; beatId: string } | null>(
    null
  );

  // ---- Draft kept in this browser, so a refresh doesn't lose work ---------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (isScriptLesson(parsed)) setLesson(withIds(parsed), { clean: false });
    } catch {
      /* no draft, or storage unavailable */
    }
  }, [setLesson]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (isDirty) localStorage.setItem(DRAFT_KEY, JSON.stringify(lesson));
        else localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* storage full or unavailable */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [lesson, isDirty]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ---- Undo / redo outside text fields (fields keep their own undo) -------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const confirmDiscard = useCallback(
    () => !isDirty || window.confirm("Discard the changes you haven't saved?"),
    [isDirty]
  );

  const onNew = () => confirmDiscard() && setLesson(emptyScriptLesson());

  const onLoadSequence = useCallback(
    (data: unknown, sequenceId: string, title: string, description: string) => {
      if (!isScriptLesson(data)) {
        window.alert(
          "This lesson was built on the canvas. Open it in the classic editor (link at the top right)."
        );
        return;
      }
      setLesson(
        withIds({
          ...data,
          id: sequenceId,
          title: data.title || title,
          description: data.description || description,
        })
      );
      setLoadOpen(false);
    },
    [setLesson]
  );

  const onSaveSuccess = useCallback(
    (sequenceId: string) => {
      setMeta({ id: sequenceId });
      markClean();
      setSaveOpen(false);
    },
    [setMeta, markClean]
  );

  const onPickImage = useCallback((target: { sceneId: string; beatId?: string }) => {
    setImageTarget(target);
  }, []);
  const onMarkRegion = useCallback((sceneId: string, beatId: string) => {
    setRegionTarget({ sceneId, beatId });
  }, []);

  const applyImage = (image: SceneImage) => {
    if (!imageTarget) return;
    if (imageTarget.beatId) updateBeat(imageTarget.sceneId, imageTarget.beatId, { image });
    else updateScene(imageTarget.sceneId, { image });
  };

  const applyRegion = (region: ImageRegion | undefined) => {
    if (!regionTarget) return;
    updateBeat(regionTarget.sceneId, regionTarget.beatId, {
      region,
      ...(region ? {} : { mark: undefined }),
    });
  };

  const regionScene = lesson.scenes.find((s) => s.id === regionTarget?.sceneId) ?? null;
  const lastScene = lesson.scenes[lesson.scenes.length - 1];

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <Input
          value={lesson.title}
          onChange={(e) => setMeta({ title: e.target.value })}
          placeholder="Untitled lesson"
          className="h-9 w-[16rem] border-transparent text-base font-semibold shadow-none hover:border-input focus-visible:border-input"
          aria-label="Lesson title"
        />
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatTime(timeline.duration)}
        </span>
        <NarrationChip state={narration} />
        {isDirty && <span className="text-xs text-muted-foreground">Unsaved</span>}

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo"
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo"
          >
            <Redo2 />
          </Button>
          <Button variant="ghost" size="sm" onClick={onNew}>
            <FilePlus2 />
            New
          </Button>
          <Button variant="ghost" size="sm" onClick={() => confirmDiscard() && setLoadOpen(true)}>
            <FolderOpen />
            Open
          </Button>
          <Button variant="ghost" size="sm" onClick={() => confirmDiscard() && setImportOpen(true)}>
            <Upload />
            Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Download />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => download(`${slug(lesson.title)}.json`, exportScriptJson(lesson))}
              >
                Script (JSON)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setVideoOpen(true)}>Video (MP4)…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Mic />
                Narrate
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setNarrateOpen(true)}>
                {narration === "none" ? "Record narration…" : "Record again…"}
              </DropdownMenuItem>
              {narration !== "none" && (
                <DropdownMenuItem onSelect={() => change((l) => clearScriptNarration(l))}>
                  Remove narration
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => setSaveOpen(true)}>
            <Save />
            Save
          </Button>
          <Link
            href="/admin/lesson-studio"
            className="ml-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Canvas editor
          </Link>
        </div>
      </header>

      {/* Script | preview */}
      <div className="mx-auto grid w-full max-w-[1500px] flex-1 gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:p-6">
        <main className="space-y-3">
          {lesson.scenes.map((scene, i) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              index={i}
              count={lesson.scenes.length}
              seconds={timeline.scenes[i]?.duration ?? 0}
              onPickImage={onPickImage}
              onMarkRegion={onMarkRegion}
            />
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="mr-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
              Add a scene
            </span>
            {TEMPLATE_ORDER.map((t) => (
              <Button
                key={t}
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => addScene(t, lastScene?.id)}
              >
                {TEMPLATES[t].label}
              </Button>
            ))}
          </div>
        </main>

        <aside className="lg:sticky lg:top-[4.25rem] lg:self-start">
          <ScriptPreview />
          {warnings.length > 0 && (
            <div className="mt-4 rounded-md border bg-background p-3">
              <p className="text-sm font-medium">
                {warnings.length} thing{warnings.length === 1 ? "" : "s"} to check
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                {warnings.slice(0, 8).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {narration === "stale" && (
            <p className="mt-3 text-sm text-muted-foreground">
              The script changed after the narration was recorded. New sentences use estimated
              timing until you record again.
            </p>
          )}
        </aside>
      </div>

      <ExportDialog
        open={videoOpen}
        onOpenChange={setVideoOpen}
        previewLesson={lesson}
        audioUrl=""
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
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(l) => setLesson(l, { clean: false })}
      />
      <ImagePickerDialog
        open={!!imageTarget}
        onOpenChange={(o) => !o && setImageTarget(null)}
        onPick={applyImage}
      />
      <RegionDialog
        open={!!regionTarget}
        onOpenChange={(o) => !o && setRegionTarget(null)}
        scene={regionScene}
        beatId={regionTarget?.beatId ?? null}
        onSave={applyRegion}
      />
      <NarrationDialogBase
        open={narrateOpen}
        onOpenChange={setNarrateOpen}
        title={lesson.title || "Untitled lesson"}
        previousVoice={lesson.audio?.voice}
        slides={narrateOpen ? narrationSlides(lesson) : []}
        unit="scenes"
        onNarrated={(audio, cues) => change((l) => applyScriptNarration(l, cues, audio))}
      />
    </div>
  );
}

function NarrationChip({ state }: { state: "none" | "current" | "stale" }) {
  const text =
    state === "none"
      ? "No narration yet"
      : state === "current"
        ? "Narrated"
        : "Narration out of date";
  const tone =
    state === "current"
      ? "bg-primary/10 text-primary"
      : state === "stale"
        ? "bg-amber-100 text-amber-900"
        : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{text}</span>;
}
