// Pick a picture from the image library (or paste an address) for a scene.

"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import type { SceneImage } from "@/shared/lesson/script/types";
import { log } from "@/shared/utils/logging";

interface LibraryImage {
  id: string;
  url: string;
  alt_text?: string | null;
  description?: string | null;
  width?: number | null;
  height?: number | null;
}

interface ImagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (image: SceneImage) => void;
}

export function ImagePickerDialog({ open, onOpenChange, onPick }: ImagePickerDialogProps) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ limit: "48" });
    if (debounced) params.set("search", debounced);
    fetch(`/api/admin/library/images?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setItems(data.images ?? []);
      })
      .catch((err) => log.error("[script-studio] image search failed:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  function pick(img: LibraryImage) {
    onPick({
      url: img.url,
      id: img.id,
      alt: img.alt_text || img.description || undefined,
      width: img.width || undefined,
      height: img.height || undefined,
    });
    onOpenChange(false);
  }

  function pickUrl() {
    const u = url.trim();
    if (!/^https?:\/\//.test(u)) return;
    onPick({ url: u });
    setUrl("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a picture</DialogTitle>
          <DialogDescription>From the image library, or paste an image address.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search the library"
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="max-h-[50vh] min-h-[12rem] overflow-y-auto">
          {loading && !items.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading pictures…</p>
          ) : !items.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No pictures match.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => pick(img)}
                  className="group overflow-hidden rounded-md border text-left transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt_text ?? ""}
                    className="aspect-[4/3] w-full bg-muted object-cover"
                    loading="lazy"
                  />
                  <span className="block truncate px-2 py-1 text-xs text-muted-foreground">
                    {img.description || img.alt_text || "Untitled"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… image address"
            onKeyDown={(e) => e.key === "Enter" && pickUrl()}
          />
          <Button variant="outline" onClick={pickUrl} disabled={!/^https?:\/\//.test(url.trim())}>
            Use address
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
