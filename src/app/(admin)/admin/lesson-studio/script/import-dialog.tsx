// Import a whole lesson from a script: paste or upload JSON, or plain text
// with one sentence per line.

"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { importScript } from "@/shared/lesson/script/import";
import type { ScriptLesson } from "@/shared/lesson/script/types";

const EXAMPLE = `# title: Barrett esophagus
Barrett esophagus, from diagnosis to dysplasia grade. | Diagnosis and dysplasia grading

# ladder: The dysplasia ladder
Then grade it on a ladder.
Negative: the surface matures. | Negative | Surface maturation
High grade: marked atypia reaching the surface. | High grade | Atypia to the surface

# takehome: Take-home
Look at the surface first. | Check surface maturation first`;

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (lesson: ScriptLesson) => void;
}

export function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const [source, setSource] = useState("");
  const [showFormat, setShowFormat] = useState(false);
  const result = useMemo(() => (source.trim() ? importScript(source) : null), [source]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setSource(await file.text());
  }

  const lesson = result?.lesson;
  const sentences = lesson?.scenes.reduce((n, s) => n + s.beats.length, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import a script</DialogTitle>
          <DialogDescription>
            Paste lesson JSON, or plain text where each line is one sentence.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder={EXAMPLE}
          className="min-h-[16rem] font-mono text-xs leading-relaxed"
          spellCheck={false}
        />

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-primary hover:underline">
            <Upload className="h-3.5 w-3.5" />
            Upload a file
            <input
              type="file"
              accept=".json,.txt,.md,application/json,text/plain"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setShowFormat((v) => !v)}
          >
            {showFormat ? "Hide the format" : "How to write it"}
          </button>
        </div>

        {showFormat && (
          <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
            <p>
              A line starting with <code>#</code> starts a scene: <code># ladder: Heading</code>.
              Templates are title, image, compare, ladder and takehome.
            </p>
            <p>
              Every other line is one sentence of narration. Add on-screen words after a bar:{" "}
              <code>Sentence | On screen | Smaller line</code>.
            </p>
            <p>
              JSON uses the same idea:{" "}
              <code>{`{ "title": "…", "scenes": [ { "template": "ladder", "heading": "…", "beats": [ "Sentence", { "say": "…", "text": "…" } ] } ] }`}</code>
              . Export JSON from the studio for a full example.
            </p>
          </div>
        )}

        {result?.error && <p className="text-sm text-destructive">{result.error}</p>}
        {lesson && (
          <div className="space-y-1 text-sm">
            <p>
              {lesson.scenes.length} scene{lesson.scenes.length === 1 ? "" : "s"}, {sentences}{" "}
              sentence{sentences === 1 ? "" : "s"}.
            </p>
            {result!.warnings.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                {result!.warnings.slice(0, 6).map((w) => (
                  <li key={w}>{w}</li>
                ))}
                {result!.warnings.length > 6 && <li>And {result!.warnings.length - 6} more.</li>}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!lesson}
            onClick={() => {
              if (!lesson) return;
              onImport(lesson);
              setSource("");
              onOpenChange(false);
            }}
          >
            Open in the studio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
