'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
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
import Link from 'next/link'
import FloatingCharacter from '@/shared/components/common/dr-albright'

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
      const [hugoResponse, harmonizomeResponse] = await Promise.all([
        fetch(`https://rest.genenames.org/fetch/symbol/${input.trim()}`),
        fetch(`https://amp.pharm.mssm.edu/Harmonizome/api/1.0/gene/${input.trim()}`)
      ])

      if (!hugoResponse.ok) {
        throw new Error(`HGNC API error: ${hugoResponse.statusText}`)
      }

      const hugoData = await hugoResponse.text()
      const hugoXmlDoc = new DOMParser().parseFromString(hugoData, 'text/xml')

      if (hugoXmlDoc.querySelector('result[name="response"][numFound="0"]')) {
        throw new Error('Gene not found in HGNC database.')
      }

      let harmonizomeData = null
      if (harmonizomeResponse.ok) {
        harmonizomeData = await harmonizomeResponse.json()
        if (harmonizomeData.status === 400) {
          harmonizomeData = null // Ignore harmonizome errors, use HGNC data only
        }
      }

      const hugoGeneInfo = extractHugoGeneInfo(hugoXmlDoc)
      const harmonizomeGeneInfo = harmonizomeData ? extractHarmonizomeGeneInfo(harmonizomeData) : { aliasSymbols: [], description: '' }
      const combinedGeneInfo = combineGeneInfo(hugoGeneInfo, harmonizomeGeneInfo)

      setGeneInfo(combinedGeneInfo)
      
      // Add to search history (keep last 5)
      setSearchHistory(prev => {
        const newHistory = [combinedGeneInfo, ...prev.filter(g => g.geneName !== combinedGeneInfo.geneName)]
        return newHistory.slice(0, 5)
      })

    } catch (error) {
      console.error('Error fetching gene information:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch gene information. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const extractHugoGeneInfo = (xmlDoc: Document): Omit<GeneInfo, 'description'> => {
    const getTagValue = (tagName: string) => {
      const element = xmlDoc.querySelector(`str[name="${tagName}"]`)
      return element ? element.textContent || '' : ''
    }

    const getArrayValues = (arrayName: string) => {
      const arrayElement = xmlDoc.querySelector(`arr[name="${arrayName}"]`)
      return arrayElement ? Array.from(arrayElement.getElementsByTagName('str')).map(node => node.textContent || '') : []
    }

    return {
      hgncId: getTagValue('hgnc_id'),
      geneName: getTagValue('symbol'),
      geneProduct: getTagValue('name'),
      previousNames: getArrayValues('prev_name'),
      aliasSymbols: getArrayValues('alias_symbol'),
      chromosomeLocation: getTagValue('location')
    }
  }

  const extractHarmonizomeGeneInfo = (data: any) => {
    return {
      aliasSymbols: Array.isArray(data.synonyms) ? data.synonyms : [],
      description: typeof data.description === 'string' ? data.description : ''
    }
  }

  const combineGeneInfo = (hugoInfo: Omit<GeneInfo, 'description'>, harmonizomeInfo: { aliasSymbols: string[], description: string }): GeneInfo => {
    return {
      ...hugoInfo,
      aliasSymbols: [...new Set([...hugoInfo.aliasSymbols, ...harmonizomeInfo.aliasSymbols])],
      description: harmonizomeInfo.description
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <FloatingCharacter
        imagePath="/images/dr-albright.png"
        imageAlt="Dr. Albright Character"
      />
      
      {/* Header */}
      <section className="relative py-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container px-4 mx-auto text-center">
          <div className="flex items-center justify-center mb-4">
            <Dna className="h-12 w-12 mr-4" />
            <h1 className="text-4xl md:text-5xl font-bold">Gene Lookup Tool</h1>
          </div>
          <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto">
            Search for comprehensive gene information from HGNC and Harmonizome databases
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              <FileText className="h-3 w-3 mr-1" />
              HGNC Database
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              <Dna className="h-3 w-3 mr-1" />
              Harmonizome API
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              <ExternalLink className="h-3 w-3 mr-1" />
              External Links
            </Badge>
          </div>
        </div>
      </section>

      {/* Navigation */}
      <section className="py-4 bg-white border-b">
        <div className="container px-4 mx-auto">
          <div className="flex items-center text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/tools" className="hover:text-primary">Tools</Link>
            <span className="mx-2">/</span>
            <span className="text-primary">Gene Lookup</span>
          </div>
        </div>
      </section>

      {/* Gene Search Tool */}
      <section className="relative py-16">
        <div className="container px-4 mx-auto max-w-4xl">
          <Card className="p-8 shadow-lg">
            <CardContent className="space-y-6">
              {/* Search Section */}
              <div className="space-y-4">
                <Label htmlFor="gene-input" className="text-lg font-semibold">
                  Enter Gene Symbol
                </Label>
                <div className="flex gap-2">
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
                    className="px-6"
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

                      {/* External Links */}
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <ExternalLink className="h-5 w-5" />
                          External Resources
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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

      {/* How to Use */}
      <section className="py-16 bg-gray-50">
        <div className="container px-4 mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">How to Use</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">1. Enter Gene Symbol</h3>
              <p className="text-muted-foreground">
                Type the official gene symbol (e.g., TP53, BRCA1) in the search box
              </p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">2. View Information</h3>
              <p className="text-muted-foreground">
                Get comprehensive gene data from HGNC and Harmonizome databases
              </p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">3. Explore Resources</h3>
              <p className="text-muted-foreground">
                Access external databases and copy information for your research
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ready for More Learning */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container px-4 mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready for More Learning?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Explore our other tools and resources to enhance your pathology knowledge
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild variant="secondary" size="lg">
              <Link href="/tools/cell-quiz">
                <Dna className="h-5 w-5 mr-2" />
                Cell Quiz
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/tools/citations">
                <FileText className="h-5 w-5 mr-2" />
                Citation Generator
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
              <Link href="/images">
                <FileText className="h-5 w-5 mr-2" />
                Image Gallery
              </Link>
            </Button>
          </div>
        </div>
      </section>
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
