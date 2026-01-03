"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Loader2, ChevronDown, ChevronUp, Search, ExternalLink } from "lucide-react";

interface NCIEVSResult {
  code: string;
  name: string;
  terminology: string;
  version: string;
  synonyms?: Array<{
    name: string;
    type: string;
    source?: string;
  }>;
  definitions?: Array<{
    definition: string;
    source?: string;
  }>;
  properties?: Array<{
    type: string;
    value: string;
  }>;
  relevanceScore?: number;
  semanticTypes?: string[];
  matchReason?: string;
}

// Semantic type color mapping
const SEMANTIC_TYPE_COLORS: { [key: string]: string } = {
  "Neoplastic Process": "destructive",
  "Disease or Syndrome": "default",
  Finding: "secondary",
  "Pathologic Function": "default",
  "Anatomical Abnormality": "outline",
};

export function NCIEVSTester() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"neoplasms" | "diseases" | "pathology" | "all">(
    "pathology"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<NCIEVSResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<unknown>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchTerm.trim()) {
      setError("Please enter a search term");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setMetadata(null);

    try {
      // Call our proxy API route with filtering
      const response = await fetch("/api/public/tools/nci-evs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          term: searchTerm,
          filterType: filterType,
          maxResults: 10,
          include: "synonyms,definitions,properties",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Search failed");
      }

      setResults(data.concepts || []);
      setMetadata({
        total: data.total || 0,
        filteredTotal: data.filtered_total || 0,
        returnedCount: data.returned_count || 0,
        searchTime: data.metadata?.search_time_ms || 0,
        filterType: data.metadata?.filter_type || "pathology",
        terminology: data.metadata?.terminology || "ncit",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mb-8 border-2 border-dashed border-primary/30">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">🧪 NCI EVS API Tester</CardTitle>
            <Badge variant="outline" className="text-xs">
              Development Tool
            </Badge>
          </div>
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Info Banner */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-md text-sm">
            <p className="font-medium mb-1">🔬 About NCI EVS</p>
            <p className="text-muted-foreground">
              Search the NCI Thesaurus to find official medical terminology, synonyms, and
              definitions. Results are filtered and ranked by relevance to pathology terms.
            </p>
          </div>

          {/* Filter Controls */}
          <div className="space-y-2">
            <Label>Filter Type</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={filterType === "neoplasms" ? "default" : "outline"}
                onClick={() => setFilterType("neoplasms")}
              >
                Neoplasms Only
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filterType === "diseases" ? "default" : "outline"}
                onClick={() => setFilterType("diseases")}
              >
                Diseases & Neoplasms
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filterType === "pathology" ? "default" : "outline"}
                onClick={() => setFilterType("pathology")}
              >
                All Pathology Terms
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filterType === "all" ? "default" : "outline"}
                onClick={() => setFilterType("all")}
              >
                All Results (Unfiltered)
              </Button>
            </div>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nci-search">Search NCI Thesaurus</Label>
              <div className="flex gap-2">
                <Input
                  id="nci-search"
                  type="text"
                  placeholder="e.g., melanoma, carcinoma, DCIS"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !searchTerm.trim()}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {isLoading ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>
          </form>

          {/* Metadata */}
          {metadata && (
            <div className="p-3 bg-muted rounded-md text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <span className="text-muted-foreground">Total Found:</span>
                  <span className="ml-2 font-medium">{metadata.total}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">After Filter:</span>
                  <span className="ml-2 font-medium">{metadata.filteredTotal}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Showing:</span>
                  <span className="ml-2 font-medium">{metadata.returnedCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Time:</span>
                  <span className="ml-2 font-medium">{metadata.searchTime}ms</span>
                </div>
              </div>
              {metadata.filteredTotal < metadata.total && (
                <p className="mt-2 text-xs text-muted-foreground">
                  ℹ️ Filtered out {metadata.total - metadata.filteredTotal} non-pathology terms
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded-md text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {results.map((result, index) => (
                <Card key={index} className="border-l-4 border-l-primary">
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold">{result.name}</h4>
                          <a
                            href={`https://ncit.nci.nih.gov/ncitbrowser/ConceptReport.jsp?dictionary=NCI_Thesaurus&code=${result.code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80"
                            title="View in NCI Thesaurus Browser"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          {result.relevanceScore !== undefined && (
                            <Badge variant="outline" className="text-xs">
                              Score: {result.relevanceScore}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">Code: {result.code}</p>
                        {result.matchReason && (
                          <p className="text-xs text-primary mt-1">✓ {result.matchReason}</p>
                        )}
                      </div>
                      <Badge variant="secondary">{result.terminology}</Badge>
                    </div>

                    {/* Semantic Types */}
                    {result.semanticTypes && result.semanticTypes.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Type:</p>
                        <div className="flex flex-wrap gap-1">
                          {result.semanticTypes.map((type, i) => (
                            <Badge
                              key={i}
                              variant={(SEMANTIC_TYPE_COLORS[type] as unknown) || "outline"}
                              className="text-xs"
                            >
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Definitions */}
                    {result.definitions && result.definitions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Definition:
                        </p>
                        <p className="text-sm">{result.definitions[0].definition}</p>
                      </div>
                    )}

                    {/* Synonyms */}
                    {result.synonyms && result.synonyms.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Synonyms ({result.synonyms.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {result.synonyms.slice(0, 8).map((syn, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {syn.name}
                            </Badge>
                          ))}
                          {result.synonyms.length > 8 && (
                            <Badge variant="outline" className="text-xs">
                              +{result.synonyms.length - 8} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
