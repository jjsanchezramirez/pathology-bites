"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useClientVirtualSlidesEnhanced } from "@/shared/hooks/use-client-virtual-slides-enhanced";

// Helper to reverse the bases mapping from v7 format
function reverseMapping(map: Record<string, string> | undefined): Record<string, string> {
  if (!map) return {};
  const reversed: Record<string, string> = {};
  for (const [url, id] of Object.entries(map)) {
    reversed[id] = url;
  }
  return reversed;
}

// Helper to reconstruct URL from v7 format
function reconstructV7Url(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  urlRef: any,
  basesMap: Record<string, string> | undefined
): string | string[] {
  if (!urlRef || !basesMap) return "";

  // Handle array of URL refs
  if (Array.isArray(urlRef)) {
    return urlRef
      .map((ref) => {
        const baseId = Object.keys(ref)[0];
        const path = ref[baseId];
        const baseUrl = basesMap[baseId];
        return baseUrl && path ? baseUrl + path : "";
      })
      .filter(Boolean);
  }

  // Handle single URL ref (object with one key-value pair)
  const baseId = Object.keys(urlRef)[0];
  const path = urlRef[baseId];
  const baseUrl = basesMap[baseId];
  return baseUrl && path ? baseUrl + path : "";
}

// Type for cached data
interface CachedVirtualSlidesData {
  basesCase: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slides: any[];
}

