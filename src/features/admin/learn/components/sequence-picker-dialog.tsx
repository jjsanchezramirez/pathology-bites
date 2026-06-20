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
          <div className="relative bg-background border rounded-lg shadow-lg w-[700px] max-w-[95vw] h-[60vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b flex-shrink-0">
              <h2 className="text-xl font-semibold">Select Explainer Sequence</h2>
            </div>

            <div className="p-6 space-y-4 flex flex-col flex-1 overflow-hidden">
              <div className="relative flex-shrink-0">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search sequences..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>

              <div className="space-y-2 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : sequences.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Play className="h-12 w-12 mb-2 opacity-50" />
                    <p>No sequences found</p>
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
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{seq.title}</span>
                        <Badge variant={seq.status === "published" ? "default" : "outline"}>
                          {seq.status}
                        </Badge>
                      </div>
                      {seq.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {seq.description}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
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
