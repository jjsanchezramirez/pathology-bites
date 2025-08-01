'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { WSIViewer, WSIEmbeddingViewer } from '@/shared/components/common/wsi-viewer'
import {
  TestTube,
  Brain,
  Play,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Plus,
  FileText
} from 'lucide-react'
import {
  ACTIVE_AI_MODELS,
  getModelProvider,
  getApiKey,
  DEFAULT_MODEL
} from '@/shared/config/ai-models'

interface WSISource {
  id: string
  name: string
  repository: string
  diagnosis: string
  slide_url: string
  embeddingStatus: 'embeddable' | 'blocked' | 'raw_file' | 'full_page'
  fileFormat: string
  contentType: 'wsi_file' | 'full_page' | 'case_study' | 'educational_module'
  slide: any
}

interface AIModel {
  id: string
  name: string
  provider: string
  available: boolean
  temperature?: number
  maxTokens?: number
}

interface TestResult {
  success: boolean
  prompt: string
  response: string
  generatedQuestion: any
  error?: string
  timing: number
  model: string
  parameters: Record<string, any>
}

export default function WSISimpleDebugPage() {
  const [wsiSources, setWsiSources] = useState<WSISource[]>([])
  const [loadingRepositories, setLoadingRepositories] = useState(true)
  const [customUrl, setCustomUrl] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  // Use centralized AI models configuration
  const aiModels = ACTIVE_AI_MODELS.map(model => ({
    id: model.id,
    name: model.name,
    provider: model.provider.charAt(0).toUpperCase() + model.provider.slice(1),
    available: model.available,
    temperature: 0.7,
    maxTokens: 4000
  }))

  const [selectedWSI, setSelectedWSI] = useState<WSISource | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  // Load WSI repositories on component mount
  useEffect(() => {
    loadWSIRepositories()
  }, [])

  const loadWSIRepositories = async () => {
    setLoadingRepositories(true)
    try {
      const response = await fetch('/api/debug/wsi-repositories')
      if (response.ok) {
        const data = await response.json()
        setWsiSources(data.sources)
        if (data.sources.length > 0) {
          setSelectedWSI(data.sources[0])
        }
      }
    } catch (error) {
      console.error('Failed to load WSI repositories:', error)
    } finally {
      setLoadingRepositories(false)
    }
  }

  const createCustomWSI = () => {
    if (!customUrl.trim()) return

    // Determine content type and embedding status based on URL
    const isFullPage = customUrl.includes('/case/') ||
                      customUrl.includes('/module/') ||
                      customUrl.includes('/collection/') ||
                      customUrl.includes('pathpresenter.net') ||
                      customUrl.includes('learn.mghpathology.org') ||
                      !customUrl.match(/\.(svs|mrxs|ndpi|scn|vms|vmu|tiff|tif)(\?|$)/i)

    const contentType = isFullPage ?
      (customUrl.includes('/case/') ? 'case_study' :
       customUrl.includes('/module/') ? 'educational_module' : 'full_page') : 'wsi_file'

    const embeddingStatus = isFullPage ? 'full_page' : 'raw_file'

    const customWSI: WSISource = {
      id: 'custom_url',
      name: `Custom ${contentType === 'full_page' ? 'Page' : contentType === 'case_study' ? 'Case Study' : contentType === 'educational_module' ? 'Educational Module' : 'WSI File'}`,
      repository: 'Custom',
      diagnosis: `Custom ${contentType.replace('_', ' ')} Test`,
      slide_url: customUrl,
      embeddingStatus: embeddingStatus,
      fileFormat: isFullPage ? 'html' : (customUrl.split('.').pop()?.toLowerCase() || 'unknown'),
      contentType: contentType,
      slide: {
        id: 'custom',
        repository: 'Custom',
        category: 'Test',
        subcategory: 'Custom',
        diagnosis: `Custom ${contentType.replace('_', ' ')} Test`,
        patient_info: 'Custom test case',
        age: null,
        gender: null,
        clinical_history: `Custom ${contentType.replace('_', ' ')} URL for testing`,
        stain_type: 'Unknown',
        preview_image_url: '',
        slide_url: customUrl,
        case_url: customUrl,
        other_urls: [],
        source_metadata: { custom: true, contentType: contentType }
      }
    }

    setSelectedWSI(customWSI)
    setShowCustomInput(false)
    setCustomUrl('')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'embeddable':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Embeddable</Badge>
      case 'blocked':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Blocked</Badge>
      case 'raw_file':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Raw File</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const generateQuestion = async () => {
    if (!selectedWSI) return

    setTesting(true)
    setTestResult(null)

    const startTime = Date.now()
    const selectedModelConfig = aiModels.find(m => m.id === selectedModel)
    try {

      // Use the actual admin API endpoint for question generation
      const response = await fetch('/api/admin/generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          temperature: selectedModelConfig?.temperature || 0.7,
          maxTokens: selectedModelConfig?.maxTokens || 4000,
          wsiData: {
            diagnosis: selectedWSI.diagnosis,
            repository: selectedWSI.repository,
            clinical_history: selectedWSI.slide.clinical_history,
            stain_type: selectedWSI.slide.stain_type,
            category: selectedWSI.slide.category,
            subcategory: selectedWSI.slide.subcategory,
            slide_url: selectedWSI.slide_url
          },
          instructions: `Based on the following WSI (Virtual Slide Image) information, create a comprehensive multiple-choice pathology question:

WSI Information:
- Diagnosis: ${selectedWSI.diagnosis}
- Repository: ${selectedWSI.repository}
- Clinical History: ${selectedWSI.slide.clinical_history}
- Stain Type: ${selectedWSI.slide.stain_type}
- Category: ${selectedWSI.slide.category}

Requirements:
1. Create a clinically relevant scenario-based question
2. Include 4-5 answer choices with one clearly correct answer
3. Provide detailed explanations for each choice
4. Ensure the question tests understanding of the histological features
5. Include relevant teaching points about the diagnosis
6. Reference the virtual slide image in the question stem

Please generate a question that integrates the WSI visual information with educational content.`
        })
      })

      const endTime = Date.now()

      if (response.ok) {
        const result = await response.json()

        setTestResult({
          success: true,
          prompt: result.prompt || 'Prompt not available',
          response: JSON.stringify(result.question, null, 2),
          generatedQuestion: result.question,
          timing: endTime - startTime,
          model: selectedModel,
          parameters: {
            temperature: selectedModelConfig?.temperature || 0.7,
            maxTokens: selectedModelConfig?.maxTokens || 4000
          }
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate question')
      }

    } catch (error) {
      const endTime = Date.now()

      // Fallback to mock response if API fails
      const mockResponse = {
        stem: `A patient presents with a lesion showing the histological features visible in this virtual slide. Based on the microscopic appearance, what is the most likely diagnosis?`,
        options: [
          {
            id: 'A',
            text: selectedWSI.diagnosis,
            is_correct: true,
            explanation: `Correct. The histological features are characteristic of ${selectedWSI.diagnosis}.`
          },
          {
            id: 'B',
            text: 'Alternative diagnosis 1',
            is_correct: false,
            explanation: 'Incorrect. This diagnosis would show different histological patterns.'
          },
          {
            id: 'C',
            text: 'Alternative diagnosis 2',
            is_correct: false,
            explanation: 'Incorrect. The microscopic features do not support this diagnosis.'
          },
          {
            id: 'D',
            text: 'Alternative diagnosis 3',
            is_correct: false,
            explanation: 'Incorrect. This condition has distinct histological characteristics not seen here.'
          }
        ],
        teaching_point: `${selectedWSI.diagnosis} shows specific histological features that are important for accurate diagnosis.`,
        references: [`Reference for ${selectedWSI.diagnosis}`]
      }

      setTestResult({
        success: false,
        prompt: `Debug Mode - API Error: ${error instanceof Error ? error.message : 'Unknown error'}

Fallback prompt would be:
Based on the following WSI information, create a comprehensive multiple-choice pathology question:
- Diagnosis: ${selectedWSI.diagnosis}
- Repository: ${selectedWSI.repository}
- Clinical History: ${selectedWSI.slide.clinical_history}`,
        response: JSON.stringify(mockResponse, null, 2),
        generatedQuestion: mockResponse,
        error: `API Error: ${error instanceof Error ? error.message : 'Unknown error'}. Showing fallback mock response.`,
        timing: endTime - startTime,
        model: selectedModel,
        parameters: {
          temperature: selectedModelConfig?.temperature || 0.7,
          maxTokens: selectedModelConfig?.maxTokens || 4000
        }
      })
    } finally {
      setTesting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with proper spacing */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3 mb-4">
              <TestTube className="h-10 w-10 text-primary" />
              <h1 className="text-4xl font-bold">WSI Debug Interface</h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Comprehensive testing environment for WSI repositories and AI model integration.
              Test different virtual slide sources with various AI models to debug and optimize question generation.
            </p>
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mt-6">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>{wsiSources.length} WSI Sources</span>
              </div>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                <span>{aiModels.length} AI Models</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* WSI Viewer Side */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  WSI Source Selection
                  <Button
                    onClick={() => setShowCustomInput(!showCustomInput)}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Custom URL
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingRepositories ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading WSI repositories...</span>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="wsi-select" className="text-sm font-medium">
                        Select WSI Source ({wsiSources.length} available):
                      </Label>
                      <Select
                        value={selectedWSI?.id || ''}
                        onValueChange={(value) => {
                          const source = wsiSources.find(s => s.id === value)
                          if (source) setSelectedWSI(source)
                        }}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select a WSI source..." />
                        </SelectTrigger>
                        <SelectContent>
                          {wsiSources.map(source => (
                            <SelectItem key={source.id} value={source.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{source.name}</span>
                                <div className="flex items-center gap-2 ml-2">
                                  <Badge variant="outline" className="text-xs">
                                    {source.fileFormat.toUpperCase()}
                                  </Badge>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom URL Input */}
                    {showCustomInput && (
                      <div className="border rounded-lg p-4 bg-muted/20">
                        <Label htmlFor="custom-url" className="text-sm font-medium">
                          Custom WSI URL:
                        </Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            id="custom-url"
                            value={customUrl}
                            onChange={(e) => setCustomUrl(e.target.value)}
                            placeholder="Enter WSI URL (e.g., https://example.com/slide.svs)"
                            className="flex-1"
                          />
                          <Button
                            onClick={createCustomWSI}
                            disabled={!customUrl.trim()}
                            size="sm"
                          >
                            Load
                          </Button>
                        </div>
                      </div>
                    )}

                    {selectedWSI && (
                      <>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="font-medium">Repository:</div>
                            <div className="text-muted-foreground">{selectedWSI.repository}</div>
                          </div>
                          <div className="flex justify-end">
                            {getStatusBadge(selectedWSI.embeddingStatus)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="font-medium">Diagnosis:</div>
                            <div className="text-muted-foreground">{selectedWSI.diagnosis}</div>
                          </div>
                          <div>
                            <div className="font-medium">File Format:</div>
                            <div className="text-muted-foreground">{selectedWSI.fileFormat.toUpperCase()}</div>
                          </div>
                        </div>

                        <div className="text-sm">
                          <div className="font-medium">Clinical History:</div>
                          <div className="text-muted-foreground text-xs mt-1">
                            {selectedWSI.slide.clinical_history}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {selectedWSI && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    WSI Viewer
                    <div className="flex items-center gap-2">
                      {getStatusBadge(selectedWSI.embeddingStatus)}
                      <Badge variant="outline">{selectedWSI.fileFormat.toUpperCase()}</Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedWSI.embeddingStatus === 'raw_file' ? (
                    <WSIEmbeddingViewer
                      url={selectedWSI.slide_url}
                      filename={selectedWSI.slide_url.split('/').pop()}
                      diagnosis={selectedWSI.diagnosis}
                    />
                  ) : (
                    <WSIViewer
                      slide={selectedWSI.slide}
                      showMetadata={false}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Testing Controls Side */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  LLM Testing Interface
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="model-select" className="text-sm font-medium">
                    Select AI Model:
                  </Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aiModels.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{model.name}</span>
                            <Badge variant="outline" className="ml-2 text-xs">
                              {model.provider}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Model Parameters */}
                {selectedModel && (
                  <div className="bg-muted/30 p-3 rounded-lg text-sm">
                    <div className="font-medium mb-2">Model Parameters:</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Temperature:</span>
                        <span className="ml-1">{aiModels.find(m => m.id === selectedModel)?.temperature || 0.7}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Max Tokens:</span>
                        <span className="ml-1">{aiModels.find(m => m.id === selectedModel)?.maxTokens || 4000}</span>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={generateQuestion}
                  disabled={testing || !selectedWSI}
                  className="w-full"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Generate Question
                </Button>

                {!selectedWSI && (
                  <p className="text-sm text-muted-foreground text-center">
                    Select a WSI source to generate questions
                  </p>
                )}
              </CardContent>
            </Card>

          {/* Test Results */}
          {testResult && (
            <div className="space-y-4">
              {/* Prompt Display */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    AI Prompt
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setShowPrompt(!showPrompt)}
                        variant="ghost"
                        size="sm"
                      >
                        {showPrompt ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        onClick={() => copyToClipboard(testResult.prompt)}
                        variant="ghost"
                        size="sm"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                {showPrompt && (
                  <CardContent>
                    <div className="bg-muted p-3 rounded-lg text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {testResult.prompt}
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Generated Question */}
              {testResult.success && testResult.generatedQuestion && (
                <Card>
                  <CardHeader>
                    <CardTitle>Generated Question</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="font-medium mb-2">Question Stem:</div>
                      <div className="text-sm bg-muted p-3 rounded-lg">
                        {testResult.generatedQuestion.stem}
                      </div>
                    </div>

                    <div>
                      <div className="font-medium mb-2">Answer Options:</div>
                      <div className="space-y-2">
                        {testResult.generatedQuestion.options.map((option: any) => (
                          <div key={option.id} className={`p-2 rounded border ${option.is_correct ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                            <div className="font-medium text-sm">
                              {option.id}. {option.text}
                              {option.is_correct && <Badge className="ml-2 bg-green-100 text-green-800">Correct</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {option.explanation}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="font-medium mb-2">Teaching Point:</div>
                      <div className="text-sm bg-blue-50 p-3 rounded-lg">
                        {testResult.generatedQuestion.teaching_point}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>Generated in {testResult.timing}ms</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{testResult.model}</Badge>
                        <span>T: {testResult.parameters.temperature}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Error Display */}
              {testResult && testResult.error && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-amber-600">Debug Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-amber-600 mb-2">
                      {testResult.error}
                    </div>
                    {testResult.generatedQuestion && (
                      <div className="text-xs text-muted-foreground">
                        Fallback mock response is displayed above for interface testing.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
