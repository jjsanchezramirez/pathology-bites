// src/components/images/images-table.tsx
"use client"

import { useState, useCallback, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Upload, MoreVertical, Edit, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImagePreview } from './image-preview';
import { EditImageDialog } from './edit-dialog';
import { UploadDialog } from './upload-dialog';
import { fetchImages, deleteImage } from '@/lib/images/images';
import { 
  ImageData, 
  ImageCategory, 
  IMAGE_CATEGORIES, 
  PAGE_SIZE 
} from '@/types/images';

// Define the valid category values type
type CategoryFilterType = 'all' | ImageCategory;

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
    <DropdownMenu>
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

export function ImagesTable() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>('all');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchImages({
        page,
        pageSize: PAGE_SIZE,
        searchTerm: searchTerm || undefined,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setImages(result.data);
      setTotalItems(result.total);
      setTotalPages(Math.ceil(result.total / PAGE_SIZE));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load images';
      setError(message);
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter, page, toast]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleDelete = useCallback(async (image: ImageData) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    
    try {
      await deleteImage(image.storage_path, image.id);
      
      toast({
        title: "Success",
        description: "Image deleted successfully",
      });
      
      // Remove the deleted image from the local state
      setImages(prev => prev.filter(img => img.id !== image.id));
      setTotalItems(prev => prev - 1);
      
      // If this was the last image on the current page and we're not on page 0,
      // go back one page
      if (images.length === 1 && page > 0) {
        setPage(prev => prev - 1);
      } else {
        // Otherwise, reload the current page
        loadImages();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete image';
      console.error('Delete error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    }
  }, [images.length, page, toast, loadImages]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setPage(0);
  }, []);

  const handleCategoryChange = useCallback((category: CategoryFilterType) => {
    setCategoryFilter(category);
    setPage(0);
  }, []);

  const handleEditSave = useCallback(() => {
    setShowEditDialog(false);
    setSelectedImage(null);
    loadImages();
  }, [loadImages]);

  const handleUploadComplete = useCallback(() => {
    setShowUploadDialog(false);
    setPage(0); // Go to first page to see newly uploaded images
    loadImages();
  }, [loadImages]);

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
              <TableHead>Alt Text</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="w-32">Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : images.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {searchTerm || categoryFilter !== 'all' 
                    ? 'No images found matching your filters' 
                    : 'No images uploaded yet'
                  }
                </TableCell>
              </TableRow>
            ) : (
              images.map((image) => (
                <TableRow key={image.id}>
                  <TableCell>
                    <ImagePreview
                      src={image.url}
                      alt={image.alt_text}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell className="max-w-48">
                    <p className="line-clamp-2 text-sm font-medium">{image.alt_text}</p>
                  </TableCell>
                  <TableCell className="max-w-xl">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {image.description || 'No description'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary">
                      {IMAGE_CATEGORIES[image.category as ImageCategory] || image.category}
                    </span>
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
              ))
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
      {showEditDialog && selectedImage && (
        <EditImageDialog
          image={selectedImage}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSave={handleEditSave}
        />
      )}

      <UploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUpload={handleUploadComplete}
      />
    </div>
  );
}