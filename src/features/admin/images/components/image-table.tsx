// src/components/images/images-table.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { CategoryBadge } from "@/shared/components/ui/category-badge";
import { ImageTypeBadge } from "@/shared/components/ui/image-type-badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { getPageNumbers } from "@/shared/components/data-table/table-pagination";
import { TableControlBar } from "@/shared/components/data-table/table-control-bar";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { toast } from "@/shared/utils/ui/toast";
import { Upload, MoreVertical, Edit, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { ImagePreview } from "./image-preview";
import { EditImageDialog } from "./edit-dialog";
import { UploadDialog } from "./upload-dialog";
import { DeleteImageDialog } from "./delete-image-dialog";
import { fetchImages } from "@/features/admin/images/services/images";
import {
  getImageUsageStatsForIds,
  ImageUsageStats,
} from "@/features/admin/images/services/image-analytics";
import { formatSize } from "@/features/admin/images/services/image-upload";
import { CATEGORIES } from "@/shared/config/categories";

import { ImageData, ImageCategory, PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/shared/types/images";
import { log } from "@/shared/utils/logging";

// Define the valid category values type
type CategoryFilterType = "all" | "unused" | "uncategorized" | ImageCategory;

// Level 2 categories (subspecialties) for the pathology category dropdown
const pathologyCategories = CATEGORIES.filter((cat) => cat.level === 2).sort((a, b) =>
  a.name.localeCompare(b.name)
);

// Local pagination row — kept custom (not the shared <TablePagination>) because it
// embeds an "Items per page" selector and must stay visible when totalPages === 1.
function ImagesTablePagination({
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
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">
          Showing {totalItems > 0 ? currentPage * pageSize + 1 : 0} to{" "}
          {Math.min((currentPage + 1) * pageSize, totalItems)} of {totalItems} images
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
          pageNum === "ellipsis" ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              className="w-9"
            >
              {pageNum + 1}
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

// Table Row Actions component
function RowActions({
  image,
  onEdit,
  onDelete,
}: {
  image: ImageData;
  onEdit: (image: ImageData) => void;
  onDelete: (image: ImageData) => void;
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
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onEdit(image)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem className="text-red-600" onClick={() => onDelete(image)}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ImagesTableProps {
  onImageChange?: () => void;
}

export function ImagesTable({ onImageChange }: ImagesTableProps = {}) {
  const [images, setImages] = useState<ImageData[]>([]);
  const [imageStats, setImageStats] = useState<ImageUsageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  // Debounce search term - 500ms to reduce Supabase queries
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>("all");
  const [pathologyCategoryFilter, setPathologyCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<ImageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchImages({
        page,
        pageSize: pageSize,
        searchTerm: debouncedSearchTerm || undefined,
        category:
          categoryFilter === "all" || categoryFilter === "unused" ? undefined : categoryFilter,
        showUnusedOnly: categoryFilter === "unused",
        showUncategorizedOnly:
          categoryFilter !== "unused" && pathologyCategoryFilter === "uncategorized",
        pathologyCategoryId:
          categoryFilter !== "unused" &&
          pathologyCategoryFilter &&
          pathologyCategoryFilter !== "all" &&
          pathologyCategoryFilter !== "uncategorized"
            ? pathologyCategoryFilter
            : undefined,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setImages(result.data);
      setTotalItems(result.total);
      setTotalPages(Math.ceil(result.total / pageSize));

      // Fetch usage stats only for this page's images
      if (result.data.length > 0) {
        const ids = result.data.map((img) => img.id);
        const statsData = await getImageUsageStatsForIds(ids);
        setImageStats(statsData);
      } else {
        setImageStats([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load images";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, categoryFilter, pathologyCategoryFilter, page, pageSize]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  // Clear selected image when edit dialog closes (like upload dialog resets state)
  useEffect(() => {
    if (!showEditDialog) {
      setSelectedImage(null);
    }
  }, [showEditDialog]);

  const handleDelete = useCallback((image: ImageData) => {
    setImageToDelete(image);
    setShowDeleteDialog(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    // Remove the deleted image from the local state
    if (imageToDelete) {
      setImages((prev) => prev.filter((img) => img.id !== imageToDelete.id));
      setTotalItems((prev) => prev - 1);

      // Refresh storage stats
      onImageChange?.();

      // If this was the last image on the current page and we're not on page 0,
      // go back one page
      if (images.length === 1 && page > 0) {
        setPage((prev) => prev - 1);
      } else {
        // Otherwise, reload the current page
        loadImages();
      }
    }
  }, [imageToDelete, images.length, page, loadImages, onImageChange]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setPage(0);
  }, []);

  const handleCategoryChange = useCallback((category: CategoryFilterType) => {
    setCategoryFilter(category);
    setPage(0);

    // Reset pathology category filter when switching to "Unused Images"
    // because v_orphaned_images view doesn't have pathology_category_id field
    if (category === "unused") {
      setPathologyCategoryFilter("all");
    }
  }, []);

  const handlePathologyCategoryChange = useCallback((categoryId: string) => {
    setPathologyCategoryFilter(categoryId);
    setPage(0);
  }, []);

  const handleEditSave = useCallback(() => {
    log.debug("handleEditSave called - refreshing table");
    // Force reload by temporarily resetting state then reloading
    // This ensures we get fresh data after an edit that might affect filters
    setImages([]);
    loadImages();

    // Refresh storage stats (editing might change usage status)
    onImageChange?.();
  }, [loadImages, onImageChange]);

  const handleUploadComplete = useCallback(() => {
    setShowUploadDialog(false);
    setPage(0); // Go to first page to see newly uploaded images
    loadImages();

    // Refresh storage stats
    onImageChange?.();
  }, [loadImages, onImageChange]);

  if (error && !loading) {
    return (
      <div className="text-center p-8 text-destructive">
        <p>{error}</p>
        <Button onClick={loadImages} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TableControlBar
        searchValue={searchTerm}
        searchPlaceholder="Search by name, description, or source..."
        onSearchChange={handleSearch}
      >
        <Select
          value={categoryFilter}
          onValueChange={(value: CategoryFilterType) => handleCategoryChange(value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Image Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="unused">Unused Images</SelectItem>
            <SelectItem value="microscopic">Microscopic</SelectItem>
            <SelectItem value="figure">Figure</SelectItem>
            <SelectItem value="table">Table</SelectItem>
            <SelectItem value="gross">Gross</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={pathologyCategoryFilter}
          onValueChange={handlePathologyCategoryChange}
          disabled={categoryFilter === "unused"}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="uncategorized">Uncategorized</SelectItem>
            {pathologyCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.shortForm}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => setShowUploadDialog(true)}
          className="bg-primary hover:bg-primary/90"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Images
        </Button>
      </TableControlBar>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-24">Preview</TableHead>
              <TableHead>Image Details</TableHead>
              <TableHead className="w-20">Usage</TableHead>
              <TableHead className="w-[70px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell>
                    <Skeleton className="h-12 w-12 rounded" />
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-3/4" />
                      <div className="flex items-center gap-1.5">
                        <Skeleton className="h-4 w-16 rounded-full" />
                        <Skeleton className="h-4 w-20 rounded-full" />
                        <Skeleton className="h-4 w-12 rounded-full" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-3 w-6" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 ml-auto rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : images.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    title={
                      categoryFilter === "unused"
                        ? "No unused images found"
                        : pathologyCategoryFilter === "uncategorized"
                          ? "No uncategorized images found"
                          : searchTerm ||
                              categoryFilter !== "all" ||
                              pathologyCategoryFilter !== "all"
                            ? "No images found matching your filters"
                            : "No images uploaded yet"
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              images.map((image) => {
                // Find the corresponding stats for this image
                const stats = imageStats.find((stat) => stat.id === image.id);

                // Get pathology category from the joined data
                const pathologyCategory = (image as { pathology_category?: unknown })
                  .pathology_category as
                  | { id?: string; short_form?: string; name?: string; color?: string }
                  | undefined;

                return (
                  <TableRow key={image.id}>
                    <TableCell>
                      <ImagePreview src={image.url} alt={image.alt_text || "Image"} size="sm" />
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="space-y-1.5">
                        <p className="text-sm font-medium line-clamp-1">
                          {image.alt_text || "Untitled Image"}
                        </p>
                        {image.description && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {image.description}
                          </p>
                        )}
                        <div className="flex items-center flex-wrap gap-1.5">
                          <ImageTypeBadge
                            category={image.category as ImageCategory}
                            className="text-[10px] px-1.5 py-0"
                          />
                          {pathologyCategory && pathologyCategory.id ? (
                            <CategoryBadge
                              category={{
                                id: pathologyCategory.id,
                                color: pathologyCategory.color,
                                short_form: pathologyCategory.short_form,
                                name: pathologyCategory.name,
                              }}
                              className="text-[10px] px-1.5 py-0"
                            />
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Uncategorized
                            </Badge>
                          )}
                          {image.file_size_bytes && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {formatSize(image.file_size_bytes)}
                            </Badge>
                          )}
                          {image.width && image.height && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {image.width} × {image.height}
                            </Badge>
                          )}
                          {image.magnification && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-blue-300 bg-blue-50 text-blue-700"
                            >
                              {image.magnification}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {stats?.is_orphaned ? (
                          <div title="Not used in any questions">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          </div>
                        ) : (
                          <div title={`Used in ${stats?.usage_count || 0} question(s)`}>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {stats?.usage_count || 0}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RowActions
                        image={image}
                        onEdit={(image) => {
                          setSelectedImage(image);
                          setShowEditDialog(true);
                        }}
                        onDelete={handleDelete}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 0 && (
        <ImagesTablePagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0); // Reset to first page when changing page size
          }}
        />
      )}

      {/* Dialogs */}
      <EditImageDialog
        image={selectedImage}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSave={handleEditSave}
      />

      <UploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUpload={handleUploadComplete}
      />

      <DeleteImageDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        image={imageToDelete}
        onSuccess={handleDeleteConfirm}
      />
    </div>
  );
}
