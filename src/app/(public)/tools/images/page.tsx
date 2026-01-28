// src/app/(public)/tools/images/page.tsx
"use client";

import { useState, useCallback, useEffect, useRef, memo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Search, ImageIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { fetchImages } from "@/features/images/services/images";
import { ImageData } from "@/features/images/types/images";
import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { ImageViewerModal } from "@/shared/components/ui/image-viewer-modal";
import { ImageGridSkeleton } from "@/features/tools/images/components/image-grid-skeleton";

type CategoryFilterType = "all" | "microscopic" | "gross";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
}

const TablePagination = memo(function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
}: TablePaginationProps) {
  const pageSize = 20;
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

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
});

function ImagesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);

  // Use refs instead of state to avoid triggering re-renders
  const cachedCountRef = useRef<number | null>(null);
  const previousFiltersRef = useRef<{ search: string; category: CategoryFilterType }>({
    search: "",
    category: "all",
  });

  const pageSize = 20;

  // Process URL parameters on mount
  useEffect(() => {
    if (!urlParamsProcessed) {
      const searchQuery = searchParams.get("search");
      const categoryQuery = searchParams.get("category") as CategoryFilterType | null;
      const pageQuery = searchParams.get("page");

      if (searchQuery) {
        setSearchTerm(searchQuery);
        setDebouncedSearchTerm(searchQuery);
      }

      if (categoryQuery && ["all", "microscopic", "gross"].includes(categoryQuery)) {
        setCategoryFilter(categoryQuery);
      }

      if (pageQuery) {
        const pageNum = parseInt(pageQuery, 10);
        if (!isNaN(pageNum) && pageNum > 0) {
          setPage(pageNum);
        }
      }

      setUrlParamsProcessed(true);
    }
  }, [searchParams, urlParamsProcessed]);

  // Update URL when filters change
  useEffect(() => {
    if (!urlParamsProcessed) return;

    const params = new URLSearchParams();
    if (debouncedSearchTerm) params.set("search", debouncedSearchTerm);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (page > 1) params.set("page", page.toString());

    const queryString = params.toString();
    const newUrl = queryString ? `/tools/images?${queryString}` : "/tools/images";

    // Only update if URL actually changed
    if (window.location.pathname + window.location.search !== newUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [debouncedSearchTerm, categoryFilter, page, router, urlParamsProcessed]);

  // Debounce search term - increased to 500ms to reduce Supabase queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when search term or category changes (but not when page changes)
  useEffect(() => {
    if (urlParamsProcessed) {
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, categoryFilter]);

  // Load images when page, search, or category changes
  useEffect(() => {
    if (!urlParamsProcessed) return;

    const loadImages = async () => {
      setLoading(true);
      try {
        // Check if filters changed (search or category) using refs
        const filtersChanged =
          previousFiltersRef.current.search !== debouncedSearchTerm ||
          previousFiltersRef.current.category !== categoryFilter;

        // Only fetch count if filters changed
        const skipCount = !filtersChanged && cachedCountRef.current !== null;

        const result = await fetchImages({
          page: page - 1, // Convert to 0-based for service
          pageSize,
          searchTerm: debouncedSearchTerm,
          category: categoryFilter === "all" ? undefined : categoryFilter,
          showUnusedOnly: false,
          includeOnlyMicroscopicAndGross: categoryFilter === "all",
          skipCount,
        });

        if (result.error) {
          console.error("Failed to load images:", result.error);
          setImages([]);
          setTotalItems(0);
          setTotalPages(0);
          cachedCountRef.current = null;
        } else {
          // Use cached count if available, otherwise use fresh count
          const total = result.total !== null ? result.total : cachedCountRef.current || 0;

          // Batch state updates to reduce re-renders
          setImages(result.data);
          setTotalItems(total);
          setTotalPages(Math.ceil(total / pageSize));

          // Cache the count if we got a fresh one (using ref to avoid re-render)
          if (result.total !== null) {
            cachedCountRef.current = result.total;
            previousFiltersRef.current = {
              search: debouncedSearchTerm,
              category: categoryFilter,
            };
          }
        }
      } catch (error) {
        console.error("Error loading images:", error);
        setImages([]);
        setTotalItems(0);
        setTotalPages(0);
        cachedCountRef.current = null;
      } finally {
        setLoading(false);
      }
    };

    loadImages();
    // Removed cachedCount and previousFilters from dependencies to prevent circular updates
  }, [page, debouncedSearchTerm, categoryFilter, urlParamsProcessed]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // Debounce handles the actual search
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

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
                  </form>

                  <Select
                    value={categoryFilter}
                    onValueChange={(value: CategoryFilterType) => setCategoryFilter(value)}
                  >
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

                {/* Loading State with Skeleton */}
                {loading && <ImageGridSkeleton />}

                {/* Empty State */}
                {!loading && images.length === 0 && (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">No images found</h3>
                      <p className="text-muted-foreground">
                        {searchTerm || categoryFilter !== "all"
                          ? "Try adjusting your search or filter criteria."
                          : "No images are available at the moment."}
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
                            className="relative cursor-pointer rounded-lg overflow-hidden bg-muted w-full aspect-square group"
                            onClick={() => setSelectedImage(image)}
                          >
                            <Image
                              src={image.url}
                              alt={image.alt_text || image.description || "Image"}
                              className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                              fill
                              unoptimized
                              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
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
                        onPageChange={handlePageChange}
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

      {/* Image Viewer Modal */}
      {selectedImage && (
        <ImageViewerModal
          src={selectedImage.url}
          alt={selectedImage.alt_text || selectedImage.description || "Image"}
          description={selectedImage.description || undefined}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}

export default function ImagesPage() {
  return (
    <Suspense fallback={<ImageGridSkeleton />}>
      <ImagesPageContent />
    </Suspense>
  );
}
