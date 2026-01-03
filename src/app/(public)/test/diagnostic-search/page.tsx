"use client";

import { useState } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Search, Loader2, AlertCircle, Info, Sparkles, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { DiagnosticContent } from "@/shared/components/features/diagnostic-content";
import { NCIEVSTester } from "@/shared/components/features/nci-evs-tester";

interface DisambiguationOption {
  topicName: string;
  lessonName: string;
  fileName: string;
  category: string;
  subcategory: string;
}

interface RelatedImage {
  id: string;
  url: string;
  description: string | null;
  alt_text: string | null;
  category: string;
  relevanceScore: number;
}

export default function DiagnosticSearchPage() {
  const [entity, setEntity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState<unknown>(null);
  const [matchInfo, setMatchInfo] = useState<unknown>(null);
  const [metadata, setMetadata] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [disambiguationOptions, setDisambiguationOptions] = useState<DisambiguationOption[] | null>(
    null
  );
  const [relatedImages, setRelatedImages] = useState<RelatedImage[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!entity.trim()) {
      setError("Please enter a diagnostic entity to search");
      return;
    }

    performSearch(entity.trim());
  };

  const performSearch = async (
    searchTerm: string,
    topicDetails?: { fileName: string; topicName: string; lessonName: string }
  ) => {
    setIsLoading(true);
    setError(null);
    setContent(null);
    setMatchInfo(null);
    setMetadata(null);
    setDisambiguationOptions(null);
    setRelatedImages([]);

    try {
      const requestBody = topicDetails
        ? { entity: searchTerm, ...topicDetails }
        : { entity: searchTerm };

      const response = await fetch("/api/public/tools/diagnostic-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      // Set related images if available
      if (data.related_images && data.related_images.length > 0) {
        setRelatedImages(data.related_images);
      }

      // Handle different response types
      if (data.type === "no_matches") {
        setError(data.message || "No matches found");
        setMetadata(data.metadata);
      } else if (data.type === "disambiguation_needed") {
        setDisambiguationOptions(data.options);
        setMetadata(data.metadata);
      } else if (data.type === "single_match") {
        // Use AI-parsed results if available, fall back to raw content
        setContent(data.results || data.content);
        setMatchInfo(data.match);
        setMetadata(data.metadata);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during search");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisambiguationSelect = (option: DisambiguationOption) => {
    performSearch(entity, {
      fileName: option.fileName,
      topicName: option.topicName,
      lessonName: option.lessonName,
    });
  };

  const handleClear = () => {
    setEntity("");
    setContent(null);
    setMatchInfo(null);
    setMetadata(null);
    setError(null);
    setDisambiguationOptions(null);
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Diagnostic Bites"
        description="Search for diagnostic entities and get instant access to comprehensive pathology information including clinical features, histologic findings, immunostains, differential diagnosis, and molecular findings."
        actions={
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <Sparkles className="h-4 w-4" />
            <span>Powered by optimized search index</span>
          </div>
        }
      />

      {/* Main Content */}
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* NCI EVS Tester */}
          <NCIEVSTester />

          {/* Search Form */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="entity">Diagnostic Entity</Label>
                  <div className="flex gap-2">
                    <Input
                      id="entity"
                      type="text"
                      placeholder="e.g., DLBCL, ductal carcinoma, melanoma"
                      value={entity}
                      onChange={(e) => setEntity(e.target.value)}
                      className="flex-1"
                      disabled={isLoading}
                    />
                    <Button type="submit" disabled={isLoading || !entity.trim()}>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      {isLoading ? "Searching..." : "Search"}
                    </Button>
                    {(content || error || disambiguationOptions) && (
                      <Button type="button" variant="outline" onClick={handleClear}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Loading State */}
          {isLoading && (
            <Card className="mb-8">
              <CardContent className="p-12">
                <div className="text-center space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Searching...</h3>
                    <p className="text-sm text-muted-foreground">Looking for "{entity}"</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Message */}
          {error && (
            <Card className="mb-8 border-destructive">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">No Results Found</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium mb-2">Suggestions:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Check spelling</li>
                    <li>Try using an abbreviation (e.g., DLBCL, CLL, AML)</li>
                    <li>Try a more general term</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disambiguation Options */}
          {disambiguationOptions && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Multiple Matches Found</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Please select the specific topic you're looking for:
                </p>
                <div className="space-y-2">
                  {disambiguationOptions.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleDisambiguationSelect(option)}
                      className="w-full p-4 text-left border rounded-lg hover:bg-accent hover:border-primary transition-colors"
                    >
                      <div className="font-medium">{option.topicName}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {option.category} → {option.subcategory} → {option.lessonName}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search Metadata */}
          {metadata && !isLoading && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Search Information</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Search Time:</span>
                    <p className="font-medium">{metadata.search_time_ms}ms</p>
                  </div>
                  {metadata.index_size && (
                    <div>
                      <span className="text-muted-foreground">Topics in Index:</span>
                      <p className="font-medium">{metadata.index_size}</p>
                    </div>
                  )}
                  {metadata.match_type && (
                    <div>
                      <span className="text-muted-foreground">Match Type:</span>
                      <p className="font-medium capitalize">
                        {metadata.match_type.replace("_", " ")}
                      </p>
                    </div>
                  )}
                </div>
                {matchInfo && (
                  <div className="mt-4 pt-4 border-t">
                    <span className="text-muted-foreground text-sm">Match:</span>
                    <p className="font-medium text-sm">
                      {matchInfo.category} → {matchInfo.subcategory}
                    </p>
                    <p className="font-medium text-sm">
                      {matchInfo.lesson} → {matchInfo.topic}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Related Images */}
          {relatedImages.length > 0 && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Related Images</h3>
                  <Badge variant="secondary" className="ml-auto">
                    {relatedImages.length} {relatedImages.length === 1 ? "image" : "images"}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {relatedImages.map((image) => (
                    <a
                      key={image.id}
                      href={image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative aspect-square rounded-lg overflow-hidden border hover:border-primary transition-colors"
                    >
                      <Image
                        src={image.url}
                        alt={image.alt_text || image.description || "Related pathology image"}
                        fill
                        unoptimized={true}
                        className="object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <Badge
                            variant="outline"
                            className="mb-2 bg-background/80 backdrop-blur-sm"
                          >
                            {image.category}
                          </Badge>
                          {(image.description || image.alt_text) && (
                            <p className="text-xs text-white line-clamp-2">
                              {image.description || image.alt_text}
                            </p>
                          )}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {content && <DiagnosticContent content={content} entity={entity} />}
        </div>
      </main>

      {/* Join Community Section */}
      <JoinCommunitySection />
    </div>
  );
}
