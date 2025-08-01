// src/app/(public)/tools/images/page.tsx
'use client'

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
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
import { PublicHero } from '@/shared/components/common/public-hero';
import { JoinCommunitySection } from '@/shared/components/common/join-community-section';

type CategoryFilterType = 'all' | 'microscopic' | 'gross';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
}

function TablePagination({ currentPage, totalPages, onPageChange, totalItems }: TablePaginationProps) {
  const startItem = (currentPage - 1) * 20 + 1;
  const endItem = Math.min(currentPage * 20, totalItems);

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex-1 text-sm text-muted-foreground">
        Showing {startItem} to {endItem} of {totalItems} images
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          <div className="flex items-center justify-center text-sm font-medium">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ImagesPage() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 20;

  // Debounce search term to prevent jittery behavior
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when search term or category changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, categoryFilter]);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchImages({
        page: page - 1, // Convert to 0-based for service
        pageSize,
        searchTerm: debouncedSearchTerm,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        showUnusedOnly: false,
        includeOnlyMicroscopicAndGross: categoryFilter === 'all'
      });

      if (result.error) {
        console.error('Failed to load images:', result.error);
        setImages([]);
        setTotalItems(0);
        setTotalPages(0);
      } else {
        setImages(result.data);
        setTotalItems(result.total);
        setTotalPages(Math.ceil(result.total / pageSize));
      }
    } catch (error) {
      console.error('Error loading images:', error);
      setImages([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearchTerm, categoryFilter]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, categoryFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadImages();
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Image Gallery"
        description="Explore our comprehensive collection of pathology images, including microscopic views and gross specimens. All images are available for educational purposes."
      />

      {/* Main Content */}
      <section className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="space-y-6">
                {/* Search and Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search images..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button type="submit" disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                    </Button>
                  </form>
                  
                  <Select value={categoryFilter} onValueChange={(value: CategoryFilterType) => setCategoryFilter(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="microscopic">Microscopic</SelectItem>
                      <SelectItem value="gross">Gross</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Loading State */}
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p className="text-muted-foreground">Loading images...</p>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!loading && images.length === 0 && (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">No images found</h3>
                      <p className="text-muted-foreground">
                        {searchTerm || categoryFilter !== 'all' 
                          ? 'Try adjusting your search or filter criteria.'
                          : 'No images are available at the moment.'
                        }
                      </p>
                    </div>
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
                              // Create a full-screen image viewer with blurry background like demo question
                              const overlay = document.createElement('div');
                              overlay.className = 'fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-8';
                              overlay.onclick = () => {
                                document.body.removeChild(overlay);
                                document.body.style.overflow = 'auto'; // Restore scrolling
                              };

                              // Prevent body scrolling when modal is open
                              document.body.style.overflow = 'hidden';

                              // Create image container with rounded corners like demo question
                              const imageContainer = document.createElement('div');
                              imageContainer.className = 'relative bg-white/5 rounded-2xl border border-white/10 shadow-2xl overflow-hidden';
                              imageContainer.onclick = (e) => e.stopPropagation(); // Prevent closing when clicking container

                              const img = document.createElement('img');
                              img.src = image.url;
                              img.alt = image.alt_text || image.description || 'Image';
                              img.className = 'max-w-[90vw] max-h-[90vh] object-contain';

                              imageContainer.appendChild(img);
                              overlay.appendChild(imageContainer);
                              document.body.appendChild(overlay);

                              // Add keyboard support
                              const handleKeyDown = (e: KeyboardEvent) => {
                                if (e.key === 'Escape') {
                                  document.body.removeChild(overlay);
                                  document.body.style.overflow = 'auto';
                                  document.removeEventListener('keydown', handleKeyDown);
                                }
                              };
                              document.addEventListener('keydown', handleKeyDown);
                            }}
                          >
                            <Image
                              src={image.url}
                              alt={image.alt_text || image.description || 'Image'}
                              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                              fill
                              unoptimized
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community Section */}
      <JoinCommunitySection />
    </div>
  );
}
