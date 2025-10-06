'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Progress } from '@/shared/components/ui/progress'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { 
  Play, 
  Square, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Brain, 
  BookOpen,
  Target,
  AlertTriangle,
  BarChart3
} from 'lucide-react'
import { toast } from 'sonner'

// Admin AI Models (from the actual admin system)
const ADMIN_AI_MODELS = [
  // Tier 1: FASTEST
  'Llama-3.3-8B-Instruct',
  'ministral-8b-2410',
  'gemini-1.5-flash',
  'mistral-small-2501',
  'gemini-2.0-flash',
  
  // Tier 2: BALANCED
  'Llama-4-Scout-17B-16E-Instruct-FP8',
  'mistral-medium-2505',
  
  // Tier 3: POWERFUL
  'Llama-3.3-70B-Instruct',
  'Llama-4-Maverick-17B-128E-Instruct-FP8',
  
  // Tier 4: PREMIUM
  'gemini-2.5-flash',
  'gemini-2.5-pro'
]

// Educational content contexts for testing
const EDUCATIONAL_CONTEXTS = [
  {
    category: 'Pathology',
    subject: 'General Pathology',
    lesson: 'Cell Injury and Death',
    topic: 'Apoptosis',
    content: {
      title: 'Apoptosis - Programmed Cell Death',
      description: 'Apoptosis is a form of programmed cell death that occurs in multicellular organisms. It is characterized by specific morphological changes including cell shrinkage, chromatin condensation, and formation of apoptotic bodies.',
      keyPoints: [
        'Energy-dependent process',
        'Cell shrinkage and chromatin condensation',
        'Formation of apoptotic bodies',
        'No inflammatory response',
        'Regulated by caspases'
      ]
    }
  },
  {
    category: 'Pathology',
    subject: 'General Pathology',
    lesson: 'Inflammation',
    topic: 'Acute Inflammation',
    content: {
      title: 'Acute Inflammation',
      description: 'Acute inflammation is the immediate response to tissue injury characterized by vascular changes and cellular infiltration.',
      keyPoints: [
        'Vasodilation',
        'Increased vascular permeability',
        'Neutrophil infiltration',
        'Cardinal signs of inflammation'
      ]
    }
  },
  {
    category: 'Pathology',
    subject: 'Systemic Pathology',
    lesson: 'Cardiovascular',
    topic: 'Atherosclerosis',
    content: {
      title: 'Atherosclerosis',
      description: 'Atherosclerosis is a disease of large and medium-sized arteries characterized by the formation of atherosclerotic plaques.',
      keyPoints: [
        'Endothelial dysfunction',
        'Lipid accumulation',
        'Inflammatory response',
        'Plaque formation'
      ]
    }
  },
  {
    category: 'Pathology',
    subject: 'General Pathology',
    lesson: 'Cell Injury and Death',
    topic: 'Necrosis',
    content: {
      title: 'Necrosis - Cell Death',
      description: 'Necrosis is a form of cell death characterized by cellular swelling, membrane disruption, and inflammatory response.',
      keyPoints: [
        'Energy-independent process',
        'Cellular swelling',
        'Membrane disruption',
        'Inflammatory response',
        'Uncontrolled process'
      ]
    }
  },
  {
    category: 'Pathology',
    subject: 'Systemic Pathology',
    lesson: 'Respiratory',
    topic: 'Pneumonia',
    content: {
      title: 'Pneumonia',
      description: 'Pneumonia is an inflammatory condition of the lung affecting primarily the small air sacs known as alveoli.',
      keyPoints: [
        'Alveolar inflammation',
        'Bacterial, viral, or fungal etiology',
        'Consolidation patterns',
        'Clinical presentation varies'
      ]
    }
  }
]

interface TestResult {
  model: string
  context: typeof EDUCATIONAL_CONTEXTS[0]
  success: boolean
  error?: string
  generationTime?: number
  tokenUsage?: any
  question?: any
  parsingStrategy?: string
  timestamp: Date
}

