// Top action bar. Three zones:
//   Left — File menu (New, Load, Save, Save as new, Export, Audio)
//   Center — Title input · status chip · duration · undo/redo
//   Right — Save status pill · Preview toggle

"use client";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/shared/components/ui/dropdown-menu";
import {
  Play,
  Pause,
  Save,
  FolderOpen,
  Download,
  Undo2,
  Redo2,
  FilePlus2,
  Music,
  Music2,
  ChevronDown,
  Wand2,
} from "lucide-react";
import { useEditorStore, selectCanUndo, selectCanRedo } from "./model/store";

interface TopBarProps {
  /** Open audio picker dialog. */
  onAudioPickerOpen: () => void;
  /** Open the save dialog (uses current lesson.id to decide create vs update). */
  onSaveOpen: () => void;
  /** Open the load dialog. Caller is responsible for dirty-check confirm. */
  onLoadOpen: () => void;
  /** Open export dialog. */
  onExportOpen: () => void;
  /** Reset the document to a blank lesson. Caller handles dirty-check confirm. */
  onNewLesson: () => void;
  /** Clear lesson.id so the next Save creates a new row, then open Save dialog. */
  onSaveAsNew: () => void;
  /** Remove the currently set audio track. */
  onClearAudio: () => void;
  /** Open AI generation dialog. */
  onGenerate: () => void;
  /** Total duration in seconds, used for the display chip. */
  totalDuration: number;
}

function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TopBar({
  onAudioPickerOpen,
  onSaveOpen,
  onLoadOpen,
  onExportOpen,
  onNewLesson,
  onSaveAsNew,
  onClearAudio,
  onGenerate,
  totalDuration,
}: TopBarProps) {
  const title = useEditorStore((s) => s.lesson.title);
  const lessonId = useEditorStore((s) => s.lesson.id);
  const audio = useEditorStore((s) => s.lesson.audio);
  const mode = useEditorStore((s) => s.mode);
  const slideCount = useEditorStore((s) => s.lesson.slides.length);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const isDirty = useEditorStore((s) => s.isDirty);

  const setLessonMeta = useEditorStore((s) => s.setLessonMeta);
  const setMode = useEditorStore((s) => s.setMode);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const hasAudio = !!(audio?.url || audio?.title);
  const isSaved = !!lessonId;
  const noSlides = slideCount === 0;

  return (
    <div className="flex items-center gap-2 border-b bg-white px-3 py-2">
      {/* --- Left: File menu ------------------------------------------- */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            File
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuItem onSelect={onNewLesson}>
            <FilePlus2 className="mr-2 h-4 w-4" />
            New lesson
            <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onLoadOpen}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Load from library…
            <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSaveOpen} disabled={noSlides}>
            <Save className="mr-2 h-4 w-4" />
            Save
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onSaveAsNew} disabled={noSlides || !isSaved}>
            <Save className="mr-2 h-4 w-4" />
            Save as new…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onExportOpen} disabled={noSlides}>
            <Download className="mr-2 h-4 w-4" />
            Export video…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onAudioPickerOpen}>
            <Music2 className="mr-2 h-4 w-4" />
            {hasAudio ? `Audio: ${audio?.title ?? "set"}` : "Choose audio…"}
            <DropdownMenuShortcut>⌘⇧A</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onClearAudio} disabled={!hasAudio}>
            <Music className="mr-2 h-4 w-4 opacity-60" />
            Remove audio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-1 h-6 w-px bg-gray-200" />

      {/* --- Center: Title · status · duration · undo/redo -------------- */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setLessonMeta({ title: e.target.value })}
          placeholder="Untitled lesson"
          className="h-8 min-w-0 flex-1 rounded border border-transparent px-2 text-sm font-medium hover:border-gray-200 focus:border-blue-500 focus:outline-none"
        />

        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            isSaved ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
          }`}
          title={isSaved ? "Editing a saved lesson" : "This lesson has not been saved yet"}
        >
          {isSaved ? "Editing saved" : "New lesson"}
        </span>

        <div className="flex-shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {formatDuration(totalDuration)} · {slideCount} slide{slideCount === 1 ? "" : "s"}
          {hasAudio && (
            <span className="ml-1 inline-flex items-center gap-0.5">
              · <Music2 className="h-3 w-3" />
            </span>
          )}
        </div>

        <div className="mx-1 h-6 w-px bg-gray-200" />

        <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo} title="Undo (⌘Z)">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)">
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {/* --- Right: Generate · Save status · Preview --------------------- */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerate}
          disabled={!hasAudio || noSlides}
          title="Generate lesson with AI"
        >
          <Wand2 className="mr-1 h-3 w-3" />
          Generate
        </Button>
        <button
          type="button"
          onClick={onSaveOpen}
          disabled={noSlides}
          title={isDirty ? "Unsaved changes — click to save (⌘S)" : "All changes saved"}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            isDirty
              ? "bg-amber-50 text-amber-800 hover:bg-amber-100 ring-1 ring-amber-200"
              : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 ring-1 ring-emerald-200"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isDirty ? "bg-amber-500" : "bg-emerald-500"}`}
          />
          {isDirty ? "Unsaved" : "Saved"}
        </button>
        <Button
          variant={mode === "preview" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode(mode === "preview" ? "edit" : "preview")}
          disabled={noSlides}
        >
          {mode === "preview" ? (
            <>
              <Pause className="mr-1 h-3 w-3" /> Stop
            </>
          ) : (
            <>
              <Play className="mr-1 h-3 w-3" /> Preview
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
