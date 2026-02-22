"use client";

import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Loader2, FolderOpen, Calendar } from "lucide-react";
import type { ExplainerSequence } from "@/shared/types/explainer";
import type { InteractiveSequence } from "@/features/admin/interactive-sequences/types";

interface LoadFromDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadSequence: (
    sequence: ExplainerSequence,
    sequenceId: string,
    title: string,
    description: string
  ) => void;
}

export function LoadFromDatabaseDialog({
  open,
  onOpenChange,
  onLoadSequence,
}: LoadFromDatabaseDialogProps) {
  const [sequences, setSequences] = useState<InteractiveSequence[]>([]);
  const [filteredSequences, setFilteredSequences] = useState<InteractiveSequence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);

  // Fetch sequences when dialog opens
  useEffect(() => {
    if (open) {
      fetchSequences();
    }
  }, [open]);

  // Filter sequences based on search and status
  useEffect(() => {
    let filtered = sequences;

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((seq) => seq.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (seq) =>
          seq.title.toLowerCase().includes(query) || seq.description?.toLowerCase().includes(query)
      );
    }

    setFilteredSequences(filtered);
  }, [sequences, searchQuery, statusFilter]);

  const fetchSequences = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/interactive-sequences/list");
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Failed to fetch sequences");
        return;
      }

      setSequences(data.sequences || []);
      setFilteredSequences(data.sequences || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSequence = () => {
    if (!selectedSequenceId) return;

    const sequence = sequences.find((seq) => seq.id === selectedSequenceId);
    if (!sequence) return;

    // Load the sequence data with metadata
    onLoadSequence(sequence.sequence_data, sequence.id, sequence.title, sequence.description || "");

    // Reset and close
    setSelectedSequenceId(null);
    setSearchQuery("");
    setStatusFilter("all");
    onOpenChange(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "text-green-700 bg-green-50 border-green-200";
      case "draft":
        return "text-yellow-700 bg-yellow-50 border-yellow-200";
      case "archived":
        return "text-gray-700 bg-gray-50 border-gray-200";
      default:
        return "text-gray-700 bg-gray-50 border-gray-200";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Load Sequence from Database</DialogTitle>
          <DialogDescription>
            Select a saved interactive sequence to load into the editor.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 flex-1 min-h-0 flex flex-col">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or description..."
                disabled={isLoading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}>
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sequences List */}
          <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredSequences.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <FolderOpen className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">
                  {sequences.length === 0
                    ? "No saved sequences yet"
                    : "No sequences match your filters"}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredSequences.map((seq) => (
                  <button
                    key={seq.id}
                    onClick={() => setSelectedSequenceId(seq.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      selectedSequenceId === seq.id ? "bg-blue-50 hover:bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm truncate">{seq.title}</h4>
                          <span
                            className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(
                              seq.status
                            )}`}
                          >
                            {seq.status}
                          </span>
                        </div>
                        {seq.description && (
                          <p className="text-xs text-gray-600 line-clamp-2">{seq.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(seq.created_at)}
                          </span>
                          <span>{seq.sequence_data.segments?.length || 0} segments</span>
                          <span>{seq.sequence_data.duration?.toFixed(1) || 0}s</span>
                        </div>
                      </div>
                      {selectedSequenceId === seq.id && (
                        <div className="flex-shrink-0">
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                            <svg
                              className="w-3 h-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-gray-500">
            {filteredSequences.length} {filteredSequences.length === 1 ? "sequence" : "sequences"}{" "}
            {sequences.length !== filteredSequences.length && `(${sequences.length} total)`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleLoadSequence} disabled={!selectedSequenceId}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Load Sequence
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
