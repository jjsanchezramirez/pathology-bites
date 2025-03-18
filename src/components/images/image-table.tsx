"use client"

import { useState, useCallback, useEffect, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
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
import { EditImageDialog } from '@/components/images/edit-dialog';
import { UploadDialog } from './upload-dialog';
import { 
  ImageData, 
  ImageCategory, 
  IMAGE_CATEGORIES, 
  PAGE_SIZE 
} from '@/types/images';

// Table Header component with search and filters
function TableControls({
  onSearch,
  onCategoryChange,
  onUpload,
  categoryFilter,
}: {
  onSearch: (term: string) => void;
  onCategoryChange: (category: string) => void;
  onUpload: () => void;
  categoryFilter: string;
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
          onValueChange={onCategoryChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(IMAGE_CATEGORIES).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
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
  const [categoryFilter, setCategoryFilter] = useState<'all' | ImageCategory>('all');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize the supabase client so it's not recreated on every render.
  const supabase = useMemo(() => createClientComponentClient(), []);
  const { toast } = useToast();

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Count query
      const countQuery = supabase
        .from('images')
        .select('*', { count: 'exact', head: true });
      // Data query
      const dataQuery = supabase
        .from('images')
        .select('*');

      // Apply filters
      if (searchTerm) {
        countQuery.ilike('alt_text', `%${searchTerm}%`);
        dataQuery.ilike('alt_text', `%${searchTerm}%`);
      }
      if (categoryFilter !== 'all') {
        countQuery.eq('category', categoryFilter);
        dataQuery.eq('category', categoryFilter);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      const totalCount = count || 0;
      setTotalItems(totalCount);
      setTotalPages(Math.ceil(totalCount / PAGE_SIZE));

      const { data, error: dataError } = await dataQuery
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (dataError) throw dataError;

      setImages(data || []);
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
  }, [supabase, searchTerm, categoryFilter, page, toast]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleDelete = useCallback(async (image: ImageData) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    try {
      const { error: storageError } = await supabase.storage
        .from('images')
        .remove([image.storage_path]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('images')
        .delete()
        .eq('id', image.id);
      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Image deleted successfully",
      });
      loadImages();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete image';
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    }
  }, [supabase, toast, loadImages]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setPage(0);
  }, []);

  const handleCategoryChange = useCallback((category: typeof categoryFilter) => {
    setCategoryFilter(category);
    setPage(0);
  }, []);

  if (error) {
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
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="w-32">Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : images.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No images found
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
                  <TableCell className="max-w-xl">
                    <p className="line-clamp-2">{image.description}</p>
                  </TableCell>
                  <TableCell>
                    {IMAGE_CATEGORIES[image.category]}
                  </TableCell>
                  <TableCell>
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

      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={totalItems}
      />

      {/* Conditionally render the edit dialog */}
      {showEditDialog && (
        <EditImageDialog
          image={selectedImage}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSave={() => {
            loadImages();
            setShowEditDialog(false);
          }}
        />
      )}

      <UploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUpload={() => {
          loadImages();
          setShowUploadDialog(false);
        }}
      />
    </div>
  );
}