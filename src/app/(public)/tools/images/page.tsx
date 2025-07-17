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
import FloatingCharacter from "@/shared/components/common/dr-albright";
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
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>('all');
  const [page, setPage] = useState(1);
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
      console.error('Error loading images:', error);
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
                            <Image
                              src={image.url}
                              alt={image.alt_text || image.description || 'Image'}
                              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                              fill
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

      {/* Join Our Learning Community Section */}
      <JoinCommunitySection />
    </div>
  );
}
