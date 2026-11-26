"use client";

// Where to put a saved lesson: a markdown line for Learning Modules and question
// explanations, an iframe for other sites, and the direct player link. Embeds
// only play once the lesson is published, so the dialog checks that first.

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  lessonApiPath,
  lessonEmbedPath,
  lessonIframeSnippet,
  lessonMarkdownSnippet,
} from "@/shared/lesson/embed";

interface EmbedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string | null;
  title: string;
  /** Unsaved edits don't reach embeds until the lesson is saved. */
  isDirty: boolean;
}

type Published = "checking" | "yes" | "no" | "unknown";

function CopyField({ label, hint, value }: { label: string; hint: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <Textarea
        readOnly
        value={value}
        rows={value.length > 90 ? 3 : 1}
        className="font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function EmbedDialog({ open, onOpenChange, lessonId, title, isDirty }: EmbedDialogProps) {
  const [published, setPublished] = useState<Published>("checking");

  useEffect(() => {
    if (!open || !lessonId) return;
    const ctrl = new AbortController();
    setPublished("checking");
    // The public API serves published lessons only; no-store skips the CDN copy.
    fetch(lessonApiPath(lessonId), { cache: "no-store", signal: ctrl.signal })
      .then((r) => setPublished(r.ok ? "yes" : r.status === 404 ? "no" : "unknown"))
      .catch(() => !ctrl.signal.aborted && setPublished("unknown"));
    return () => ctrl.abort();
  }, [open, lessonId]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Embed this lesson</DialogTitle>
          <DialogDescription>
            Put the lesson in a Learning Module, a question explanation, or on another website.
          </DialogDescription>
        </DialogHeader>

        {!lessonId ? (
          <p className="text-sm text-muted-foreground">Save the lesson first.</p>
        ) : (
          <div className="grid gap-4">
            {published === "checking" && (
              <p className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking whether it&apos;s
                published…
              </p>
            )}
            {published === "no" && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
                This lesson is a draft, so embeds show &ldquo;not available&rdquo;. Save it with
                status Published to make them play.
              </p>
            )}
            {published === "unknown" && (
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t check whether the lesson is published.
              </p>
            )}
            {isDirty && (
              <p className="text-sm text-muted-foreground">
                You have unsaved changes; embeds show the last saved version.
              </p>
            )}

            <CopyField
              label="In Pathology Bites"
              hint="Paste on its own line in a Learning Module or a question's teaching point or stem."
              value={lessonMarkdownSnippet(lessonId)}
            />
            <CopyField
              label="On another website"
              hint="Responsive 16:9 player. Works signed out."
              value={lessonIframeSnippet(lessonId, origin, title || undefined)}
            />
            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <a href={lessonEmbedPath(lessonId)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open player
                </a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
