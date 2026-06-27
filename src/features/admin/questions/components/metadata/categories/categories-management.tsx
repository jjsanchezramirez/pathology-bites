// src/components/question-management/categories-management.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "@/shared/utils/ui/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Search, Loader2, Plus, Trash2, RefreshCw, Users } from "lucide-react";
import { CreateCategoryDialog } from "./create-category-dialog";
import { EditCategoryDialog } from "./edit-category-dialog";
import { log } from "@/shared/utils/logging";
import { type Category, PAGE_SIZE, organizeHierarchically } from "./categories-utils";
import { CategoryTableRow } from "./category-table-row";
import { CategoriesPagination } from "./categories-pagination";
import {
  DeleteCategoryDialog,
  BulkDeleteCategoriesDialog,
  BulkParentCategoryDialog,
} from "./categories-dialogs";

export function CategoriesManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Selection and bulk operations state
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkParentDialog, setShowBulkParentDialog] = useState(false);
  const [bulkParentId, setBulkParentId] = useState<string>("");
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

  // Selection helper functions
  const handleSelectCategory = (categoryId: string) => {
    const newSelected = new Set(selectedCategoryIds);
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId);
    } else {
      newSelected.add(categoryId);
    }
    setSelectedCategoryIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedCategoryIds.size === categories.length) {
      setSelectedCategoryIds(new Set());
    } else {
      setSelectedCategoryIds(new Set(categories.map((category) => category.id)));
    }
  };

  const clearSelection = () => {
    setSelectedCategoryIds(new Set());
  };

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      // For hierarchical display, we need all categories to organize them properly
      // Use a large page size to get all categories, then handle pagination client-side
      const params = new URLSearchParams({
        page: "0",
        pageSize: "1000", // Get all categories for proper hierarchy
        ...(searchTerm && { search: searchTerm }),
      });

      const response = await fetch(`/api/admin/questions/metadata/categories?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load categories");
      }

      const data = await response.json();
      const allCategories = data.categories || [];

      // For search results, show all matching categories
      if (searchTerm) {
        setCategories(allCategories);
        setTotalCategories(allCategories.length);
        setTotalPages(1);
      } else {
        // For normal display, organize hierarchically first, then paginate
        const organizedCategories = organizeHierarchically(allCategories);
        const startIndex = page * PAGE_SIZE;
        const endIndex = startIndex + PAGE_SIZE;
        const paginatedCategories = organizedCategories.slice(startIndex, endIndex);

        setCategories(paginatedCategories);
        setTotalCategories(organizedCategories.length);
        setTotalPages(Math.ceil(organizedCategories.length / PAGE_SIZE));
      }
    } catch (error) {
      log.error("Error loading categories:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, page]);

  const handleDelete = async () => {
    if (!selectedCategory) return;

    setIsDeleting(true);
    try {
      const response = await fetch("/api/admin/questions/metadata/categories", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          categoryId: selectedCategory.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete category");
      }

      toast.success("Category deleted successfully");

      setShowDeleteDialog(false);
      setSelectedCategory(null);
      loadCategories();
    } catch (error) {
      log.error("Error deleting category:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete category");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    loadCategories();
  };

  const handleEditSuccess = () => {
    setShowEditDialog(false);
    setSelectedCategory(null);
    loadCategories();
  };

  const handleBulkDelete = async () => {
    if (selectedCategoryIds.size === 0) return;

    setIsBulkDeleting(true);
    try {
      const categoryIds = Array.from(selectedCategoryIds);

      const response = await fetch("/api/admin/questions/metadata/categories/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ categoryIds }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete categories");
      }

      const result = await response.json();
      toast.success(`Successfully deleted ${result.deletedCount} categories`);

      setShowBulkDeleteDialog(false);
      clearSelection();
      loadCategories();
    } catch (error) {
      log.error("Error bulk deleting categories:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete categories");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkParentAssignment = async () => {
    if (selectedCategoryIds.size === 0) return;

    setIsBulkAssigning(true);
    try {
      const categoryIds = Array.from(selectedCategoryIds);

      const response = await fetch("/api/admin/questions/metadata/categories/bulk-assign-parent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          categoryIds,
          parentId: bulkParentId || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to assign parent categories");
      }

      const result = await response.json();
      toast.success(`Successfully updated ${result.updatedCount} categories`);

      setShowBulkParentDialog(false);
      setBulkParentId("");
      clearSelection();
      loadCategories();
    } catch (error) {
      log.error("Error bulk assigning parent:", error);
      toast.error(error instanceof Error ? error.message : "Failed to assign parent categories");
    } finally {
      setIsBulkAssigning(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return (
    <div className="space-y-4">
      {/* Header with search and create button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => loadCategories()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {selectedCategoryIds.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedCategoryIds.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkParentDialog(true)}
                disabled={loading}
              >
                <Users className="h-4 w-4 mr-2" />
                Assign Parent ({selectedCategoryIds.size})
              </Button>
            </>
          )}
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Category
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Total: {totalCategories} categories</span>
        {searchTerm && <span>Showing results for "{searchTerm}"</span>}
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedCategoryIds.size === categories.length && categories.length > 0}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all categories"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Short Form</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead className="w-[70px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {searchTerm ? "No categories found matching your search" : "No categories found"}
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <CategoryTableRow
                  key={category.id}
                  category={category}
                  selected={selectedCategoryIds.has(category.id)}
                  onToggleSelect={handleSelectCategory}
                  onEdit={(c) => {
                    setSelectedCategory(c);
                    setShowEditDialog(true);
                  }}
                  onDelete={(c) => {
                    setSelectedCategory(c);
                    setShowDeleteDialog(true);
                  }}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <CategoriesPagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Delete Dialog */}
      <DeleteCategoryDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        category={selectedCategory}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
      />

      {/* Bulk Delete Dialog */}
      <BulkDeleteCategoriesDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        count={selectedCategoryIds.size}
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
      />

      {/* Bulk Parent Assignment Dialog */}
      <BulkParentCategoryDialog
        open={showBulkParentDialog}
        onOpenChange={setShowBulkParentDialog}
        count={selectedCategoryIds.size}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        bulkParentId={bulkParentId}
        onBulkParentIdChange={setBulkParentId}
        isAssigning={isBulkAssigning}
        onConfirm={handleBulkParentAssignment}
      />

      {/* Create Dialog */}
      <CreateCategoryDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Dialog */}
      <EditCategoryDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={handleEditSuccess}
        category={selectedCategory}
      />
    </div>
  );
}
