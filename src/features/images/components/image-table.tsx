// src/components/images/images-table.tsx
"use client"

import { useState, useCallback, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { toast } from 'sonner';
import { Search, Loader2, Upload, MoreVertical, Edit, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
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
import { ImagePreview } from './image-preview';
import { EditImageDialog } from './edit-dialog';
import { UploadDialog } from './upload-dialog';
import { DeleteImageDialog } from './delete-image-dialog';
import { fetchImages, deleteImage } from '@/features/images/services/images';
import { getImageUsageStats, getStorageStats, ImageUsageStats } from '@/features/images/services/image-analytics';
import { formatSize } from '@/features/images/services/image-upload';
import {
  ImageData,
  ImageCategory,
  IMAGE_CATEGORIES,
  PAGE_SIZE
} from '@/features/images/types/images';

// Define the valid category values type
type CategoryFilterType = 'all' | 'unused' | ImageCategory;

// Category color configurations
const getCategoryColor = (category: ImageCategory): string => {
  switch (category) {
    case 'microscopic':
      return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    case 'gross':
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
    case 'figure':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
    case 'table':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300';
    default:
      return 'bg-secondary text-secondary-foreground';
  }
};

// Table Header component with search and filters
function TableControls({
  onSearch,
  onCategoryChange,
  onUpload,
  categoryFilter,
}: {
  onSearch: (term: string) => void;
  onCategoryChange: (category: CategoryFilterType) => void;
  onUpload: () => void;
  categoryFilter: CategoryFilterType;
}) {
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
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="unused">Unused Images</SelectItem>
            <SelectItem value="microscopic">Microscopic</SelectItem>
            <SelectItem value="figure">Figure</SelectItem>
            <SelectItem value="table">Table</SelectItem>
            <SelectItem value="gross">Gross</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={onUpload}
        className="bg-primary hover:bg-primary/90"
      >
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
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
}) {
  return (
    <div className="flex justify-between items-center">
      <p className="text-sm text-muted-foreground">
        Showing {totalItems > 0 ? currentPage * PAGE_SIZE + 1 : 0} to{" "}
        {Math.min((currentPage + 1) * PAGE_SIZE, totalItems)} of{" "}
        {totalItems} images
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
        >
          Previous
        </Button>
        <Button
          variant="outline"
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
  onDelete
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
        <DropdownMenuItem
          className="text-red-600"
          onClick={() => onDelete(image)}
        >
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
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>('all');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<ImageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    console.log('loadImages function called');
    setLoading(true);
    setError(null);
    try {
      // Load both regular images and analytics data
      const [result, statsData] = await Promise.all([
        fetchImages({
          page,
          pageSize: PAGE_SIZE,
          searchTerm: searchTerm || undefined,
          category: categoryFilter === 'all' || categoryFilter === 'unused' ? undefined : categoryFilter,
          showUnusedOnly: categoryFilter === 'unused',
        }),
        getImageUsageStats()
      ]);

      if (result.error) {
        throw new Error(result.error);
      }

      setImages(result.data);
      setImageStats(statsData);
      setTotalItems(result.total);
      setTotalPages(Math.ceil(result.total / PAGE_SIZE));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load images';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter, page]);

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
      setImages(prev => prev.filter(img => img.id !== imageToDelete.id));
      setTotalItems(prev => prev - 1);

      // Refresh storage stats
      onImageChange?.();

      // If this was the last image on the current page and we're not on page 0,
      // go back one page
      if (images.length === 1 && page > 0) {
        setPage(prev => prev - 1);
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
  }, []);

  const handleEditSave = useCallback(() => {
    console.log('handleEditSave called - refreshing table');
    // Just refresh the table, dialog closing is handled separately
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
        onUpload={() => setShowUploadDialog(true)}
        categoryFilter={categoryFilter}
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-24">Preview</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="w-24">Size</TableHead>
              <TableHead className="w-28">Dimensions</TableHead>
              <TableHead className="w-20">Usage</TableHead>
              <TableHead className="w-32">Uploaded</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : images.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  {categoryFilter === 'unused'
                    ? 'No unused images found'
                    : searchTerm || categoryFilter !== 'all'
                    ? 'No images found matching your filters'
                    : 'No images uploaded yet'
                  }
                </TableCell>
              </TableRow>
            ) : (
              images.map((image) => {
                // Find the corresponding stats for this image
                const stats = imageStats.find(stat => stat.id === image.id);

                return (
                  <TableRow key={image.id}>
                    <TableCell>
                      <ImagePreview
                        src={image.url}
                        alt={image.alt_text || 'Image'}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="max-w-48">
                      <p className="line-clamp-2 text-sm font-medium">{image.alt_text || 'Untitled Image'}</p>
                    </TableCell>
                    <TableCell className="max-w-xl">
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {image.description || 'No description'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(image.category as ImageCategory)}`}>
                        {IMAGE_CATEGORIES[image.category as ImageCategory] || image.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {stats?.formatted_size || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {stats?.dimensions_text || 'Unknown'}
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
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(image.created_at).toLocaleDateString()}
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

      {totalPages > 1 && (
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalItems}
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