export function AdminAiTest() {
  const [isRunning, setIsRunning] = useState(false)
  const [currentModelIndex, setCurrentModelIndex] = useState(0)
  const [currentContextIndex, setCurrentContextIndex] = useState(0)
  const [results, setResults] = useState<TestResult[]>([])
  const [progress, setProgress] = useState(0)
  const [currentTest, setCurrentTest] = useState<string>('')

  const getRandomContext = () => {
    return EDUCATIONAL_CONTEXTS[Math.floor(Math.random() * EDUCATIONAL_CONTEXTS.length)]
  }

  const testSingleModel = async (model: string): Promise<TestResult> => {
    const context = getRandomContext()
    const startTime = Date.now()
    
    setCurrentTest(`Testing ${model} with ${context.topic}`)

    try {
      const response = await fetch('/api/admin/question-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          context: context,
          instructions: 'Create a multiple-choice question with 4 options. Focus on key concepts and include detailed explanations for each option. The question should test understanding of the topic and include clinical correlation where appropriate.'
        })
      })

      const generationTime = Date.now() - startTime

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Generation failed')
      }

      // Determine parsing strategy used (simulated based on response format)
      let parsingStrategy = 'Unknown'
      if (data.question) {
        parsingStrategy = 'Direct JSON'
        if (data.metadata?.parsing_strategy) {
          parsingStrategy = data.metadata.parsing_strategy
        }
      }

      return {
        model,
        context,
        success: true,
        generationTime,
        tokenUsage: data.metadata?.token_usage,
        question: data.question,
        parsingStrategy,
        timestamp: new Date()
      }

    } catch (error) {
      const generationTime = Date.now() - startTime
      return {
        model,
        context,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        generationTime,
        timestamp: new Date()
      }
    }
  }

  const runComprehensiveTest = async () => {
    if (isRunning) return

    setIsRunning(true)
    setResults([])
    setProgress(0)
    setCurrentModelIndex(0)
    
    const totalTests = ADMIN_AI_MODELS.length
    const newResults: TestResult[] = []

    try {
      for (let i = 0; i < ADMIN_AI_MODELS.length; i++) {
        if (!isRunning) break // Allow stopping

        const model = ADMIN_AI_MODELS[i]
        setCurrentModelIndex(i)
        
        console.log(`[Admin AI Test] Testing model ${i + 1}/${totalTests}: ${model}`)
        
        const result = await testSingleModel(model)
        newResults.push(result)
        setResults([...newResults])
        
        const progressPercent = ((i + 1) / totalTests) * 100
        setProgress(progressPercent)
        
        // Brief pause between tests to avoid rate limiting
        if (i < ADMIN_AI_MODELS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      if (isRunning) {
        toast.success(`Comprehensive test completed! ${newResults.filter(r => r.success).length}/${totalTests} models successful`)
      }

    } catch (error) {
      console.error('Test suite error:', error)
      toast.error('Test suite encountered an error')
    } finally {
      setIsRunning(false)
      setCurrentTest('')
    }
  }

  const stopTest = () => {
    setIsRunning(false)
    setCurrentTest('Stopping...')
    toast.info('Test suite stopped')
  }

  const testQuickSample = async () => {
    if (isRunning) return

    setIsRunning(true)
    setResults([])
    setProgress(0)

    // Test just the first 3 models for quick validation
    const quickModels = ADMIN_AI_MODELS.slice(0, 3)
    const newResults: TestResult[] = []

    try {
      for (let i = 0; i < quickModels.length; i++) {
        if (!isRunning) break

        const model = quickModels[i]
        setCurrentModelIndex(i)

        console.log(`[Quick Test] Testing model ${i + 1}/${quickModels.length}: ${model}`)

        const result = await testSingleModel(model)
        newResults.push(result)
        setResults([...newResults])

        const progressPercent = ((i + 1) / quickModels.length) * 100
        setProgress(progressPercent)

        // Brief pause between tests
        if (i < quickModels.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      if (isRunning) {
        toast.success(`Quick test completed! ${newResults.filter(r => r.success).length}/${quickModels.length} models successful`)
      }

    } catch (error) {
      console.error('Quick test error:', error)
      toast.error('Quick test encountered an error')
    } finally {
      setIsRunning(false)
      setCurrentTest('')
    }
  }

  const testSingleModelById = async (modelId: string) => {
    if (isRunning) return

    setIsRunning(true)
    setCurrentTest(`Testing ${modelId}...`)

    try {
      const result = await testSingleModel(modelId)
      setResults(prev => {
        const filtered = prev.filter(r => r.model !== modelId)
        return [...filtered, result]
      })

      if (result.success) {
        toast.success(`${modelId} test successful!`)
      } else {
        toast.error(`${modelId} test failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Single model test error:', error)
      toast.error('Single model test failed')
    } finally {
      setIsRunning(false)
      setCurrentTest('')
    }
  }

  const successfulTests = results.filter(r => r.success)
  const failedTests = results.filter(r => !r.success)
  const averageTime = successfulTests.length > 0 
    ? Math.round(successfulTests.reduce((sum, r) => sum + (r.generationTime || 0), 0) / successfulTests.length)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Admin AI Question Generator - Comprehensive Test Suite
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            Systematically test all {ADMIN_AI_MODELS.length} admin AI models with random educational contexts
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Button
                onClick={testQuickSample}
                disabled={isRunning}
                className="min-w-[140px]"
                variant="default"
              >
                {isRunning ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Quick Test (3 models)
                  </>
                )}
              </Button>

              <Button
                onClick={runComprehensiveTest}
                disabled={isRunning}
                variant="outline"
                className="min-w-[140px]"
              >
                {isRunning ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Target className="h-4 w-4 mr-2" />
                    Full Test Suite
                  </>
                )}
              </Button>

              {isRunning && (
                <Button onClick={stopTest} variant="destructive">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Quick: ~1 min | Full: ~{Math.ceil(ADMIN_AI_MODELS.length * 15 / 60)} min
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <strong>Quick Test:</strong> Tests first 3 models for rapid validation |
              <strong> Full Test:</strong> Tests all {ADMIN_AI_MODELS.length} models systematically
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {(isRunning || results.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Test Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress: {Math.round(progress)}%</span>
                <span>{results.length}/{ADMIN_AI_MODELS.length} models tested</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
            
            {currentTest && (
              <div className="text-sm text-muted-foreground">
                {currentTest}
              </div>
            )}
            
            {results.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Success: {successfulTests.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span>Failed: {failedTests.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span>Avg Time: {averageTime}ms</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  <span>Success Rate: {Math.round((successfulTests.length / results.length) * 100)}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Individual Model Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Individual Model Testing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {ADMIN_AI_MODELS.map((model, index) => {
              const result = results.find(r => r.model === model)
              const isSuccess = result?.success
              const isFailed = result && !result.success

              return (
                <Button
                  key={model}
                  onClick={() => testSingleModelById(model)}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className={`text-xs h-auto py-2 px-2 ${
                    isSuccess ? 'border-green-500 bg-green-50' :
                    isFailed ? 'border-red-500 bg-red-50' : ''
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                      {isSuccess && <CheckCircle className="h-3 w-3 text-green-600" />}
                      {isFailed && <XCircle className="h-3 w-3 text-red-600" />}
                      <span className="truncate max-w-[100px]">
                        {model.replace('Llama-', 'L').replace('Instruct', 'I').replace('gemini-', 'G').replace('mistral-', 'M')}
                      </span>
                    </div>
                    {result && (
                      <span className="text-xs text-muted-foreground">
                        {result.generationTime}ms
                      </span>
                    )}
                  </div>
                </Button>
              )
            })}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Click any model to test individually. Green = Success, Red = Failed, Gray = Not tested
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {results.length > 0 && !isRunning && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-green-600 mb-2">✅ Working Models ({successfulTests.length})</h4>
                <div className="space-y-1">
                  {successfulTests.map((result, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate">{result.model}</span>
                      <span className="text-muted-foreground">{result.generationTime}ms</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-red-600 mb-2">❌ Failed Models ({failedTests.length})</h4>
                <div className="space-y-1">
                  {failedTests.map((result, idx) => (
                    <div key={idx} className="flex flex-col">
                      <span className="truncate">{result.model}</span>
                      <span className="text-xs text-red-500">{result.error?.substring(0, 50)}...</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-blue-600 mb-2">📊 Performance Tiers</h4>
                <div className="space-y-1">
                  <div><span className="font-medium">Fast (&lt;1s):</span> {successfulTests.filter(r => (r.generationTime || 0) < 1000).length}</div>
                  <div><span className="font-medium">Medium (1-3s):</span> {successfulTests.filter(r => (r.generationTime || 0) >= 1000 && (r.generationTime || 0) < 3000).length}</div>
                  <div><span className="font-medium">Slow (&gt;3s):</span> {successfulTests.filter(r => (r.generationTime || 0) >= 3000).length}</div>
                  <div className="pt-2 border-t">
                    <span className="font-medium">Overall Success Rate:</span> {Math.round((successfulTests.length / results.length) * 100)}%
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detailed Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {results.map((result, index) => (
                  <Card key={index} className={`${result.success ? 'border-green-200' : 'border-red-200'}`}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {result.success ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-medium">{result.model}</span>
                            <Badge variant="outline">
                              {result.generationTime}ms
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {result.timestamp.toLocaleTimeString()}
                          </div>
                        </div>

                        {/* Context */}
                        <div className="flex items-center gap-2 text-sm">
                          <BookOpen className="h-3 w-3" />
                          <span>{result.context.category} → {result.context.subject} → {result.context.lesson} → {result.context.topic}</span>
                        </div>

                        {/* Success Details */}
                        {result.success && result.question && (
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-medium">Title:</span> {result.question.title}
                            </div>
                            <div>
                              <span className="font-medium">Stem:</span>
                              <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                                {result.question.stem?.substring(0, 200)}
                                {result.question.stem?.length > 200 ? '...' : ''}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">Difficulty:</span>
                              <Badge variant="outline" className="ml-2">
                                {result.question.difficulty}
                              </Badge>
                            </div>
                            <div>
                              <span className="font-medium">Teaching Point:</span>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {result.question.teaching_point?.substring(0, 150)}
                                {result.question.teaching_point?.length > 150 ? '...' : ''}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">Answer Options:</span> {result.question.answer_options?.length || 0}
                              {result.question.answer_options && (
                                <div className="mt-1 space-y-1">
                                  {result.question.answer_options.map((option: any, idx: number) => (
                                    <div key={idx} className={`text-xs p-2 rounded ${option.is_correct ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                                      <span className="font-medium">{String.fromCharCode(65 + idx)}.</span> {option.text?.substring(0, 100)}
                                      {option.text?.length > 100 ? '...' : ''}
                                      {option.is_correct && <Badge variant="outline" className="ml-2 text-xs">Correct</Badge>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {result.parsingStrategy && (
                              <div>
                                <span className="font-medium">Parsing Strategy:</span>
                                <Badge variant="outline" className="ml-2">
                                  {result.parsingStrategy}
                                </Badge>
                              </div>
                            )}
                            {result.tokenUsage && (
                              <div>
                                <span className="font-medium">Tokens:</span> {result.tokenUsage.total_tokens || 'N/A'}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Error Details */}
                        {!result.success && (
                          <div className="flex items-start gap-2 text-sm text-red-600">
                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{result.error}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