export function VirtualSlideSearchTeaser() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // Use the same search hook as the virtual-slides page
  const searchClient = useClientVirtualSlidesEnhanced(1);

  // Cache the decompressed data
  const cachedDataRef = useRef<CachedVirtualSlidesData | null>(null);
  const prefetchingRef = useRef(false);

  // Prefetch and decompress data after component mounts
  useEffect(() => {
    const prefetchData = async () => {
      if (prefetchingRef.current || cachedDataRef.current) return;
      prefetchingRef.current = true;

      try {
        const { VIRTUAL_SLIDES_JSON_URL } = await import("@/shared/config/virtual-slides");

        // Wait a bit for hero images to load first
        await new Promise((resolve) => setTimeout(resolve, 2000));

        console.log("[VirtualSlideSearchTeaser] Prefetching virtual slides data...");

        const response = await fetch(VIRTUAL_SLIDES_JSON_URL, {
          cache: "force-cache",
          priority: "low",
        } as RequestInit);

        if (!response.ok) throw new Error("Failed to prefetch slides");

        // Decompress gzipped data
        if (typeof DecompressionStream !== "undefined" && response.body) {
          const decompressedStream = response.body.pipeThrough(new DecompressionStream("gzip"));
          const decompressedResponse = new Response(decompressedStream);
          const json = await decompressedResponse.json();

          // Cache the processed data
          cachedDataRef.current = {
            basesCase: reverseMapping(json.bases?.case),
            slides: json.data ?? [],
          };

          console.log(
            `[VirtualSlideSearchTeaser] ✅ Prefetched ${cachedDataRef.current.slides.length} slides`
          );
        }
      } catch (error) {
        console.error("[VirtualSlideSearchTeaser] Prefetch failed:", error);
      } finally {
        prefetchingRef.current = false;
      }
    };

    prefetchData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/tools/virtual-slides?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/tools/virtual-slides");
    }
  };

  const handleFeelingLucky = async (e?: React.MouseEvent) => {
    // Prevent form submission
    e?.preventDefault();

    const query = searchQuery.trim();
    if (!query) {
      // If no search query, do nothing
      return;
    }

    try {
      // Helper function to check if a URL is a valid WSI viewer (not a raw image file)
      const isValidWSIUrl = (url: string): boolean => {
        if (!url) return false;
        // Exclude raw image formats that aren't interactive viewers
        const invalidExtensions = [".dzi", ".svs", ".tif", ".tiff", ".jpg", ".jpeg", ".png"];
        const urlLower = url.toLowerCase();
        return !invalidExtensions.some((ext) => urlLower.endsWith(ext));
      };

      // Perform search using the search hook - get multiple results to find valid URL
      await searchClient.searchWithFilters({ query, page: 1, limit: 10 });

      // Wait a tick for React state to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log(`[I'm Feeling Lucky] Search completed, slides:`, searchClient.slides.length);

      // Find first slide with a valid WSI viewer URL
      let validSlide = null;
      let validUrl = null;

      for (const slide of searchClient.slides) {
        // Check slide_url first (primary viewer URL)
        if (slide.slide_url && isValidWSIUrl(slide.slide_url)) {
          validSlide = slide;
          validUrl = slide.slide_url;
          break;
        }
        // Check case_url as fallback
        if (slide.case_url && isValidWSIUrl(slide.case_url)) {
          validSlide = slide;
          validUrl = slide.case_url;
          break;
        }
        // Check other_urls if available
        if (slide.other_urls && slide.other_urls.length > 0) {
          for (const url of slide.other_urls) {
            if (isValidWSIUrl(url)) {
              validSlide = slide;
              validUrl = url;
              break;
            }
          }
          if (validUrl) break;
        }
      }

      if (validSlide && validUrl) {
        console.log(`[I'm Feeling Lucky] First valid match:`, {
          diagnosis: validSlide.diagnosis,
          url: validUrl,
        });

        // Open in new window
        console.log(`[I'm Feeling Lucky] Opening slide in new window:`, validUrl);
        window.open(validUrl, "_blank", "noopener,noreferrer");
      } else {
        // No valid match found, open search page
        console.log(`[I'm Feeling Lucky] No valid viewer URL found for: "${query}"`);
        window.open(
          `/tools/virtual-slides?search=${encodeURIComponent(query)}`,
          "_blank",
          "noopener,noreferrer"
        );
      }
    } catch (error) {
      console.error("Feeling lucky failed:", error);
      // On error, open search page in new tab
      window.open(
        `/tools/virtual-slides?search=${encodeURIComponent(query)}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const handleRandomSlide = async (e?: React.MouseEvent) => {
    // Prevent form submission
    e?.preventDefault();

    try {
      // Use cached data if available
      let basesCase: Record<string, string>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let slides: any[];

      if (cachedDataRef.current) {
        // Use prefetched cached data (instant!)
        basesCase = cachedDataRef.current.basesCase;
        slides = cachedDataRef.current.slides;
      } else {
        // Fallback: fetch and decompress on demand
        const { VIRTUAL_SLIDES_JSON_URL } = await import("@/shared/config/virtual-slides");

        const response = await fetch(VIRTUAL_SLIDES_JSON_URL, {
          cache: "force-cache",
        });

        if (!response.ok) throw new Error("Failed to fetch slides");

        // Decompress gzipped data
        let json;
        if (typeof DecompressionStream !== "undefined" && response.body) {
          const decompressedStream = response.body.pipeThrough(new DecompressionStream("gzip"));
          const decompressedResponse = new Response(decompressedStream);
          json = await decompressedResponse.json();
        } else {
          throw new Error("DecompressionStream not supported");
        }

        basesCase = reverseMapping(json.bases?.case);
        slides = json.data ?? [];
      }

      // Helper function to check if a URL is a valid WSI viewer (not a raw image file)
      const isValidWSIUrl = (url: string): boolean => {
        if (!url) return false;
        // Exclude raw image formats that aren't interactive viewers
        const invalidExtensions = [".dzi", ".svs", ".tif", ".tiff", ".jpg", ".jpeg", ".png"];
        const urlLower = url.toLowerCase();
        return !invalidExtensions.some((ext) => urlLower.endsWith(ext));
      };

      if (slides.length > 0) {
        // Filter slides to only those with valid WSI viewer URLs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const validSlides = slides.filter((slide: any) => {
          if (!slide.u) return false;

          let slideUrl: string;
          if (Array.isArray(slide.u)) {
            const reconstructed = reconstructV7Url(slide.u, basesCase);
            slideUrl = Array.isArray(reconstructed) ? reconstructed[0] || "" : reconstructed;
          } else {
            slideUrl = reconstructV7Url(slide.u, basesCase) as string;
          }

          return isValidWSIUrl(slideUrl);
        });

        if (validSlides.length > 0) {
          // Pick a random slide from valid slides
          const randomSlide = validSlides[Math.floor(Math.random() * validSlides.length)];

          if (randomSlide.u) {
            // Reconstruct the slide URL
            let slideUrl: string;

            if (Array.isArray(randomSlide.u)) {
              // If it's an array, get the first URL
              const reconstructed = reconstructV7Url(randomSlide.u, basesCase);
              slideUrl = Array.isArray(reconstructed) ? reconstructed[0] || "" : reconstructed;
            } else {
              // Single URL reference
              slideUrl = reconstructV7Url(randomSlide.u, basesCase) as string;
            }

            if (slideUrl) {
              // Open in new window
              window.open(slideUrl, "_blank", "noopener,noreferrer");
            }
          }
        } else {
          console.warn("[Random Slide] No valid WSI viewer URLs found");
        }
      }
    } catch (error) {
      console.error("Random slide failed:", error);
      // On error, do nothing
    }
  };

  return (
    <div className="max-w-2xl mx-auto lg:mx-0">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-6 w-6 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 25,000+ virtual slides..."
            className="w-full pl-14 pr-28 py-5 rounded-xl border-2 border-input bg-background/50 backdrop-blur-sm text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all hover:bg-background shadow-lg hover:shadow-xl"
          />
          <Button
            type="submit"
            size="lg"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-primary hover:bg-primary/90 px-6 sm:px-8"
          >
            Search
          </Button>
        </div>

        {/* Google-style button row */}
        <div className="flex gap-3 justify-center lg:justify-start">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleRandomSlide}
            className="px-6 transition-all hover:scale-105 hover:shadow-md"
          >
            Visit Random Slide
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleFeelingLucky}
            className="px-6 transition-all hover:scale-105 hover:shadow-md"
          >
            I'm Feeling Lucky
          </Button>
        </div>
      </form>
    </div>
  );
}
