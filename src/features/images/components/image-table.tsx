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
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { toast } from "@/shared/utils/toast";
import {
  Search,
  Loader2,
  Upload,
  MoreVertical,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
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
import { ImagePreview } from "./image-preview";
import { EditImageDialog } from "./edit-dialog";
import { UploadDialog } from "./upload-dialog";
import { DeleteImageDialog } from "./delete-image-dialog";
import { fetchImages } from "@/features/images/services/images";
import { getImageUsageStats, ImageUsageStats } from "@/features/images/services/image-analytics";
import { getCategoryById } from "@/shared/constants/category-color-map";
import { CATEGORIES } from "@/shared/constants/categories";

import {
  ImageData,
  ImageCategory,
  IMAGE_CATEGORIES,
  PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from "@/features/images/types/images";

// Define the valid category values type
type CategoryFilterType = "all" | "unused" | "uncategorized" | ImageCategory;

// Category color configurations
const getCategoryColor = (category: ImageCategory): string => {
  switch (category) {
    case "microscopic":
      return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300";
    case "gross":
      return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300";
    case "figure":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300";
    case "table":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300";
    default:
      return "bg-secondary text-secondary-foreground";
  }
};

// Table Header component with search and filters
function TableControls({
  onSearch,
  onCategoryChange,
  onPathologyCategoryChange,
  onUpload,
  categoryFilter,
  pathologyCategoryFilter,
}: {
  onSearch: (term: string) => void;
  onCategoryChange: (category: CategoryFilterType) => void;
  onPathologyCategoryChange: (categoryId: string) => void;
  onUpload: () => void;
  categoryFilter: CategoryFilterType;
  pathologyCategoryFilter: string;
}) {
  // Get level 2 categories (subspecialties) for the pathology category dropdown
  const pathologyCategories = CATEGORIES.filter((cat) => cat.level === 2).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="flex gap-4 items-center justify-between">
      <div className="flex gap-4 items-center flex-1">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search alt text..."
            onChange={(e) => onSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(value: CategoryFilterType) => onCategoryChange(value)}
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
          onValueChange={(value: string) => onPathologyCategoryChange(value)}
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
      </div>
      <Button onClick={onUpload} className="bg-primary hover:bg-primary/90">
        <Upload className="h-4 w-4 mr-2" />
        Upload Images
      </Button>
    </div>
  );
}

// Pagination component
function TablePagination({
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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
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

  // Debounce search term - 500ms to reduce Supabase queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadImages = useCallback(async () => {
    console.log("loadImages function called");
    setLoading(true);
    setError(null);
    try {
      // Load both regular images and analytics data
      const [result, statsData] = await Promise.all([
        fetchImages({
          page,
          pageSize: pageSize,
          searchTerm: debouncedSearchTerm || undefined,
          category:
            categoryFilter === "all" || categoryFilter === "unused" ? undefined : categoryFilter,
          showUnusedOnly: categoryFilter === "unused",
          // Only apply pathology category filters when NOT showing unused images
          // (v_orphaned_images view doesn't have pathology_category_id field)
          showUncategorizedOnly:
            categoryFilter !== "unused" && pathologyCategoryFilter === "uncategorized",
          pathologyCategoryId:
            categoryFilter !== "unused" &&
            pathologyCategoryFilter &&
            pathologyCategoryFilter !== "all" &&
            pathologyCategoryFilter !== "uncategorized"
              ? pathologyCategoryFilter
              : undefined,
        }),
        getImageUsageStats(),
      ]);

      if (result.error) {
        throw new Error(result.error);
      }

      setImages(result.data);
      setImageStats(statsData);
      setTotalItems(result.total);
      setTotalPages(Math.ceil(result.total / pageSize));
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
    console.log("handleEditSave called - refreshing table");
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
      <TableControls
        onSearch={handleSearch}
        onCategoryChange={handleCategoryChange}
        onPathologyCategoryChange={handlePathologyCategoryChange}
        onUpload={() => setShowUploadDialog(true)}
        categoryFilter={categoryFilter}
        pathologyCategoryFilter={pathologyCategoryFilter}
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-24">Preview</TableHead>
              <TableHead>Image Details</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="w-24">Size</TableHead>
              <TableHead className="w-28">Dimensions</TableHead>
              <TableHead className="w-20">Usage</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : images.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {categoryFilter === "unused"
                    ? "No unused images found"
                    : pathologyCategoryFilter === "uncategorized"
                      ? "No uncategorized images found"
                      : searchTerm || categoryFilter !== "all" || pathologyCategoryFilter !== "all"
                        ? "No images found matching your filters"
                        : "No images uploaded yet"}
                </TableCell>
              </TableRow>
            ) : (
              images.map((image) => {
                // Find the corresponding stats for this image
                const stats = imageStats.find((stat) => stat.id === image.id);

                // Get pathology category from the joined data
                const pathologyCategory = (image as unknown).pathology_category;

                // Get category color if available
                const categoryWithColor = image.pathology_category_id
                  ? getCategoryById(image.pathology_category_id)
                  : null;
                const categoryColor = categoryWithColor?.color;

                // Helper to convert HSL to light/dark variants
                const getCategoryBadgeStyle = (hslColor: string | undefined) => {
                  if (!hslColor) {
                    return {
                      light: "bg-gray-100 text-gray-800",
                      dark: "dark:bg-gray-900/50 dark:text-gray-300",
                    };
                  }

                  const hslMatch = hslColor.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
                  if (!hslMatch) {
                    return {
                      light: "bg-gray-100 text-gray-800",
                      dark: "dark:bg-gray-900/50 dark:text-gray-300",
                    };
                  }

                  const [, h, s, _l] = hslMatch;
                  return {
                    backgroundColor: `hsl(${h} ${Math.min(parseInt(s), 50)}% 90%)`,
                    color: `hsl(${h} ${s}% 20%)`,
                    darkBackgroundColor: `hsl(${h} ${Math.min(parseInt(s), 50)}% 20%)`,
                    darkColor: `hsl(${h} ${s}% 80%)`,
                  };
                };

                const badgeStyle = getCategoryBadgeStyle(categoryColor);

                return (
                  <TableRow key={image.id}>
                    <TableCell>
                      <ImagePreview src={image.url} alt={image.alt_text || "Image"} size="sm" />
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium line-clamp-1 flex-1">
                            {image.alt_text || "Untitled Image"}
                          </p>
                          {image.magnification && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                              · {image.magnification}
                            </span>
                          )}
                        </div>
                        {image.description && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {image.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(image.category as ImageCategory)}`}
                      >
                        {IMAGE_CATEGORIES[image.category as ImageCategory] || image.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      {pathologyCategory ? (
                        <span
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: badgeStyle.backgroundColor,
                            color: badgeStyle.color,
                          }}
                        >
                          {pathologyCategory.short_form || pathologyCategory.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Uncategorized</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {stats?.formatted_size || "Unknown"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {stats?.dimensions_text || "Unknown"}
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
        <TablePagination
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
