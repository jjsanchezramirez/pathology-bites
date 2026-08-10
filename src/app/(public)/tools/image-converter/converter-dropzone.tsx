"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils";
import { ACCEPTED_INPUT } from "./converter-types";

const IMAGE_EXTENSIONS = new Set([
  "tif",
  "tiff",
  "png",
  "jpg",
  "jpeg",
  "jfif",
  "webp",
  "gif",
  "bmp",
  "avif",
  "ico",
]);

/** Scanner exports often carry an empty MIME type, so fall back to extension. */
function looksLikeImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

interface ConverterDropzoneProps {
  onFiles: (files: File[]) => void;
  onRejected: (count: number) => void;
}

export function ConverterDropzone({ onFiles, onRejected }: ConverterDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    (fileList: FileList | null) => {
      const files = Array.from(fileList ?? []);
      const images = files.filter(looksLikeImage);
      if (images.length < files.length) onRejected(files.length - images.length);
      if (images.length > 0) onFiles(images);
    },
    [onFiles, onRejected]
  );

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        // Ignore the leave events fired while crossing child elements.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        accept(event.dataTransfer.files);
      }}
      className={cn(
        "rounded-lg border-2 border-dashed p-8 text-center transition-colors sm:p-12",
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/20"
      )}
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        <div className="rounded-full bg-primary/10 p-3">
          {isDragging ? (
            <Upload className="h-6 w-6 text-primary" />
          ) : (
            <ImagePlus className="h-6 w-6 text-primary" />
          )}
        </div>
        <div>
          <p className="font-medium">Drop images here</p>
          <p className="text-sm text-muted-foreground">
            TIFF, PNG, JPEG, WebP, GIF, BMP, AVIF — as many at once as you like
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_INPUT}
          className="hidden"
          onChange={(event) => {
            accept(event.target.files);
            // Allow re-selecting the same file after removing it from the list.
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
