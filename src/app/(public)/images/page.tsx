// src/app/(public)/images/page.tsx
'use client'

import { useState, useCallback, useEffect } from 'react';
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Search, Loader2, ImageIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { fetchImages } from '@/features/images/services/images';
import { ImageData } from '@/features/images/types/images';
import FloatingCharacter from "@/shared/components/common/dr-albright";

type CategoryFilterType = 'all' | 'microscopic' | 'gross';

function TablePagination({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  totalItems 
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
}) {
  const pageSize = 20;
  const startItem = currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="text-sm text-muted-foreground">
        Showing {startItem}-{endItem} of {totalItems} images
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
        >
          Previous
        </Button>
        <div className="text-sm text-muted-foreground">
          Page {currentPage + 1} of {totalPages}
        </div>
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

export default function PublicImagesPage() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>('all');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  const pageSize = 20;

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchImages({
        page,
        pageSize,
        searchTerm,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        showUnusedOnly: false
      });

      if (result.error) {
        console.error('Failed to load images:', result.error);
        setImages([]);
        setTotalItems(0);
        setTotalPages(0);
      } else {
        // Filter to only include microscopic and gross images
        const filteredImages = result.data.filter(image =>
          image.category === 'microscopic' || image.category === 'gross'
        );
        setImages(filteredImages);
        setTotalItems(filteredImages.length);
        setTotalPages(Math.ceil(filteredImages.length / pageSize));
      }
    } catch (error) {
      console.error('Failed to load images:', error);
      setImages([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, categoryFilter]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(0); // Reset to first page when searching
  };

  const handleCategoryChange = (value: CategoryFilterType) => {
    setCategoryFilter(value);
    setPage(0); // Reset to first page when filtering
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px] opacity-[0.15]" />
        
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between gap-8">
            {/* Content */}
            <div className="flex-1 space-y-6 max-w-2xl">
              <h1 className="text-3xl md:text-5xl font-bold">
                Image Gallery
              </h1>
              <p className="text-lg text-muted-foreground">
                Explore our comprehensive collection of pathology images, including microscopic views
                and gross specimens. All images are available for educational purposes.
              </p>
            </div>

            {/* Character - hidden on mobile */}
            <div className="hidden md:block w-[350px]">
              <FloatingCharacter
                imagePath="/images/dr-albright.png"
                imageAlt="Dr. Albright Character"
                size={350}
                wrapperClassName="w-full flex justify-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 relative">
        <div className="container px-4 mx-auto">
          <div className="max-w-6xl mx-auto space-y-8">
            <Card className="p-8 shadow-lg">
              <div className="space-y-6">
                {/* Search and Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search images by name, description, or source..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Images</SelectItem>
                      <SelectItem value="microscopic">Microscopic</SelectItem>
                      <SelectItem value="gross">Gross</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Loading State */}
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading images...</span>
                  </div>
                )}

                {/* No Results */}
                {!loading && images.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground mb-2">No images found</h3>
                    <p className="text-sm text-muted-foreground">
                      {searchTerm || categoryFilter !== 'all' 
                        ? 'Try adjusting your search or filter criteria.'
                        : 'No images are available at this time.'
                      }
                    </p>
                  </div>
                )}

                {/* Images Grid */}
                {!loading && images.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {images.map((image) => (
                        <div key={image.id} className="space-y-2">
                          <div
                            className="relative cursor-pointer rounded-lg overflow-hidden bg-muted w-full aspect-square"
                            onClick={() => {
                              // Create a simple full-screen image viewer
                              const overlay = document.createElement('div');
                              overlay.className = 'fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4';
                              overlay.onclick = () => document.body.removeChild(overlay);

                              const img = document.createElement('img');
                              img.src = image.url;
                              img.alt = image.alt_text || image.description || 'Image';
                              img.className = 'max-w-full max-h-full object-contain';

                              overlay.appendChild(img);
                              document.body.appendChild(overlay);
                            }}
                          >
                            <img
                              src={image.url}
                              alt={image.alt_text || image.description || 'Image'}
                              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                            />
                          </div>
                          {image.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {image.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <TablePagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        totalItems={totalItems}
                      />
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Educational Use Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-primary/5" />
        <div className="container px-4 max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Educational Use</h2>
          <p className="text-xl text-muted-foreground mb-8">
            All images in our gallery are provided for educational purposes. These high-quality
            pathology images support learning and understanding of various medical conditions
            and diagnostic techniques.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Image Types</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Microscopic pathology images</li>
                <li>• Gross specimen photographs</li>
                <li>• High-resolution medical imagery</li>
                <li>• Diagnostic reference materials</li>
              </ul>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Usage Guidelines</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• For educational purposes only</li>
                <li>• High-resolution viewing available</li>
                <li>• Click any image for full-screen view</li>
                <li>• Organized by pathology type</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
