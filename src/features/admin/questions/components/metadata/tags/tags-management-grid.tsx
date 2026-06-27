// src/features/questions/components/tags-management-grid.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "@/shared/utils/ui/toast";
import { apiClient } from "@/shared/utils/api/api-client";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Search, Plus, Trash2, RefreshCw, Filter, X, Merge } from "lucide-react";
import { Checkbox } from "@/shared/components/ui/checkbox";

import { CreateTagDialog } from "./create-tag-dialog";
import { EditTagDialog } from "./edit-tag-dialog";
import { TagStatsCards } from "./tag-stats-cards";
import { log } from "@/shared/utils/logging";
import {
  type Tag,
  type TagQuestion,
  type SortBy,
  DEFAULT_PAGE_SIZE,
  sortTags,
  sortByLabel,
} from "./tags-utils";
import { TagCard, TagCardSkeleton } from "./tag-card";
import { TagsPagination } from "./tags-pagination";
import {
  DeleteTagDialog,
  BulkDeleteTagsDialog,
  MergeTagsDialog,
  ViewQuestionsDialog,
} from "./tags-dialogs";

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
  const [sortBy, setSortBy] = useState<SortBy>("name");

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

      // Client-side sorting and filtering
      const sortedTags = sortTags(data.tags || [], sortBy);

      setTags(sortedTags);
      setTotalTags(data.totalTags || 0);
      setTotalPages(data.totalPages || 0);
    } catch (error) {
      log.error("Error loading tags:", error);
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
      log.error("Error deleting tag:", error);
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
      log.error("Error loading questions:", error);
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
      log.error("Error bulk deleting tags:", error);
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
      log.error("Error merging tags:", error);
      toast.error(error instanceof Error ? error.message : "Failed to merge tags");
    } finally {
      setIsMerging(false);
    }
  };

  const unusedTagsCount = tags.filter((tag) => (tag.question_count || 0) === 0).length;
  const selectedTags = tags.filter((tag) => selectedTagIds.has(tag.id));

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
        <div className="text-xs">Sorted by: {sortByLabel(sortBy)}</div>
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
      <DeleteTagDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        tag={selectedTag}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
      />

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
      <BulkDeleteTagsDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        count={selectedTagIds.size}
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
      />

      {/* Merge Dialog */}
      <MergeTagsDialog
        open={showMergeDialog}
        onOpenChange={(open) => {
          setShowMergeDialog(open);
          if (!open) {
            setMergeTargetTag(null);
          }
        }}
        selectedTags={selectedTags}
        mergeTargetTag={mergeTargetTag}
        onSelectTarget={setMergeTargetTag}
        isMerging={isMerging}
        onConfirm={handleMergeTags}
      />

      {/* View Questions Dialog */}
      <ViewQuestionsDialog
        open={showViewQuestionsDialog}
        onOpenChange={(open) => {
          setShowViewQuestionsDialog(open);
          if (!open) {
            setViewQuestionsTag(null);
            setTagQuestions([]);
            setQuestionsPage(0);
          }
        }}
        tag={viewQuestionsTag}
        questions={tagQuestions}
        loading={loadingQuestions}
        questionsPage={questionsPage}
        onQuestionsPageChange={setQuestionsPage}
        questionsPageSize={questionsPageSize}
      />
    </div>
  );
}
