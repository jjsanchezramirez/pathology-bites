"use client";

import { AlertCircle, CheckCircle2, Clock, Download, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { formatBytes, formatSpec, type ConvertOptions } from "./converter-types";
import { saveBlob } from "./converter-download";
import type { ConverterItem } from "./use-image-converter";

function StatusIcon({ status }: { status: ConverterItem["status"] }) {
  switch (status) {
    case "converting":
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />;
    case "done":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />;
    case "error":
      return <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />;
    case "stale":
      return <RefreshCw className="h-4 w-4 shrink-0 text-amber-600" />;
    default:
      return <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
}

function ItemRow({
  item,
  options,
  onRemove,
}: {
  item: ConverterItem;
  options: ConvertOptions;
  onRemove: (id: string) => void;
}) {
  const outputBytes = item.outputs.reduce((sum, page) => sum + page.blob.size, 0);
  const first = item.outputs[0];

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="pt-0.5">
        <StatusIcon status={item.status} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={item.file.name}>
          {item.file.name}
        </p>

        {item.status === "error" ? (
          <p className="mt-0.5 text-xs text-destructive">{item.error}</p>
        ) : item.status === "done" && first ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatBytes(item.file.size)} → {formatBytes(outputBytes)} ·{" "}
            {`${first.width}×${first.height}`} · {formatSpec(options.format).label}
            {item.outputs.length > 1 ? ` · ${item.outputs.length} pages` : ""}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatBytes(item.file.size)}
            {item.status === "converting" && " · converting…"}
            {item.status === "stale" && " · settings changed, re-run to update"}
            {item.status === "queued" && " · queued"}
          </p>
        )}

        {item.outputs.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.outputs.map((page) => (
              <Button
                key={page.name}
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => saveBlob(page.blob, page.name)}
              >
                <Download className="mr-1 h-3 w-3" />
                {page.name}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {item.outputs.length === 1 && first && (
          <Button variant="outline" size="sm" onClick={() => saveBlob(first.blob, first.name)}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.file.name}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

interface ConverterFileListProps {
  items: ConverterItem[];
  options: ConvertOptions;
  onRemove: (id: string) => void;
}

export function ConverterFileList({ items, options, onRemove }: ConverterFileListProps) {
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {items.map((item) => (
        <ItemRow key={item.id} item={item} options={options} onRemove={onRemove} />
      ))}
    </ul>
  );
}
