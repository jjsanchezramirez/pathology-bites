// src/features/questions/components/tags-management-grid.tsx
"use client";

import { useState, useCallback, useEffect, memo } from "react";
import { createClient as _createClient } from "@/shared/services/client";
import { toast } from "@/shared/utils/ui/toast";
import { apiClient } from "@/shared/utils/api/api-client";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Label } from "@/shared/components/ui/label";
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
import {
  Search,
  Loader2,
  MoreVertical as _MoreVertical,
  Plus,
  Trash2,
  RefreshCw,
  Edit,
  Filter,
  Check as _Check,
  X,
  Merge,
  Eye,
} from "lucide-react";
import { Checkbox } from "@/shared/components/ui/checkbox";

import { CreateTagDialog } from "./create-tag-dialog";
import { EditTagDialog } from "./edit-tag-dialog";
import { BlurredDialog } from "@/shared/components/ui/blurred-dialog";
import { TagStatsCards } from "./tag-stats-cards";

interface Tag {
  id: string;
  name: string;
  created_at: string;
  question_count?: number;
}

const DEFAULT_PAGE_SIZE = 100; // Increased for grid layout
const PAGE_SIZE_OPTIONS = [50, 100, 200, 500] as const;

function TagsPagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  onPageSizeChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}) {
  // Calculate which page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(0);

      // Calculate range around current page
      let start = Math.max(1, currentPage - 1);
      let end = Math.min(totalPages - 2, currentPage + 1);

      // Adjust if near the beginning
      if (currentPage < 3) {
        end = 3;
      }

      // Adjust if near the end
      if (currentPage > totalPages - 4) {
        start = totalPages - 4;
      }

      // Add ellipsis if needed
      if (start > 1) {
        pages.push("...");
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis if needed
      if (end < totalPages - 2) {
        pages.push("...");
      }

      // Always show last page
      pages.push(totalPages - 1);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">
          Showing {totalItems > 0 ? currentPage * pageSize + 1 : 0} to{" "}
          {Math.min((currentPage + 1) * pageSize, totalItems)} of {totalItems} tags
        </p>
        <div className="flex items-center gap-2">
          <Label htmlFor="pageSize" className="text-sm text-muted-foreground whitespace-nowrap">
            Items per page:
          </Label>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(parseInt(value))}
          >
            <SelectTrigger id="pageSize" className="w-[80px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-1 items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
        >
          Previous
        </Button>

        {pageNumbers.map((pageNum, idx) =>
          pageNum === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(pageNum as number)}
              className="w-9"
            >
              {(pageNum as number) + 1}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

const TagCardSkeleton = memo(function TagCardSkeleton() {
  return (
    <div className="bg-card border rounded-lg p-3 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-4 w-4 bg-muted rounded" />
        <div className="h-4 bg-muted rounded flex-1" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-5 w-20 bg-muted rounded" />
        <div className="flex items-center gap-1">
          <div className="h-6 w-6 bg-muted rounded" />
          <div className="h-6 w-6 bg-muted rounded" />
          <div className="h-6 w-6 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
});

const TagCard = memo(function TagCard({
  tag,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onViewQuestions,
}: {
  tag: Tag;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
  onViewQuestions: (tag: Tag) => void;
}) {
  return (
    <div
      className={`group relative bg-card border rounded-lg p-3 hover:shadow-sm transition-all duration-200 ${
        isSelected ? "border-primary bg-primary/5" : "hover:border-primary/20"
      }`}
    >
      {/* Selection checkbox and tag name */}
      <div className="flex items-center gap-2 mb-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(tag.id)}
          className="h-4 w-4"
        />
        <h3 className="font-medium text-sm truncate flex-1" title={tag.name}>
          {tag.name}
        </h3>
      </div>

      {/* Stats and actions */}
      <div className="flex items-center justify-between">
        <Badge
          variant={tag.question_count === 0 ? "outline" : "secondary"}
          className={`text-xs ${tag.question_count === 0 ? "text-muted-foreground" : ""}`}
        >
          {tag.question_count || 0} questions
        </Badge>

        {/* Simple action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onViewQuestions(tag)}
            title="View questions"
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onEdit(tag)}
            title="Edit tag"
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(tag)}
            title="Delete tag"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
});

interface TagQuestion {
  id: string;
  title: string;
  stem: string;
  category?: string;
}

export function TagsManagementGrid() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(0);
  const [totalTags, setTotalTags] = useState(0);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "usage" | "date" | "oldest" | "unused">("name");

  // New state for enhanced features
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeTargetTag, setMergeTargetTag] = useState<Tag | null>(null);
  const [showViewQuestionsDialog, setShowViewQuestionsDialog] = useState(false);
  const [viewQuestionsTag, setViewQuestionsTag] = useState<Tag | null>(null);
  const [tagQuestions, setTagQuestions] = useState<TagQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionsPage, setQuestionsPage] = useState(0);
  const [questionsPageSize] = useState(10); // Fixed page size for questions modal

  // Debounce search term (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadTags = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
      });

      const response = await fetch(`/api/admin/questions/metadata/tags?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load tags");
      }

      const data = await response.json();

      let sortedTags = data.tags || [];

      // Client-side sorting and filtering
      switch (sortBy) {
        case "usage":
          sortedTags.sort((a: Tag, b: Tag) => (b.question_count || 0) - (a.question_count || 0));
          break;
        case "date":
          sortedTags.sort(
            (a: Tag, b: Tag) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          break;
        case "oldest":
          sortedTags.sort(
            (a: Tag, b: Tag) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          break;
        case "unused":
          sortedTags = sortedTags.filter((tag: Tag) => (tag.question_count || 0) === 0);
          sortedTags.sort((a: Tag, b: Tag) => a.name.localeCompare(b.name));
          break;
        case "name":
        default:
          sortedTags.sort((a: Tag, b: Tag) => a.name.localeCompare(b.name));
          break;
      }

      setTags(sortedTags);
      setTotalTags(data.totalTags || 0);
      setTotalPages(data.totalPages || 0);
    } catch (error) {
      console.error("Error loading tags:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, page, pageSize, sortBy]);

  const handleDelete = async () => {
    if (!selectedTag) return;

    setIsDeleting(true);
    try {
      const response = await apiClient.delete("/api/admin/questions/metadata/tags", {
        tagId: selectedTag.id,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete tag");
      }

      toast.success("Tag deleted successfully");

      setShowDeleteDialog(false);
      setSelectedTag(null);
      loadTags();
    } catch (error) {
      console.error("Error deleting tag:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete tag");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    loadTags();
  };

  const handleEditSuccess = () => {
    setShowEditDialog(false);
    setSelectedTag(null);
    loadTags();
  };

  const handleEditTag = useCallback((tag: Tag) => {
    setSelectedTag(tag);
    setShowEditDialog(true);
  }, []);

  const handleDeleteTag = useCallback((tag: Tag) => {
    setSelectedTag(tag);
    setShowDeleteDialog(true);
  }, []);

  const handleViewQuestions = useCallback(async (tag: Tag) => {
    setViewQuestionsTag(tag);
    setShowViewQuestionsDialog(true);
    setLoadingQuestions(true);

    try {
      const response = await fetch(`/api/admin/questions/metadata/tags/${tag.id}/questions`);
      if (!response.ok) {
        throw new Error("Failed to load questions");
      }
      const data = await response.json();
      setTagQuestions(data.questions || []);
    } catch (error) {
      console.error("Error loading questions:", error);
      toast.error("Failed to load questions for this tag");
      setTagQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  // New handlers for enhanced features
  const handleSelectTag = useCallback(
    (tagId: string) => {
      const newSelected = new Set(selectedTagIds);
      if (newSelected.has(tagId)) {
        newSelected.delete(tagId);
      } else {
        newSelected.add(tagId);
      }
      setSelectedTagIds(newSelected);
    },
    [selectedTagIds]
  );

  const handleSelectAll = useCallback(() => {
    if (selectedTagIds.size === tags.length) {
      setSelectedTagIds(new Set());
    } else {
      setSelectedTagIds(new Set(tags.map((tag) => tag.id)));
    }
  }, [selectedTagIds.size, tags]);

  const handleBulkDelete = async () => {
    if (selectedTagIds.size === 0) return;

    setIsBulkDeleting(true);
    try {
      const promises = Array.from(selectedTagIds).map((tagId) =>
        fetch("/api/admin/questions/metadata/tags", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tagId }),
        })
      );

      const results = await Promise.all(promises);
      const failedDeletes = results.filter((response) => !response.ok);

      if (failedDeletes.length > 0) {
        toast.error(`Failed to delete ${failedDeletes.length} tags`);
      } else {
        toast.success(`Successfully deleted ${selectedTagIds.size} tags`);
      }

      setSelectedTagIds(new Set());
      setShowBulkDeleteDialog(false);
      loadTags();
    } catch (error) {
      console.error("Error bulk deleting tags:", error);
      toast.error("Failed to delete tags");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleMergeTags = async () => {
    if (selectedTagIds.size < 2 || !mergeTargetTag) return;

    setIsMerging(true);
    try {
      const sourceTagIds = Array.from(selectedTagIds).filter((id) => id !== mergeTargetTag.id);

      const response = await fetch("/api/admin/questions/metadata/tags/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          sourceTagIds,
          targetTagId: mergeTargetTag.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to merge tags");
      }

      const result = await response.json();
      toast.success(`Successfully merged ${result.mergedCount} tags into "${mergeTargetTag.name}"`);

      setShowMergeDialog(false);
      setMergeTargetTag(null);
      setSelectedTagIds(new Set());
      loadTags();
    } catch (error) {
      console.error("Error merging tags:", error);
      toast.error(error instanceof Error ? error.message : "Failed to merge tags");
    } finally {
      setIsMerging(false);
    }
  };

  const unusedTagsCount = tags.filter((tag) => (tag.question_count || 0) === 0).length;

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <TagStatsCards tags={tags} totalTags={totalTags} loading={loading} />

      {/* Header with search, controls and create button */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tags..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                className="pl-8"
              />
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex items-center gap-2">
              {/* Sort dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setSortBy("name")}>
                    Alphabetical
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("usage")}>Most Used</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("date")}>Newest</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("oldest")}>Oldest</DropdownMenuItem>
                  <div className="border-t my-1"></div>
                  <DropdownMenuItem onClick={() => setSortBy("unused")}>
                    Unused ({unusedTagsCount})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="sm" onClick={() => loadTags()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Tag
          </Button>
        </div>

        {/* Selection and Bulk Actions */}
        {selectedTagIds.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedTagIds.size} tag{selectedTagIds.size === 1 ? "" : "s"} selected
              </span>
              <Button variant="outline" size="sm" onClick={() => setSelectedTagIds(new Set())}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
                disabled={selectedTagIds.size === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMergeDialog(true)}
                disabled={selectedTagIds.size < 2}
              >
                <Merge className="h-4 w-4 mr-2" />
                Merge Selected
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Stats and Select All */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedTagIds.size === tags.length && tags.length > 0}
              onCheckedChange={handleSelectAll}
              className="h-4 w-4"
            />
            <span>
              {selectedTagIds.size > 0
                ? `${selectedTagIds.size} of ${tags.length} selected`
                : `${tags.length} tags`}
            </span>
          </div>
          {debouncedSearchTerm && <span>Showing results for "{debouncedSearchTerm}"</span>}
        </div>
        <div className="text-xs">
          Sorted by:{" "}
          {sortBy === "name"
            ? "Alphabetical"
            : sortBy === "usage"
              ? "Most Used"
              : sortBy === "date"
                ? "Newest"
                : sortBy === "oldest"
                  ? "Oldest"
                  : sortBy === "unused"
                    ? "Unused Only"
                    : "Alphabetical"}
        </div>
      </div>

      {/* Flowing Layout */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, idx) => (
            <TagCardSkeleton key={idx} />
          ))}
        </div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-muted-foreground">
            {debouncedSearchTerm
              ? "No tags found matching your search"
              : sortBy === "unused"
                ? "No unused tags found"
                : "No tags found"}
          </div>
          {!debouncedSearchTerm && sortBy !== "unused" && (
            <Button onClick={() => setShowCreateDialog(true)} className="mt-4" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create your first tag
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {tags.map((tag) => (
            <TagCard
              key={tag.id}
              tag={tag}
              isSelected={selectedTagIds.has(tag.id)}
              onSelect={handleSelectTag}
              onEdit={handleEditTag}
              onDelete={handleDeleteTag}
              onViewQuestions={handleViewQuestions}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 0 && (
        <TagsPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalTags}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0); // Reset to first page when changing page size
          }}
        />
      )}

      {/* Delete Dialog */}
      <BlurredDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Tag"
        description={`Are you sure you want to delete the tag "${selectedTag?.name}"? This will remove it from all associated questions and cannot be undone.`}
        maxWidth="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button onClick={handleDelete} disabled={isDeleting} variant="destructive">
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </>
        }
      >
        <div className="py-2">
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. The tag will be permanently removed from the system.
          </p>
        </div>
      </BlurredDialog>

      {/* Create Dialog */}
      <CreateTagDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Dialog */}
      <EditTagDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={handleEditSuccess}
        tag={selectedTag}
      />

      {/* Bulk Delete Dialog */}
      <BlurredDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        title="Delete Selected Tags"
        description={`Are you sure you want to delete ${selectedTagIds.size} selected tag${selectedTagIds.size === 1 ? "" : "s"}? This will remove them from all associated questions and cannot be undone.`}
        maxWidth="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowBulkDeleteDialog(false)}
              disabled={isBulkDeleting}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkDelete} disabled={isBulkDeleting} variant="destructive">
              {isBulkDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedTagIds.size} Tag${selectedTagIds.size === 1 ? "" : "s"}`
              )}
            </Button>
          </>
        }
      >
        <div className="py-2">
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. All selected tags will be permanently removed from the
            system and from all associated questions.
          </p>
        </div>
      </BlurredDialog>

      {/* Merge Dialog */}
      <BlurredDialog
        open={showMergeDialog}
        onOpenChange={(open) => {
          setShowMergeDialog(open);
          if (!open) {
            setMergeTargetTag(null);
          }
        }}
        title="Merge Tags"
        description="Select a target tag to merge the selected tags into. All questions will be reassigned to the target tag."
        maxWidth="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowMergeDialog(false);
                setMergeTargetTag(null);
              }}
              disabled={isMerging}
            >
              Cancel
            </Button>
            <Button onClick={handleMergeTags} disabled={!mergeTargetTag || isMerging}>
              {isMerging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                "Merge Tags"
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Target Tag Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Target Tag:</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  {mergeTargetTag ? mergeTargetTag.name : "Select target tag..."}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                {tags
                  .filter((tag) => selectedTagIds.has(tag.id))
                  .map((tag) => (
                    <DropdownMenuItem key={tag.id} onClick={() => setMergeTargetTag(tag)}>
                      {tag.name} ({tag.question_count || 0} questions)
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Preview Section */}
          {mergeTargetTag && (
            <div className="space-y-3 border-t pt-3">
              <h4 className="text-sm font-medium">Merge Preview:</h4>

              {/* Tags to be merged */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Tags to be merged (will be deleted):
                </p>
                <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-md border">
                  {tags
                    .filter((tag) => selectedTagIds.has(tag.id) && tag.id !== mergeTargetTag.id)
                    .map((tag) => (
                      <Badge key={tag.id} variant="outline" className="text-xs">
                        {tag.name} ({tag.question_count || 0})
                      </Badge>
                    ))}
                </div>
              </div>

              {/* Target tag */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Into target tag:</p>
                <div className="p-3 bg-primary/10 rounded-md border border-primary/20">
                  <Badge variant="default" className="text-xs">
                    {mergeTargetTag.name} ({mergeTargetTag.question_count || 0} questions)
                  </Badge>
                </div>
              </div>

              {/* Summary */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-900">
                <p className="text-xs text-blue-900 dark:text-blue-300">
                  <strong>Result:</strong> {selectedTagIds.size - 1} tag
                  {selectedTagIds.size - 1 === 1 ? "" : "s"} will be deleted, and their questions
                  will be reassigned to "{mergeTargetTag.name}".
                </p>
              </div>
            </div>
          )}
        </div>
      </BlurredDialog>

      {/* View Questions Dialog */}
      <BlurredDialog
        open={showViewQuestionsDialog}
        onOpenChange={(open) => {
          setShowViewQuestionsDialog(open);
          if (!open) {
            setViewQuestionsTag(null);
            setTagQuestions([]);
            setQuestionsPage(0);
          }
        }}
        title={`Questions with tag: ${viewQuestionsTag?.name || ""}`}
        description={`Showing ${tagQuestions.length} question${tagQuestions.length === 1 ? "" : "s"} that use this tag.`}
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            {/* Pagination */}
            {tagQuestions.length > questionsPageSize && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Page {questionsPage + 1} of {Math.ceil(tagQuestions.length / questionsPageSize)}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuestionsPage((p) => Math.max(0, p - 1))}
                    disabled={questionsPage === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setQuestionsPage((p) =>
                        Math.min(Math.ceil(tagQuestions.length / questionsPageSize) - 1, p + 1)
                      )
                    }
                    disabled={
                      questionsPage >= Math.ceil(tagQuestions.length / questionsPageSize) - 1
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowViewQuestionsDialog(false)}
              className="ml-auto"
            >
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {loadingQuestions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading questions...</span>
            </div>
          ) : tagQuestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No questions found with this tag
            </div>
          ) : (
            <div className="space-y-3">
              {tagQuestions
                .slice(questionsPage * questionsPageSize, (questionsPage + 1) * questionsPageSize)
                .map((question, index) => (
                  <div key={question.id} className="border rounded-lg p-3 hover:bg-muted/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-1">
                          {question.title ||
                            `Question ${questionsPage * questionsPageSize + index + 1}`}
                        </div>
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {question.stem || "No question content available"}
                        </div>
                        {question.category && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              {question.category}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </BlurredDialog>
    </div>
  );
}
