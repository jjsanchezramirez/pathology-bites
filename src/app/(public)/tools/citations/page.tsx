'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Copy, BookOpen, FileText, Globe, Search, CheckCircle, Edit, Save, X, Plus, Minus, Database, Trash2 } from 'lucide-react'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'
import { useSmartCitations } from '@/shared/hooks/use-smart-citations'
import { CitationData } from '@/shared/utils/citation-extractor'
import {
  formatAPA,
  formatMLA,
  formatAMA,
  formatVancouver
} from '@/shared/utils/citation-formatters'

export default function CitationGeneratorPage() {
  const [input, setInput] = useState('')
  const [citationData, setCitationData] = useState<CitationData | null>(null)
  const [editableData, setEditableData] = useState<CitationData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)
  
  const { generateCitation, isLoading, error } = useSmartCitations()


  const detectInputType = (input: string): 'url' | 'doi' | 'isbn' | 'unknown' => {
    // Trim whitespace
    const trimmedInput = input.trim()

    // DOI patterns - more flexible
    if (trimmedInput.match(/^10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+$/)) {
      return 'doi'
    }
    if (trimmedInput.includes('doi.org/') || trimmedInput.includes('dx.doi.org/')) {
      return 'doi'
    }
    // Handle DOI with doi: prefix
    if (trimmedInput.match(/^doi:\s*10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+$/i)) {
      return 'doi'
    }

    // ISBN patterns - more flexible
    const isbnPattern = /^(?:ISBN(?:-1[03])?:?\s*)?(?=[-0-9\sX]{10,17}$)(?:97[89][-\s]?)?[0-9]{1,5}[-\s]?(?:[0-9]+[-\s]?){2}[0-9X]$/i
    if (trimmedInput.match(isbnPattern)) {
      return 'isbn'
    }
    // Simple ISBN check for 10 or 13 digit sequences
    const cleanIsbn = trimmedInput.replace(/[-\s]/g, '').replace(/^isbn:?/i, '')
    if (cleanIsbn.match(/^[0-9]{9}[0-9X]$|^97[89][0-9]{10}$/i)) {
      return 'isbn'
    }

    // URL patterns - more flexible
    if (trimmedInput.match(/^https?:\/\/.+/)) {
      return 'url'
    }
    // Handle URLs without protocol
    if (trimmedInput.match(/^(www\.|[a-zA-Z0-9-]+\.)[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/)) {
      return 'url'
    }
    // Handle common domain patterns
    if (trimmedInput.match(/^[a-zA-Z0-9-]+\.(com|org|edu|gov|net|io|co\.uk|ca|au)(\/.*)?$/i)) {
      return 'url'
    }

    return 'unknown'
  }

  const handleGenerate = async () => {
    if (!input.trim()) return

    setCitationData(null)

    try {
      const trimmedInput = input.trim()
      const inputType = detectInputType(trimmedInput)

      if (inputType === 'unknown') {
        throw new Error('Unable to detect input type. Please enter a valid URL, DOI, or ISBN.')
      }

      // Process the input based on type
      let processedInput = trimmedInput
      if (inputType === 'url' && !trimmedInput.match(/^https?:\/\//)) {
        // Add protocol if missing
        processedInput = `https://${trimmedInput}`
      }

      const metadata = await generateCitation(processedInput, inputType)
      setCitationData(metadata)
      setEditableData(metadata)
      setIsEditing(false)
    } catch (err) {
      console.error('Citation generation error:', err)
      // Error is already handled by the hook
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

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditableData(citationData)
    setIsEditing(false)
  }

  const updateEditableField = (field: keyof CitationData, value: string | string[]) => {
    if (editableData) {
      setEditableData({
        ...editableData,
        [field]: value
      })
    }
  }

  const addAuthor = () => {
    if (editableData) {
      setEditableData({
        ...editableData,
        authors: [...editableData.authors, '']
      })
    }
  }

  const removeAuthor = (index: number) => {
    if (editableData) {
      setEditableData({
        ...editableData,
        authors: editableData.authors.filter((_, i) => i !== index)
      })
    }
  }

  const updateAuthor = (index: number, value: string) => {
    if (editableData) {
      const newAuthors = [...editableData.authors]
      newAuthors[index] = value
      setEditableData({
        ...editableData,
        authors: newAuthors
      })
    }
  }



  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Citation Generator"
        description="Generate properly formatted citations for books, journal articles, and websites. Simply enter a URL, DOI, or ISBN and get APA, MLA, AMA, and Vancouver citations instantly."
        actions={
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span>Books via ISBN</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Articles via DOI</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>Websites via URL</span>
            </div>
          </div>
        }
      />

      {/* Citation Generator Tool */}
      <section className="relative py-16">
        <div className="container px-4 mx-auto max-w-4xl">
          <Card className="p-8 shadow-lg">
            <CardContent className="space-y-6">
              {/* Input Section */}
              <div className="space-y-4">
                <Label htmlFor="citation-input" className="text-lg font-semibold">
                  Enter URL, DOI, or ISBN
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="citation-input"
                    placeholder="https://example.com/article or 10.1234/example.doi or 978-0123456789"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  />
                  <Button
                    onClick={handleGenerate}
                    disabled={!input.trim() || isLoading}
                    className="px-6 w-full sm:w-auto"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                </div>
                {input && (
                  <p className="text-sm text-muted-foreground">
                    Detected type: <span className="font-medium">{
                      detectInputType(input) === 'doi' ? 'DOI' :
                      detectInputType(input) === 'isbn' ? 'ISBN' :
                      detectInputType(input) === 'url' ? 'URL' :
                      detectInputType(input).charAt(0).toUpperCase() + detectInputType(input).slice(1)
                    }</span>
                  </p>
                )}

              </div>

              {/* Error Display */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              {/* Citations Display */}
              {citationData && editableData && (
                <div className="space-y-6">
                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Generated Citations</h3>
                      {!isEditing ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleEdit}
                          className="flex items-center gap-2"
                        >
                          <Edit className="h-4 w-4" />
                          Edit Information
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSaveEdit}
                            className="flex items-center gap-2"
                          >
                            <Save className="h-4 w-4" />
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                            className="flex items-center gap-2"
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Edit Form */}
                    {isEditing && (
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                        <h4 className="font-semibold mb-2">Edit Citation Information</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          Modify any incorrect or missing information. Changes will be reflected in all citation formats.
                        </p>
                        <div className="space-y-4">
                          {/* Title */}
                          <div>
                            <Label htmlFor="edit-title">Title</Label>
                            <Input
                              id="edit-title"
                              value={editableData.title}
                              onChange={(e) => updateEditableField('title', e.target.value)}
                              className="mt-1"
                            />
                          </div>

                          {/* Authors */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <Label>Authors</Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addAuthor}
                                className="flex items-center gap-1"
                              >
                                <Plus className="h-3 w-3" />
                                Add Author
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {editableData.authors.map((author, index) => (
                                <div key={index} className="flex gap-2">
                                  <Input
                                    value={author}
                                    onChange={(e) => updateAuthor(index, e.target.value)}
                                    placeholder="Author name"
                                    className="flex-1"
                                  />
                                  {editableData.authors.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removeAuthor(index)}
                                      className="px-2"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Year */}
                          <div>
                            <Label htmlFor="edit-year">Year</Label>
                            <Input
                              id="edit-year"
                              value={editableData.year}
                              onChange={(e) => updateEditableField('year', e.target.value)}
                              className="mt-1"
                            />
                          </div>

                          {/* Conditional fields based on type */}
                          {editableData.type === 'journal' && (
                            <>
                              <div>
                                <Label htmlFor="edit-journal">Journal</Label>
                                <Input
                                  id="edit-journal"
                                  value={editableData.journal || ''}
                                  onChange={(e) => updateEditableField('journal', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label htmlFor="edit-volume">Volume</Label>
                                  <Input
                                    id="edit-volume"
                                    value={editableData.volume || ''}
                                    onChange={(e) => updateEditableField('volume', e.target.value)}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="edit-issue">Issue</Label>
                                  <Input
                                    id="edit-issue"
                                    value={editableData.issue || ''}
                                    onChange={(e) => updateEditableField('issue', e.target.value)}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="edit-pages">Pages</Label>
                                  <Input
                                    id="edit-pages"
                                    value={editableData.pages || ''}
                                    onChange={(e) => updateEditableField('pages', e.target.value)}
                                    className="mt-1"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label htmlFor="edit-doi">DOI</Label>
                                <Input
                                  id="edit-doi"
                                  value={editableData.doi || ''}
                                  onChange={(e) => updateEditableField('doi', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                            </>
                          )}

                          {editableData.type === 'book' && (
                            <>
                              <div>
                                <Label htmlFor="edit-publisher">Publisher</Label>
                                <Input
                                  id="edit-publisher"
                                  value={editableData.publisher || ''}
                                  onChange={(e) => updateEditableField('publisher', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-edition">Edition</Label>
                                <Input
                                  id="edit-edition"
                                  value={editableData.edition || ''}
                                  onChange={(e) => updateEditableField('edition', e.target.value)}
                                  placeholder="e.g., 6"
                                  className="mt-1"
                                />
                              </div>
                            </>
                          )}

                          {editableData.type === 'website' && (
                            <>
                              <div>
                                <Label htmlFor="edit-publisher">Website/Publisher</Label>
                                <Input
                                  id="edit-publisher"
                                  value={editableData.publisher || ''}
                                  onChange={(e) => updateEditableField('publisher', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-url">URL</Label>
                                <Input
                                  id="edit-url"
                                  value={editableData.url || ''}
                                  onChange={(e) => updateEditableField('url', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-access-date">Access Date</Label>
                                <Input
                                  id="edit-access-date"
                                  type="date"
                                  value={editableData.accessDate || ''}
                                  onChange={(e) => updateEditableField('accessDate', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <Tabs defaultValue="apa" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="apa">APA</TabsTrigger>
                        <TabsTrigger value="mla">MLA</TabsTrigger>
                        <TabsTrigger value="ama">AMA</TabsTrigger>
                        <TabsTrigger value="vancouver">
                          <span className="hidden sm:inline">Vancouver</span>
                          <span className="sm:hidden">Vanc.</span>
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="apa" className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg border">
                          <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatAPA(editableData).replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(formatAPA(editableData).replace(/\*(.*?)\*/g, '$1'), 'apa')}
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
                          <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatMLA(editableData).replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(formatMLA(editableData).replace(/\*(.*?)\*/g, '$1'), 'mla')}
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
                          <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatAMA(editableData).replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(formatAMA(editableData).replace(/\*(.*?)\*/g, '$1'), 'ama')}
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
                          <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatVancouver(editableData).replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(formatVancouver(editableData).replace(/\*(.*?)\*/g, '$1'), 'vancouver')}
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
                    </Tabs>
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
