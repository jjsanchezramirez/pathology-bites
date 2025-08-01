'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

import { 
  Search, 
  Copy, 
  ExternalLink, 
  Dna, 
  MapPin, 
  FileText, 
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'

interface GeneInfo {
  hgncId: string
  geneName: string
  geneProduct: string
  previousNames: string[]
  aliasSymbols: string[]
  chromosomeLocation: string
  description: string
}

export default function GeneLookupPage() {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [geneInfo, setGeneInfo] = useState<GeneInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [searchHistory, setSearchHistory] = useState<GeneInfo[]>([])

  const fetchGeneInformation = async () => {
    if (!input.trim()) {
      setError('Please enter a gene name before searching.')
      return
    }

    setIsLoading(true)
    setError(null)
    setGeneInfo(null)

    try {
      const response = await fetch(`/api/tools/gene-lookup?symbol=${encodeURIComponent(input.trim())}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch gene information')
      }

      const geneInfo = result.data
      setGeneInfo(geneInfo)

      // Add to search history (keep last 5)
      setSearchHistory(prev => {
        const newHistory = [geneInfo, ...prev.filter(g => g.geneName !== geneInfo.geneName)]
        return newHistory.slice(0, 5)
      })

    } catch (error) {
      console.error('Error fetching gene information:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch gene information. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }



  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const openExternalLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Gene Lookup Tool"
        description="Search for comprehensive gene information from HGNC and Harmonizome databases. Get detailed gene data, chromosome locations, aliases, and descriptions."
        actions={
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>HGNC Database</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Dna className="h-4 w-4" />
              <span>Harmonizome API</span>
            </div>
          </div>
        }
      />



      {/* Gene Search Tool */}
      <section className="relative py-16">
        <div className="container px-4 mx-auto max-w-4xl">
          <Card className="p-4 sm:p-8 shadow-lg">
            <CardContent className="space-y-6">
              {/* Search Section */}
              <div className="space-y-4">
                <Label htmlFor="gene-input" className="text-lg font-semibold">
                  Enter Gene Symbol
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="gene-input"
                    placeholder="e.g., TP53, BRCA1, EGFR"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && fetchGeneInformation()}
                  />
                  <Button
                    onClick={fetchGeneInformation}
                    disabled={!input.trim() || isLoading}
                    className="px-6 w-full sm:w-auto"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              {/* Gene Information Display */}
              {geneInfo && (
                <div className="space-y-6">
                  <div className="border-t pt-6">
                    <h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-2">
                      <Dna className="h-6 w-6" />
                      {geneInfo.geneName}
                    </h2>

                    <div className="grid gap-6">
                      {/* Basic Information */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <InfoCard
                          title="Gene Product"
                          content={geneInfo.geneProduct}
                          icon={<FileText className="h-4 w-4" />}
                          onCopy={() => copyToClipboard(geneInfo.geneProduct, 'product')}
                          copied={copiedField === 'product'}
                        />
                        <InfoCard
                          title="Chromosome Location"
                          content={geneInfo.chromosomeLocation}
                          icon={<MapPin className="h-4 w-4" />}
                          onCopy={() => copyToClipboard(geneInfo.chromosomeLocation, 'location')}
                          copied={copiedField === 'location'}
                        />
                      </div>

                      {/* Arrays */}
                      {geneInfo.previousNames.length > 0 && (
                        <InfoCard
                          title="Previous Names"
                          content={geneInfo.previousNames.join(', ')}
                          onCopy={() => copyToClipboard(geneInfo.previousNames.join(', '), 'previous')}
                          copied={copiedField === 'previous'}
                        />
                      )}

                      {geneInfo.aliasSymbols.length > 0 && (
                        <InfoCard
                          title="Alias Symbols"
                          content={geneInfo.aliasSymbols.join(', ')}
                          onCopy={() => copyToClipboard(geneInfo.aliasSymbols.join(', '), 'aliases')}
                          copied={copiedField === 'aliases'}
                        />
                      )}

                      {/* Description */}
                      {geneInfo.description && (
                        <InfoCard
                          title="Description"
                          content={geneInfo.description}
                          onCopy={() => copyToClipboard(geneInfo.description, 'description')}
                          copied={copiedField === 'description'}
                        />
                      )}

                      {/* Database Links */}
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <Dna className="h-5 w-5" />
                          Database Resources
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openExternalLink(`https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/${geneInfo.hgncId}`)}
                            className="justify-start"
                          >
                            <ExternalLink className="h-3 w-3 mr-2" />
                            HGNC
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openExternalLink(`https://maayanlab.cloud/Harmonizome/gene/${geneInfo.geneName}`)}
                            className="justify-start"
                          >
                            <ExternalLink className="h-3 w-3 mr-2" />
                            Harmonizome Gene
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openExternalLink(`https://maayanlab.cloud/Harmonizome/protein/${geneInfo.geneName}_HUMAN`)}
                            className="justify-start"
                          >
                            <ExternalLink className="h-3 w-3 mr-2" />
                            Harmonizome Protein
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openExternalLink(`https://cancer.sanger.ac.uk/cosmic/gene/analysis?ln=${geneInfo.geneName}`)}
                            className="justify-start"
                          >
                            <ExternalLink className="h-3 w-3 mr-2" />
                            COSMIC Gene
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openExternalLink(`https://cancer.sanger.ac.uk/cosmic/census-page/${geneInfo.geneName}`)}
                            className="justify-start"
                          >
                            <ExternalLink className="h-3 w-3 mr-2" />
                            COSMIC Hallmark
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Search History */}
              {searchHistory.length > 0 && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Recent Searches</h3>
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.map((gene, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setInput(gene.geneName)
                          setGeneInfo(gene)
                          setError(null)
                        }}
                        className="text-xs"
                      >
                        {gene.geneName}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community */}
      <JoinCommunitySection
        description="Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone."
      />
    </div>
  )
}

// Helper component for displaying information cards
interface InfoCardProps {
  title: string
  content: string
  icon?: React.ReactNode
  onCopy: () => void
  copied: boolean
}

function InfoCard({ title, content, icon, onCopy, copied }: InfoCardProps) {
  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
          {icon}
          {title}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="h-8 w-8 p-0"
        >
          {copied ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-gray-700 text-sm leading-relaxed">{content}</p>
    </div>
  )
}
