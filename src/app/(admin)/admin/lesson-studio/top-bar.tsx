// Top action bar: lesson title, audio picker, preview toggle, save/load/export.

"use client";

import { Button } from "@/shared/components/ui/button";
import { Music, Play, Pause, Save, FolderOpen, Download, Undo2, Redo2 } from "lucide-react";
import { useEditorStore, selectCanUndo, selectCanRedo } from "./model/store";

interface TopBarProps {
  onAudioPickerOpen: () => void;
  onSaveOpen: () => void;
  onLoadOpen: () => void;
  onExportOpen: () => void;
}

export function TopBar({ onAudioPickerOpen, onSaveOpen, onLoadOpen, onExportOpen }: TopBarProps) {
  const title = useEditorStore((s) => s.lesson.title);
  const audio = useEditorStore((s) => s.lesson.audio);
  const mode = useEditorStore((s) => s.mode);
  const slideCount = useEditorStore((s) => s.lesson.slides.length);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);

  const setLessonMeta = useEditorStore((s) => s.setLessonMeta);
  const setMode = useEditorStore((s) => s.setMode);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  return (
    <div className="flex items-center gap-2 border-b bg-white px-3 py-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setLessonMeta({ title: e.target.value })}
        placeholder="Untitled lesson"
        className="h-8 min-w-[200px] max-w-[320px] flex-shrink rounded border border-transparent px-2 text-sm hover:border-gray-200 focus:border-blue-500 focus:outline-none"
      />

      <div className="text-xs text-muted-foreground">
        {slideCount} slide{slideCount === 1 ? "" : "s"}
      </div>

      <div className="mx-2 h-6 w-px bg-gray-200" />

      <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo} title="Undo (⌘Z)">
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)">
        <Redo2 className="h-4 w-4" />
      </Button>

      <div className="mx-2 h-6 w-px bg-gray-200" />

      <Button variant="outline" size="sm" onClick={onAudioPickerOpen}>
        <Music className="mr-1 h-3 w-3" />
        {(audio?.title ?? audio?.url) ? "Audio set" : "No audio"}
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant={mode === "preview" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode(mode === "preview" ? "edit" : "preview")}
          disabled={slideCount === 0}
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
        <Button variant="outline" size="sm" onClick={onLoadOpen}>
          <FolderOpen className="mr-1 h-3 w-3" /> Load
        </Button>
        <Button variant="outline" size="sm" onClick={onSaveOpen} disabled={slideCount === 0}>
          <Save className="mr-1 h-3 w-3" /> Save
        </Button>
        <Button variant="outline" size="sm" onClick={onExportOpen} disabled={slideCount === 0}>
          <Download className="mr-1 h-3 w-3" /> Export
        </Button>
      </div>
    </div>
  );
}
