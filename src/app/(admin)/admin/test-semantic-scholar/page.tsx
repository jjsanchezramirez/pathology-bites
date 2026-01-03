"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Loader2, Search, ExternalLink, BookOpen } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";

interface Paper {
  paperId: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  journal: string;
  publicationDate: string;
  citationCount: number;
  influentialCitationCount: number;
  abstract: string;
  isOpenAccess: boolean;
  openAccessPdf: string | null;
  publicationTypes: string[];
  url: string;
}

export default function SemanticScholarTestPage() {
  const [query, setQuery] = useState("colorectal adenocarcinoma");
  const [limit, setLimit] = useState("20");
  const [sortBy, setSortBy] = useState("citations");
  const [minCitations, setMinCitations] = useState("0");
  const [onlyOpenAccess, setOnlyOpenAccess] = useState(false);
  const [onlyReviews, setOnlyReviews] = useState(false);
  const [yearRange, setYearRange] = useState("all");
  const [venue, setVenue] = useState("pathology-journals");
  const [publicationType, setPublicationType] = useState("all");
  const [minInfluentialCitations, setMinInfluentialCitations] = useState("0");

  const [results, setResults] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [apiUrl, setApiUrl] = useState("");

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const params = new URLSearchParams({
        query,
        limit,
        sortBy,
        minCitations,
        onlyOpenAccess: onlyOpenAccess.toString(),
        onlyReviews: onlyReviews.toString(),
        yearRange,
        venue: venue === "all" ? "" : venue,
        publicationType: publicationType === "all" ? "" : publicationType,
      });

      const apiUrlBuilt = `/api/admin/fetch-references?${params.toString()}`;
      setApiUrl(apiUrlBuilt);

      const response = await fetch(apiUrlBuilt);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Apply client-side influential citation filter
      let filteredPapers = data.papers || [];
      const minInfluential = parseInt(minInfluentialCitations);
      if (minInfluential > 0) {
        filteredPapers = filteredPapers.filter(
          (paper: Paper) => (paper.influentialCitationCount || 0) >= minInfluential
        );
      }

      setResults(filteredPapers);
      setTotalResults(filteredPapers.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch results");
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Semantic Scholar API Test</h1>
        <p className="text-muted-foreground">
          Test and tweak Semantic Scholar API parameters to find the best journal recommendations
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">Query: {query}</Badge>
          <Badge variant="outline">Limit: {limit}</Badge>
          <Badge variant="outline">Sort: {sortBy}</Badge>
          <Badge variant="outline">
            Year:{" "}
            {yearRange === "all" ? "All" : yearRange === "last5" ? "Last 5 years" : "Last 10 years"}
          </Badge>
          <Badge variant="outline">Venue: {venue === "all" ? "All" : "Pathology only"}</Badge>
          {minCitations !== "0" && <Badge variant="secondary">Min citations: {minCitations}</Badge>}
          {minInfluentialCitations !== "0" && (
            <Badge variant="secondary">Min influential: {minInfluentialCitations}</Badge>
          )}
          {onlyOpenAccess && (
            <Badge className="bg-green-100 text-green-800">Open Access only</Badge>
          )}
          {onlyReviews && <Badge className="bg-purple-100 text-purple-800">Reviews only</Badge>}
          {publicationType !== "all" && <Badge variant="secondary">Type: {publicationType}</Badge>}
        </div>
      </div>

      {/* Search Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Parameters</CardTitle>
          <CardDescription>Configure API request parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Query */}
          <div className="space-y-2">
            <Label htmlFor="query">Search Query</Label>
            <Input
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter search terms..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
          </div>

          {/* Two column grid for parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Limit */}
            <div className="space-y-2">
              <Label htmlFor="limit">Result Limit</Label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger id="limit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 results</SelectItem>
                  <SelectItem value="10">10 results</SelectItem>
                  <SelectItem value="20">20 results</SelectItem>
                  <SelectItem value="50">50 results</SelectItem>
                  <SelectItem value="100">100 results</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="space-y-2">
              <Label htmlFor="sortBy">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger id="sortBy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="citations">Citation Count (High to Low)</SelectItem>
                  <SelectItem value="year-desc">Year (Newest First)</SelectItem>
                  <SelectItem value="year-asc">Year (Oldest First)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Year Range */}
            <div className="space-y-2">
              <Label htmlFor="yearRange">Year Range</Label>
              <Select value={yearRange} onValueChange={setYearRange}>
                <SelectTrigger id="yearRange">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="last5">Last 5 Years</SelectItem>
                  <SelectItem value="last10">Last 10 Years</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Min Citations */}
            <div className="space-y-2">
              <Label htmlFor="minCitations">Minimum Citations</Label>
              <Input
                id="minCitations"
                type="number"
                value={minCitations}
                onChange={(e) => setMinCitations(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>

            {/* Min Influential Citations */}
            <div className="space-y-2">
              <Label htmlFor="minInfluentialCitations">Minimum Influential Citations</Label>
              <Input
                id="minInfluentialCitations"
                type="number"
                value={minInfluentialCitations}
                onChange={(e) => setMinInfluentialCitations(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>

            {/* Venue Filter */}
            <div className="space-y-2">
              <Label htmlFor="venue">Venue Filter</Label>
              <Select value={venue} onValueChange={setVenue}>
                <SelectTrigger id="venue">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Venues</SelectItem>
                  <SelectItem value="pathology-journals">Pathology Journals Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Publication Type */}
            <div className="space-y-2">
              <Label htmlFor="publicationType">Publication Type</Label>
              <Select value={publicationType} onValueChange={setPublicationType}>
                <SelectTrigger id="publicationType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Review">Review</SelectItem>
                  <SelectItem value="JournalArticle">Journal Article</SelectItem>
                  <SelectItem value="Conference">Conference</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="onlyOpenAccess"
                checked={onlyOpenAccess}
                onCheckedChange={(checked) => setOnlyOpenAccess(checked === true)}
              />
              <Label htmlFor="onlyOpenAccess" className="font-normal cursor-pointer">
                Only Open Access Papers
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="onlyReviews"
                checked={onlyReviews}
                onCheckedChange={(checked) => setOnlyReviews(checked === true)}
              />
              <Label htmlFor="onlyReviews" className="font-normal cursor-pointer">
                Only Review Articles
              </Label>
            </div>
          </div>

          {/* Search Button */}
          <Button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search Semantic Scholar
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* API URL Display */}
      {apiUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-mono">API Request</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">{apiUrl}</code>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Results ({totalResults})</CardTitle>
            <CardDescription>
              Found {totalResults} paper{totalResults !== 1 ? "s" : ""} matching your criteria
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((paper) => (
              <div
                key={paper.paperId}
                className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
              >
                {/* Title and Link */}
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-semibold text-lg leading-tight flex-1">{paper.title}</h3>
                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>

                {/* Authors */}
                <p className="text-sm text-muted-foreground">
                  {paper.authors.slice(0, 5).join(", ")}
                  {paper.authors.length > 5 && ` et al.`}
                </p>

                {/* Metadata Row */}
                <div className="flex flex-wrap gap-2 items-center">
                  {paper.year && <Badge variant="secondary">{paper.year}</Badge>}
                  {paper.journal && (
                    <Badge variant="outline" className="font-normal">
                      <BookOpen className="h-3 w-3 mr-1" />
                      {paper.journal}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {paper.citationCount} citation{paper.citationCount !== 1 ? "s" : ""}
                  </Badge>
                  {paper.influentialCitationCount > 0 && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {paper.influentialCitationCount} influential
                    </Badge>
                  )}
                  {paper.isOpenAccess && (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      Open Access
                    </Badge>
                  )}
                  {paper.publicationTypes.map((type) => (
                    <Badge
                      key={type}
                      variant="outline"
                      className="bg-purple-50 text-purple-700 border-purple-200"
                    >
                      {type}
                    </Badge>
                  ))}
                </div>

                {/* Abstract */}
                {paper.abstract && (
                  <p className="text-sm text-muted-foreground line-clamp-3">{paper.abstract}</p>
                )}

                {/* Open Access PDF Link */}
                {paper.openAccessPdf && (
                  <a
                    href={paper.openAccessPdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View PDF <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {!loading && results.length === 0 && !error && query && totalResults === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              No results found. Try adjusting your search parameters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
