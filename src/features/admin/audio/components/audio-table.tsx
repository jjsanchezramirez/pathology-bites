"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Trash2, MoreVertical, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { getPageNumbers } from "@/shared/components/data-table/table-pagination";
import { TableControlBar } from "@/shared/components/data-table/table-control-bar";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { formatBytes, formatDuration } from "@/shared/utils/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { fetchAudio } from "@/features/admin/audio/services/audio";
import type { Audio, AudioListFilters } from "@/features/admin/audio/types";
import { toast } from "@/shared/utils/ui/toast";
import { CATEGORIES } from "@/shared/config/categories";
import { getCategoryById } from "@/shared/config/category-color-map";
import { log } from "@/shared/utils/logging";

function RowActions({
  audio,
  onEdit,
  onDelete,
}: {
  audio: Audio;
  onEdit: (audio: Audio) => void;
  onDelete: (audio: Audio) => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(audio)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem className="text-red-600" onClick={() => onDelete(audio)}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Level 2 categories (subspecialties) for the category dropdown
const PATHOLOGY_CATEGORIES = CATEGORIES.filter((cat) => cat.level === 2).sort((a, b) =>
  a.name.localeCompare(b.name)
);

interface AudioTableProps {
  onEdit: (audio: Audio) => void;
  onDelete: (audio: Audio) => void;
  refreshKey: number;
}

export function AudioTable({ onEdit, onDelete, refreshKey }: AudioTableProps) {
  const [audio, setAudio] = useState<Audio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AudioListFilters>({ page: 0, pageSize: 10 });
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});

  const loadAudio = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchAudio(filters);
      if (result.error) {
        toast.error("Failed to load audio files");
        return;
      }
      setAudio(result.data);
      setTotalItems(result.total);
    } catch (error) {
      log.error("Error loading audio:", error);
      toast.error("Failed to load audio files");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAudio();
  }, [loadAudio, refreshKey]);

  // Debounced search / category filter — reset to first page when they settle
  useEffect(() => {
    setPage(0);
    setFilters((prev) => ({
      ...prev,
      search: debouncedSearchQuery || undefined,
      pathology_category_id:
        categoryFilter !== "all" && categoryFilter !== "uncategorized" ? categoryFilter : undefined,
      page: 0,
    }));
  }, [debouncedSearchQuery, categoryFilter]);

  // Sync page changes into filters (without resetting page)
  useEffect(() => {
    setFilters((prev) => ({ ...prev, page, pageSize }));
  }, [page, pageSize]);

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="space-y-4">
      {/* Search + category filter */}
      <TableControlBar
        searchValue={searchQuery}
        searchPlaceholder="Search by title, description, or transcript..."
        onSearchChange={setSearchQuery}
      >
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="uncategorized">Uncategorized</SelectItem>
            {PATHOLOGY_CATEGORIES.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.shortForm}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableControlBar>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="min-w-[250px]">Audio Details</TableHead>
              <TableHead className="w-[110px]">Category</TableHead>
              <TableHead className="w-[80px]">Size</TableHead>
              <TableHead className="w-[100px]">Created</TableHead>
              <TableHead className="min-w-[300px]">Player</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 ml-auto rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : audio.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    title={
                      searchQuery || categoryFilter !== "all"
                        ? "No audio files found matching your filters"
                        : "No audio files uploaded yet"
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              audio.map((item) => {
                const categoryWithColor = item.pathology_category_id
                  ? getCategoryById(item.pathology_category_id)
                  : null;

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium line-clamp-1 flex-1">{item.title}</p>
                          <div className="text-xs text-muted-foreground shrink-0">
                            {formatDuration(audioDurations[item.id] ?? item.duration_seconds)}
                          </div>
                        </div>
                        {(item.description || item.generated_text) && (
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {item.description || item.generated_text}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {categoryWithColor ? (
                        <span
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `hsl(${categoryWithColor.color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/)?.[1]} ${Math.min(parseInt(categoryWithColor.color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/)?.[2] || "50"), 50)}% 90%)`,
                            color: `hsl(${categoryWithColor.color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/)?.[1]} ${categoryWithColor.color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/)?.[2]}% 20%)`,
                          }}
                        >
                          {categoryWithColor.shortForm}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Uncategorized</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatBytes(item.file_size_bytes)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <audio
                        controls
                        src={item.url}
                        className="w-full h-6"
                        preload="auto"
                        style={{ maxWidth: "none" }}
                        onLoadedMetadata={(e) => {
                          const audioElement = e.currentTarget;
                          if (audioElement.duration && isFinite(audioElement.duration)) {
                            // Update local state to display duration immediately
                            setAudioDurations((prev) => ({
                              ...prev,
                              [item.id]: audioElement.duration,
                            }));

                            // Update database if not set
                            if (!item.duration_seconds) {
                              fetch("/api/admin/audio/update-duration", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  id: item.id,
                                  duration: audioElement.duration,
                                }),
                              }).catch((err) => log.error("Failed to update duration:", err));
                            }
                          }
                        }}
                        onError={(e) => {
                          const error = e.currentTarget.error;
                          const errorDetails = error
                            ? {
                                code: error.code,
                                message: error.message,
                                // MediaError codes: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED
                                type:
                                  error.code === 1
                                    ? "ABORTED"
                                    : error.code === 2
                                      ? "NETWORK"
                                      : error.code === 3
                                        ? "DECODE"
                                        : error.code === 4
                                          ? "SRC_NOT_SUPPORTED"
                                          : "UNKNOWN",
                              }
                            : "No error details available";
                          log.error(
                            `Audio loading error for "${item.title}":`,
                            errorDetails,
                            `\nURL: ${item.url}`
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <RowActions audio={item} onEdit={onEdit} onDelete={onDelete} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalItems)} of{" "}
              {totalItems}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[110px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {getPageNumbers(page, totalPages).map((p, i) =>
              p === "ellipsis" ? (
                <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage(p)}
                >
                  {p + 1}
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
