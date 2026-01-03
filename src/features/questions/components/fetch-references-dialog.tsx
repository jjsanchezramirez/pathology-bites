'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Loader2, Search, ExternalLink } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'

interface Paper {
  paperId: string
  title: string
  authors: string[]
  year: number
  venue: string
  journal: string
  citationCount: number
  isOpenAccess: boolean
  url: string
}

interface FetchReferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  searchQuery: string
  onReferencesSelected: (references: string[]) => void
}

export function FetchReferencesDialog({
  open,
  onOpenChange,
  searchQuery,
  onReferencesSelected,
}: FetchReferencesDialogProps) {
  const [query, setQuery] = useState(searchQuery)
  const [sortBy, setSortBy] = useState('relevance')
  const [yearRange, setYearRange] = useState('all')
  const [venue, setVenue] = useState('all')
  const [publicationType, setPublicationType] = useState('all')
  const [onlyOpenAccess, setOnlyOpenAccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Paper[]>([])
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setResults([])
    setSelectedPapers(new Set())

    try {
      const params = new URLSearchParams({
        query,
        limit: '5',
        sortBy,
        yearRange,
        venue: venue === 'all' ? '' : venue,
        publicationType: publicationType === 'all' ? '' : publicationType,
        onlyOpenAccess: onlyOpenAccess.toString(),
      })

      const response = await fetch(`/api/admin/fetch-references?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      setResults(data.papers || [])
    } catch (err) {
      console.error('Error fetching references:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch references')
    } finally {
      setLoading(false)
    }
  }

  const togglePaperSelection = (paperId: string) => {
    const newSelected = new Set(selectedPapers)
    if (newSelected.has(paperId)) {
      newSelected.delete(paperId)
    } else {
      newSelected.add(paperId)
    }
    setSelectedPapers(newSelected)
  }

  const handleInsertReferences = () => {
    const selectedRefs = results
      .filter((paper) => selectedPapers.has(paper.paperId))
      .map((paper) => {
        const authors = paper.authors.slice(0, 3).join(', ')
        const moreAuthors = paper.authors.length > 3 ? ' et al.' : ''
        const year = paper.year || 'n.d.'
        const title = paper.title
        const venue = paper.venue || paper.journal || ''
        const venueText = venue ? ` ${venue}.` : ''
        return `${authors}${moreAuthors}. (${year}). ${title}.${venueText} ${paper.url}`
      })

    onReferencesSelected(selectedRefs)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="text-xl">Fetch References from Semantic Scholar</DialogTitle>
          <DialogDescription>
            Search for academic papers and select references to insert
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {/* Search Query */}
            <div className="space-y-2">
              <Label htmlFor="search-query" className="text-sm font-medium">Search Query</Label>
              <Input
                id="search-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter search terms..."
                className="bg-background"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch()
                  }
                }}
              />
            </div>

            {/* Search Parameters Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Sort By */}
              <div className="space-y-2">
                <Label htmlFor="sort-by" className="text-sm font-medium">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="sort-by" className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="citations">Citations</SelectItem>
                    <SelectItem value="year">Year (Newest First)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Year Range */}
              <div className="space-y-2">
                <Label htmlFor="year-range" className="text-sm font-medium">Year Range</Label>
                <Select value={yearRange} onValueChange={setYearRange}>
                  <SelectTrigger id="year-range" className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    <SelectItem value="1">Last Year</SelectItem>
                    <SelectItem value="5">Last 5 Years</SelectItem>
                    <SelectItem value="10">Last 10 Years</SelectItem>
                    <SelectItem value="25">Last 25 Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Venue */}
              <div className="space-y-2">
                <Label htmlFor="venue" className="text-sm font-medium">Venue</Label>
                <Select value={venue} onValueChange={setVenue}>
                  <SelectTrigger id="venue" className="bg-background">
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
                <Label htmlFor="publication-type" className="text-sm font-medium">Publication Type</Label>
                <Select value={publicationType} onValueChange={setPublicationType}>
                  <SelectTrigger id="publication-type" className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="JournalArticle">Journal Article</SelectItem>
                    <SelectItem value="Review">Review</SelectItem>
                    <SelectItem value="Conference">Conference Paper</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Open Access Checkbox and Search Button Row */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="open-access"
                  checked={onlyOpenAccess}
                  onCheckedChange={(checked) => setOnlyOpenAccess(checked as boolean)}
                />
                <Label
                  htmlFor="open-access"
                  className="text-sm font-normal cursor-pointer"
                >
                  Open Access only
                </Label>
              </div>

              <Button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="min-w-[140px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </>
                )}
              </Button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b">
                  <h3 className="font-semibold text-foreground">Results ({results.length})</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedPapers.size} selected
                  </p>
                </div>

                <div className="space-y-3">
                  {results.map((paper) => (
                    <div
                      key={paper.paperId}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedPapers.has(paper.paperId)
                          ? 'bg-primary/5 border-primary ring-1 ring-primary/20'
                          : 'bg-card hover:bg-accent/50 border-border'
                      }`}
                      onClick={() => togglePaperSelection(paper.paperId)}
                    >
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={selectedPapers.has(paper.paperId)}
                          onCheckedChange={() => togglePaperSelection(paper.paperId)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Title */}
                          <h4 className="font-semibold leading-tight text-foreground">{paper.title}</h4>

                          {/* Authors and Year */}
                          <p className="text-sm text-muted-foreground">
                            {paper.authors.slice(0, 3).join(', ')}
                            {paper.authors.length > 3 && ' et al.'} ({paper.year})
                          </p>

                          {/* Venue and Badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            {paper.venue && (
                              <Badge variant="outline" className="text-xs bg-background">
                                {paper.venue}
                              </Badge>
                            )}
                            {paper.citationCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {paper.citationCount} citations
                              </Badge>
                            )}
                            {paper.isOpenAccess && (
                              <Badge className="text-xs bg-green-600 hover:bg-green-700 text-white">
                                Open Access
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* External Link */}
                        <a
                          href={paper.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-shrink-0"
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Results Message */}
            {!loading && results.length === 0 && query && (
              <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
                No results found. Try adjusting your search parameters.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleInsertReferences}
            disabled={selectedPapers.size === 0}
          >
            Insert {selectedPapers.size > 0 ? `(${selectedPapers.size})` : ''} Reference
            {selectedPapers.size !== 1 ? 's' : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

