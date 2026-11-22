"use client";

import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Dialog, DialogPortal } from "@/shared/components/ui/dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Search, Play, Loader2 } from "lucide-react";
import { fetchInteractiveSequences } from "@/features/admin/interactive-sequences/services/interactive-sequences";
import type { InteractiveSequence } from "@/features/admin/interactive-sequences/types";
import { log } from "@/shared/utils/logging";

interface SequencePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (sequenceId: string) => void;
}

export function SequencePickerDialog({ open, onOpenChange, onSelect }: SequencePickerDialogProps) {
  const [sequences, setSequences] = useState<InteractiveSequence[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchInteractiveSequences(search ? { search } : undefined);
        setSequences(data);
      } catch (err) {
        log.error("Failed to load sequences:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    setSelectedId(null);
  }, [open, search]);

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId);
      onOpenChange(false);
      setSelectedId(null);
      setSearch("");
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSelectedId(null);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancel} />
          <div className="relative flex h-[60vh] w-[700px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border bg-background shadow-lg">
            <div className="shrink-0 border-b p-4 sm:p-6">
              <h2 className="text-lg font-semibold">Select Explainer Sequence</h2>
            </div>

            <div className="flex flex-1 flex-col space-y-4 overflow-hidden p-4 sm:p-6">
              <div className="relative shrink-0">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search sequences..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto" style={{ minHeight: 0 }}>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : sequences.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                    <Play className="mb-2 h-10 w-10 opacity-50" />
                    <p className="text-sm font-medium">No sequences found</p>
                  </div>
                ) : (
                  sequences.map((seq) => (
                    <button
                      key={seq.id}
                      onClick={() => setSelectedId(seq.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        selectedId === seq.id
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium">{seq.title}</span>
                        <Badge
                          className="shrink-0"
                          variant={seq.status === "published" ? "default" : "outline"}
                        >
                          {seq.status}
                        </Badge>
                      </div>
                      {seq.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {seq.description}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>

              <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm} disabled={!selectedId}>
                  Insert Explainer
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
