'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Search,
  Loader2,
  Microscope,
  Stethoscope,
  FlaskConical,
  Eye,
  AlertCircle,
  CheckCircle,
  Info,
  Dna
} from 'lucide-react'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'

interface DiagnosticResults {
  differential_diagnosis: string[]
  immunohistochemistry: {
    positive: string[]
    negative: string[]
  }
  histologic_clues: string[]
  clinical_features: string[]
  molecular_findings: string[]
  additional_info: string[]
}

interface SearchMetadata {
  searched_at: string
  search_time_ms: number
  entity: string
  context_found: boolean
  context_quality: string
  files_searched: number
  ai_organized?: boolean
  ai_model?: string
  ai_generation_time_ms?: number
  ai_fallback_attempts?: number
  search_algorithm?: string
  search_quality?: string
  medical_terms_extracted?: number
  token_usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  best_match?: {
    filename: string
    lesson: string
    topic: string
    score: number
    match_details?: any
  }
}

// Funny loading messages for diagnostic search
const DIAGNOSTIC_LOADING_MESSAGES = [
  "Consulting the pathology oracle (results may vary)...",
  "Teaching AI that 'reactive changes' is a real diagnosis...",
  "Searching through mountains of medical mystery...",
  "Asking slides to reveal their diagnostic secrets...",
  "Translating 'pink and purple stuff' into medical terminology...",
  "Convincing the algorithm that everything isn't cancer...",
  "Channeling the spirit of Rudolf Virchow for guidance...",
  "Performing digital differential diagnosis dance...",
  "Teaching AI the fine art of 'consistent with'...",
  "Consulting with Dr. Google (but medically accurate)...",
  "Searching for that one case that makes everything clear...",
  "Teaching the computer about zebras in pathology...",
  "Asking 'What would your attending diagnose?' (nervously)...",
  "Generating results that won't make you second-guess yourself...",
  "Calibrating the 'atypical' detection algorithm...",
  "Teaching AI that morphology is everything (usually)...",
  "Searching through the diagnostic haystack for answers...",
  "Consulting the ancient texts of Robbins and Cotran...",
  "Teaching the algorithm about immunohistochemistry magic...",
  "Asking the stains to cooperate for once...",
  "Searching for clues like Sherlock Holmes, MD...",
  "Teaching AI that 'favor' means 'probably but not certain'...",
  "Calibrating the diagnostic confidence meter...",
  "Searching through case files with digital magnifying glass...",
  "Teaching the computer about the beauty of H&E stains...",
  "Consulting with pathology residents (virtually)...",
  "Generating insights that would make Osler proud...",
  "Teaching AI the difference between dysplasia and cancer...",
  "Searching for patterns in the diagnostic chaos...",
  "Asking the tissue to confess its true identity..."
]

