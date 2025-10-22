'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Copy, BookOpen, Search, CheckCircle, ExternalLink, FileText } from 'lucide-react'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'
import {
  formatAPA,
  formatMLA,
  formatAMA,
  formatVancouver,
  formatNLM,
} from '@/shared/utils/citation-formatters'
import { CitationData } from '@/shared/utils/citation-extractor'

interface SemanticScholarPaper {
  paperId: string
  title: string
  authors: string[]
  year: number
  venue: string
  journal?: string
  citationCount: number
  abstract?: string
  isOpenAccess: boolean
  openAccessPdf?: string
  publicationTypes: string[]
  publicationDate?: string
}

export default function SemanticScholarCitationsPage() {
  const [query, setQuery] = useState('')
  const [papers, setPapers] = useState<SemanticScholarPaper[]>([])
  const [selectedPaper, setSelectedPaper] = useState<SemanticScholarPaper | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) return

    setIsLoading(true)
    setError(null)
    setPapers([])
    setSelectedPaper(null)

    try {
      const response = await fetch(
        `/api/public/tools/semantic-scholar/search?query=${encodeURIComponent(query)}&limit=20`
      )

      const data = await response.json()

      if (!response.ok) {
        // Handle specific error messages from the API
        if (data.rateLimited) {
          setError(data.error || 'Rate limit exceeded. Please wait a moment and try again.')
        } else {
          setError(data.error || 'Failed to search Semantic Scholar')
        }
        return
      }

      setPapers(data.papers || [])

      if (data.papers?.length === 0) {
        setError('No papers found. Try a different search term.')
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('Failed to search Semantic Scholar. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const selectPaper = (paper: SemanticScholarPaper) => {
    setSelectedPaper(paper)
  }

  const convertToCitationData = (paper: SemanticScholarPaper): CitationData => {
    return {
      title: paper.title,
      authors: paper.authors,
      year: paper.year.toString(),
      journal: paper.journal || paper.venue,
      type: 'journal',
    }
  }

  const copyToClipboard = async (text: string, format: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedFormat(format)
      setTimeout(() => setCopiedFormat(null), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Semantic Scholar Citation Generator"
        description="Search for pathology review articles using Semantic Scholar and generate citations in APA, MLA, AMA, and Vancouver formats. Perfect for finding high-quality review articles on specific pathology topics."
        actions={
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span>Review Articles</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Pathology Focus</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Search className="h-4 w-4" />
              <span>Citation Generation</span>
            </div>
          </div>
        }
      />

      {/* Search and Results Section */}
      <section className="relative py-16">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Search */}
            <Card className="p-6 shadow-lg">
              <CardContent className="space-y-6">
                {/* Search Input */}
                <div className="space-y-4">
                  <Label htmlFor="search-input" className="text-lg font-semibold">
                    Search for Pathology Topics
                  </Label>
                  <div className="flex flex-col gap-2">
                    <Input
                      id="search-input"
                      placeholder="e.g., Langerhans cell histiocytosis"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button
                      onClick={handleSearch}
                      disabled={!query.trim() || isLoading}
                      className="w-full"
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Search Review Articles
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Search automatically filters for pathology review articles
                  </p>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                {/* Search Results */}
                {papers.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">
                      Found {papers.length} Papers
                    </h3>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {papers.map((paper) => (
                        <Card
                          key={paper.paperId}
                          className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                            selectedPaper?.paperId === paper.paperId
                              ? 'border-primary border-2'
                              : ''
                          }`}
                          onClick={() => selectPaper(paper)}
                        >
                          <h4 className="font-semibold text-sm mb-2 line-clamp-2">
                            {paper.title}
                          </h4>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p className="line-clamp-1">
                              {paper.authors.slice(0, 3).join(', ')}
                              {paper.authors.length > 3 && ' et al.'}
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span>{paper.year}</span>
                              {paper.journal && (
                                <span className="line-clamp-1">{paper.journal}</span>
                              )}
                              <span className="flex items-center gap-1">
                                <BookOpen className="h-3 w-3" />
                                {paper.citationCount} citations
                              </span>
                              {paper.isOpenAccess && (
                                <span className="text-green-600 font-medium">
                                  Open Access
                                </span>
                              )}
                            </div>
                            {paper.publicationTypes.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {paper.publicationTypes.map((type) => (
                                  <span
                                    key={type}
                                    className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs"
                                  >
                                    {type}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Column: Citations */}
            <Card className="p-6 shadow-lg">
              <CardContent className="space-y-6">
                {selectedPaper ? (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Generated Citations</h3>
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium line-clamp-2">{selectedPaper.title}</p>
                        <p className="text-xs mt-1">
                          {selectedPaper.authors.slice(0, 3).join(', ')}
                          {selectedPaper.authors.length > 3 && ' et al.'} ({selectedPaper.year})
                        </p>
                        {selectedPaper.openAccessPdf && (
                          <a
                            href={selectedPaper.openAccessPdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 mt-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View PDF (Open Access)
                          </a>
                        )}
                      </div>
                    </div>

                    {selectedPaper.abstract && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Abstract</h4>
                        <p className="text-xs text-muted-foreground line-clamp-4">
                          {selectedPaper.abstract}
                        </p>
                      </div>
                    )}

                    <Tabs defaultValue="apa" className="w-full">
                      <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="apa">APA</TabsTrigger>
                        <TabsTrigger value="mla">MLA</TabsTrigger>
                        <TabsTrigger value="ama">AMA</TabsTrigger>
                        <TabsTrigger value="vancouver">
                          <span className="hidden sm:inline">Vancouver</span>
                          <span className="sm:hidden">Vanc.</span>
                        </TabsTrigger>
                        <TabsTrigger value="nlm">NLM</TabsTrigger>
                      </TabsList>

                      <TabsContent value="apa" className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg border">
                          <p
                            className="text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: formatAPA(convertToCitationData(selectedPaper)).replace(
                                /\*(.*?)\*/g,
                                '<em>$1</em>'
                              ),
                            }}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              formatAPA(convertToCitationData(selectedPaper)).replace(
                                /\*(.*?)\*/g,
                                '$1'
                              ),
                              'apa'
                            )
                          }
                          className="w-full"
                        >
                          {copiedFormat === 'apa' ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy APA Citation
                            </>
                          )}
                        </Button>
                      </TabsContent>

                      <TabsContent value="mla" className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg border">
                          <p
                            className="text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: formatMLA(convertToCitationData(selectedPaper)).replace(
                                /\*(.*?)\*/g,
                                '<em>$1</em>'
                              ),
                            }}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              formatMLA(convertToCitationData(selectedPaper)).replace(
                                /\*(.*?)\*/g,
                                '$1'
                              ),
                              'mla'
                            )
                          }
                          className="w-full"
                        >
                          {copiedFormat === 'mla' ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy MLA Citation
                            </>
                          )}
                        </Button>
                      </TabsContent>

                      <TabsContent value="ama" className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg border">
                          <p
                            className="text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: formatAMA(convertToCitationData(selectedPaper)).replace(
                                /\*(.*?)\*/g,
                                '<em>$1</em>'
                              ),
                            }}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              formatAMA(convertToCitationData(selectedPaper)).replace(
                                /\*(.*?)\*/g,
                                '$1'
                              ),
                              'ama'
                            )
                          }
                          className="w-full"
                        >
                          {copiedFormat === 'ama' ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy AMA Citation
                            </>
                          )}
                        </Button>
                      </TabsContent>

                      <TabsContent value="vancouver" className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg border">
                          <p
                            className="text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: formatVancouver(
                                convertToCitationData(selectedPaper)
                              ).replace(/\*(.*?)\*/g, '<em>$1</em>'),
                            }}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              formatVancouver(convertToCitationData(selectedPaper)).replace(
                                /\*(.*?)\*/g,
                                '$1'
                              ),
                              'vancouver'
                            )
                          }
                          className="w-full"
                        >
                          {copiedFormat === 'vancouver' ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Vancouver Citation
                            </>
                          )}
                        </Button>
                      </TabsContent>

                      <TabsContent value="nlm" className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg border">
                          <p
                            className="text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: formatNLM(
                                convertToCitationData(selectedPaper)
                              ).replace(/\*(.*?)\*/g, '<em>$1</em>'),
                            }}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              formatNLM(convertToCitationData(selectedPaper)).replace(
                                /\*(.*?)\*/g,
                                '$1'
                              ),
                              'nlm'
                            )
                          }
                          className="w-full"
                        >
                          {copiedFormat === 'nlm' ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy NLM Citation
                            </>
                          )}
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[400px] text-center">
                    <div className="space-y-2">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Search for papers and select one to generate citations
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community */}
      <JoinCommunitySection description="Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone." />
    </div>
  )
}