export default function DiagnosticSearchPage() {
  const [entity, setEntity] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<DiagnosticResults | null>(null)
  const [metadata, setMetadata] = useState<SearchMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('')
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cycle through loading messages while searching
  useEffect(() => {
    if (isLoading) {
      // Set initial message
      const initialIndex = Math.floor(Math.random() * DIAGNOSTIC_LOADING_MESSAGES.length)
      setLoadingMessageIndex(initialIndex)
      setCurrentLoadingMessage(DIAGNOSTIC_LOADING_MESSAGES[initialIndex])

      // Cycle through messages every 3.5 seconds
      loadingIntervalRef.current = setInterval(() => {
        setLoadingMessageIndex(prev => {
          const nextIndex = (prev + 1) % DIAGNOSTIC_LOADING_MESSAGES.length
          setCurrentLoadingMessage(DIAGNOSTIC_LOADING_MESSAGES[nextIndex])
          return nextIndex
        })
      }, 3500)
    } else {
      // Clear interval when not loading
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current)
        loadingIntervalRef.current = null
      }
    }

    // Cleanup on unmount
    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current)
      }
    }
  }, [isLoading])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!entity.trim()) {
      setError('Please enter a diagnostic entity to search')
      return
    }

    setIsLoading(true)
    setError(null)
    setResults(null)
    setMetadata(null)

    try {
      const response = await fetch('/api/tools/diagnostic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entity: entity.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Search failed')
      }

      if (data.success && data.results) {
        setResults(data.results)
        setMetadata(data.metadata)
      } else {
        setError('No diagnostic information found for this entity. Try a different search term or check spelling.')
        setMetadata(data.metadata)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during search')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setEntity('')
    setResults(null)
    setMetadata(null)
    setError(null)
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Diagnostic Entity Search"
        description="Search for diagnostic entities and get comprehensive information including differential diagnosis, immunohistochemistry stains, and histologic clues from our educational content database."
        actions={
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Microscope className="h-4 w-4" />
              <span>Differential Diagnosis</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FlaskConical className="h-4 w-4" />
              <span>Immunohistochemistry</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>Histologic Clues</span>
            </div>
          </div>
        }
      />

      {/* Main Content */}
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
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
                      placeholder="Enter diagnostic entity (e.g., ductal carcinoma, melanoma, lymphoma)"
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
                      {isLoading ? 'Searching...' : 'Search'}
                    </Button>
                    {(results || error) && (
                      <Button type="button" variant="outline" onClick={handleClear}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Funny Loading Screen */}
          {isLoading && (
            <Card className="mb-8">
              <CardContent className="p-12">
                <div className="text-center space-y-6">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                    <div className="absolute -top-2 -right-2">
                      <Microscope className="h-6 w-6 text-muted-foreground animate-bounce" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-primary">
                      Searching Diagnostic Database...
                    </h3>
                    <p className="text-sm font-medium text-muted-foreground">
                      Analyzing "{entity}" across our educational content
                    </p>
                    
                    <div className="min-h-[3rem] flex items-center justify-center">
                      <p className="text-sm text-primary font-medium italic leading-relaxed max-w-md transition-opacity duration-500">
                        {currentLoadingMessage || "Consulting the pathology oracle (results may vary)..."}
                      </p>
                    </div>
                    
                    <div className="flex justify-center items-center gap-2 text-xs text-muted-foreground">
                      <FlaskConical className="h-3 w-3" />
                      <span>Searching for differential diagnoses, immunostains, and histologic clues</span>
                    </div>
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
                  <span className="font-medium">Search Error</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Search Metadata */}
          {metadata && (
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
                  <div>
                    <span className="text-muted-foreground">Files Searched:</span>
                    <p className="font-medium">{metadata.files_searched}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Context Found:</span>
                    <p className="font-medium flex items-center gap-1">
                      {metadata.context_found ? (
                        <>
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          Yes
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 text-red-500" />
                          No
                        </>
                      )}
                    </p>
                  </div>
                </div>
                
                {/* AI and Token Usage Information */}
                {metadata.ai_organized && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">AI Model:</span>
                        <p className="font-medium">{metadata.ai_model || 'Unknown'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">AI Processing:</span>
                        <p className="font-medium">{metadata.ai_generation_time_ms || 0}ms</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Fallback Attempts:</span>
                        <p className="font-medium">
                          {metadata.ai_fallback_attempts || 1}
                          {(metadata.ai_fallback_attempts || 1) > 1 && (
                            <span className="text-orange-500 text-xs ml-1">(fallback used)</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tokens Used:</span>
                        <p className="font-medium">
                          {metadata.token_usage
                            ? `${metadata.token_usage.total_tokens} tokens`
                            : 'N/A'
                          }
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Information organized by AI for better readability
                      {(metadata.ai_fallback_attempts || 1) > 1 && (
                        <span className="text-orange-600 ml-2">• Multi-model fallback system used</span>
                      )}
                    </p>
                  </div>
                )}
                {metadata.best_match && (
                  <div className="mt-4 pt-4 border-t">
                    <span className="text-muted-foreground text-sm">Best Match:</span>
                    <p className="font-medium text-sm">
                      {metadata.best_match.lesson} → {metadata.best_match.topic}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Source: {metadata.best_match.filename}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Results - Reordered and Simplified Design */}
          {results && (
            <div className="space-y-6">
              {/* 1. Clinical Features */}
              {results.clinical_features.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Stethoscope className="h-5 w-5 text-blue-500" />
                      <h3 className="text-lg font-semibold">Clinical Features</h3>
                    </div>
                    <div className="space-y-3">
                      {results.clinical_features.map((item, index) => (
                        <p key={index} className="text-sm leading-relaxed text-gray-700">
                          • {item}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 2. Histologic Findings (renamed from Histologic Clues) */}
              {results.histologic_clues.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Eye className="h-5 w-5 text-purple-500" />
                      <h3 className="text-lg font-semibold">Histologic Findings</h3>
                    </div>
                    <div className="space-y-3">
                      {results.histologic_clues.map((item, index) => (
                        <p key={index} className="text-sm leading-relaxed text-gray-700">
                          • {item}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 3. Immunohistochemistry */}
              {(results.immunohistochemistry.positive.length > 0 || results.immunohistochemistry.negative.length > 0) && (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <FlaskConical className="h-5 w-5 text-green-500" />
                      <h3 className="text-lg font-semibold">Immunohistochemistry</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      {results.immunohistochemistry.positive.length > 0 && (
                        <div>
                          <h4 className="font-medium text-green-600 mb-3 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            Positive Stains
                          </h4>
                          <div className="space-y-2">
                            {results.immunohistochemistry.positive.map((item, index) => (
                              <p key={index} className="text-sm text-gray-700">
                                • {item}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      {results.immunohistochemistry.negative.length > 0 && (
                        <div>
                          <h4 className="font-medium text-red-600 mb-3 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Negative Stains
                          </h4>
                          <div className="space-y-2">
                            {results.immunohistochemistry.negative.map((item, index) => (
                              <p key={index} className="text-sm text-gray-700">
                                • {item}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 4. Differential Diagnosis */}
              {results.differential_diagnosis.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Microscope className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold">Differential Diagnosis</h3>
                    </div>
                    <div className="space-y-3">
                      {results.differential_diagnosis.map((item, index) => (
                        <p key={index} className="text-sm leading-relaxed text-gray-700">
                          • {item}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 5. Molecular Findings */}
              {results.molecular_findings && results.molecular_findings.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Dna className="h-5 w-5 text-indigo-500" />
                      <h3 className="text-lg font-semibold">Molecular Findings</h3>
                    </div>
                    <div className="space-y-3">
                      {results.molecular_findings.map((item, index) => (
                        <p key={index} className="text-sm leading-relaxed text-gray-700">
                          • {item}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Additional Information (if not molecular) */}
              {results.additional_info.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Info className="h-5 w-5 text-gray-500" />
                      <h3 className="text-lg font-semibold">Additional Information</h3>
                    </div>
                    <div className="space-y-3">
                      {results.additional_info.map((item, index) => (
                        <p key={index} className="text-sm leading-relaxed text-gray-700">
                          • {item}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Join Community Section */}
      <JoinCommunitySection />
    </div>
  )
}
