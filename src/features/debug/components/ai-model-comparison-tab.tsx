// src/features/debug/components/ai-model-comparison-tab.tsx
/**
 * AI Model Comparison Tab - Comprehensive model testing and comparison
 * Enables simultaneous testing of multiple AI models with side-by-side results
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Progress } from '@/shared/components/ui/progress'
import {
  Bot,
  Send,
  Copy,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Play,
  Loader2,
  Clock,
  Zap,
  FileText,
  Settings,
  Brain,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { toast } from '@/shared/utils/toast'
import {
  ACTIVE_AI_MODELS,
  DISABLED_AI_MODELS,
  getModelProvider,
  getApiKey,
  DEFAULT_MODEL,
  type AIModel
} from '@/shared/config/ai-models'
import { ThinkingContentDisplay } from './thinking-content-display'

interface ModelTestResult {
  modelId: string
  modelName: string
  provider: string
  status: 'pending' | 'running' | 'success' | 'error'
  response?: string
  responseTime?: number
  tokenUsage?: {
    input?: number
    output?: number
    total?: number
  }
  error?: string
  startTime?: number
  thinkingContent?: string
  hasThinking?: boolean
}

interface ComparisonSession {
  id: string
  prompt: string
  timestamp: number
  results: ModelTestResult[]
}

export function AiModelComparisonTab() {
  // State management
  const [prompt, setPrompt] = useState('Explain how AI works in pathology in 2-3 sentences.')
  const [selectedModels, setSelectedModels] = useState<string[]>([DEFAULT_MODEL])
  const [testResults, setTestResults] = useState<ModelTestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [sessions, setSessions] = useState<ComparisonSession[]>([])
  const [showThinkingContent, setShowThinkingContent] = useState(true)

  // Get all models with prioritized ordering - including both active and disabled models  
  const allModels = [...ACTIVE_AI_MODELS, ...DISABLED_AI_MODELS]

  // Load sessions from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('ai-model-comparison-sessions')
    if (savedSessions) {
      try {
        setSessions(JSON.parse(savedSessions))
      } catch (error) {
        console.error('Failed to load sessions:', error)
      }
    }
  }, [])

  // Save sessions to localStorage
  const saveSessions = (newSessions: ComparisonSession[]) => {
    setSessions(newSessions)
    localStorage.setItem('ai-model-comparison-sessions', JSON.stringify(newSessions))
  }

  // Handle model selection
  const toggleModel = (modelId: string) => {
    setSelectedModels(prev => 
      prev.includes(modelId) 
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    )
  }

  // Select all available models (only active ones, disabled models can't be selected)
  const selectAllAvailable = () => {
    const availableModels = allModels.filter(m => m.available).map(m => m.id)
    setSelectedModels(availableModels)
  }

  // Clear all selections
  const clearSelection = () => {
    setSelectedModels([])
  }

  // Run comparison test
  const runComparison = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    if (selectedModels.length === 0) {
      toast.error('Please select at least one model')
      return
    }

    setIsRunning(true)
    setProgress(0)

    // Initialize results
    const initialResults: ModelTestResult[] = selectedModels.map(modelId => {
      const model = allModels.find(m => m.id === modelId)!
      return {
        modelId,
        modelName: model.name,
        provider: model.provider,
        status: 'pending'
      }
    })

    setTestResults(initialResults)

    // Use batch API for testing all models simultaneously
    try {
      const response = await fetch('/api/debug/batch-model-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          models: selectedModels,
          prompt,
          instructions: 'Provide a clear, concise response.'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // Safely extract error message from response
        let errorMessage = 'Batch test failed'
        if (data.error) {
          if (typeof data.error === 'string') {
            errorMessage = data.error
          } else if (typeof data.error === 'object' && data.error.message) {
            errorMessage = data.error.message
          } else if (typeof data.error === 'object') {
            errorMessage = JSON.stringify(data.error)
          }
        }
        throw new Error(errorMessage)
      }

      // Process results
      const results: ModelTestResult[] = data.results.map((result: any) => {
        const model = allModels.find(m => m.id === result.modelId)!

        // Ensure error is always a string if present
        let errorMessage: string | undefined = undefined
        if (result.error) {
          if (typeof result.error === 'string') {
            errorMessage = result.error
          } else if (typeof result.error === 'object') {
            errorMessage = result.error.message || JSON.stringify(result.error)
          }
        }

        return {
          modelId: result.modelId,
          modelName: model.name,
          provider: model.provider,
          status: result.status,
          response: result.response,
          responseTime: result.responseTime,
          tokenUsage: result.tokenUsage,
          error: errorMessage,
          thinkingContent: result.thinkingContent,
          hasThinking: result.hasThinking
        }
      })

      setTestResults(results)
      setProgress(100)

      // Save session
      const session: ComparisonSession = {
        id: Date.now().toString(),
        prompt,
        timestamp: Date.now(),
        results
      }

      saveSessions([session, ...sessions.slice(0, 9)]) // Keep last 10 sessions

      setIsRunning(false)
      toast.success(`Comparison completed! Tested ${results.length} models`)

    } catch (error) {
      console.error('Batch test error:', error)

      // Safely extract error message for toast
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error)
      }

      toast.error(`Batch test failed: ${errorMessage}`)

      // Set all results to error state
      const errorResults: ModelTestResult[] = selectedModels.map(modelId => {
        const model = allModels.find(m => m.id === modelId)!
        return {
          modelId,
          modelName: model.name,
          provider: model.provider,
          status: 'error',
          error: errorMessage
        }
      })

      setTestResults(errorResults)
      setProgress(100)
      setIsRunning(false)
    }
  }



  // Export results as JSON
  const exportAsJSON = () => {
    if (testResults.length === 0) {
      toast.error('No results to export')
      return
    }

    const exportData = {
      prompt,
      timestamp: new Date().toISOString(),
      results: testResults
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-model-comparison-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Results exported as JSON')
  }

  // Export results as CSV
  const exportAsCSV = () => {
    if (testResults.length === 0) {
      toast.error('No results to export')
      return
    }

    const headers = ['Model', 'Provider', 'Status', 'Response Time (ms)', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Response Length', 'Error']
    const rows = testResults.map(result => {
      const responseText = typeof result.response === 'string' ? result.response : JSON.stringify(result.response)
      return [
        result.modelName,
        result.provider,
        result.status,
        result.responseTime?.toString() || '',
        result.tokenUsage?.input?.toString() || '',
        result.tokenUsage?.output?.toString() || '',
        result.tokenUsage?.total?.toString() || '',
        responseText?.length.toString() || '',
        result.error || ''
      ]
    })

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-model-comparison-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Results exported as CSV')
  }

  // Copy result to clipboard
  const copyToClipboard = (text: string | any) => {
    const textToCopy = typeof text === 'string' ? text : JSON.stringify(text, null, 2)
    navigator.clipboard.writeText(textToCopy)
    toast.success('Copied to clipboard!')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">AI Model Comparison</h2>
        <p className="text-gray-600">Test and compare responses from multiple AI models simultaneously</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Test Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Prompt Input */}
              <div>
                <Label htmlFor="prompt">Test Prompt</Label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your test prompt here..."
                  rows={4}
                  disabled={isRunning}
                />
              </div>

              {/* Model Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Select Models ({selectedModels.length} selected)</Label>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllAvailable}
                      disabled={isRunning}
                    >
                      All AI Models
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                      disabled={isRunning}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {allModels.map(model => (
                    <div key={model.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={model.id}
                        checked={selectedModels.includes(model.id)}
                        onCheckedChange={() => toggleModel(model.id)}
                        disabled={isRunning || !model.available}
                      />
                      <label
                        htmlFor={model.id}
                        className={`flex-1 text-sm cursor-pointer ${
                          !model.available ? 'text-gray-400' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{model.name}</span>
                          <div className="flex items-center space-x-1">
                            <Badge 
                              variant={model.provider === 'gemini' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {model.provider}
                            </Badge>
                            {!model.available && (
                              <Badge variant="destructive" className="text-xs">
                                Unavailable
                              </Badge>
                            )}
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Run Test Button */}
              <Button
                onClick={runComparison}
                disabled={isRunning || selectedModels.length === 0 || !prompt.trim()}
                className="w-full"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing... ({Math.round(progress)}%)
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Comparison
                  </>
                )}
              </Button>

              {/* Thinking Content Toggle */}
              {testResults.some(r => r.hasThinking) && (
                <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded border border-blue-200">
                  <Checkbox
                    id="show-thinking"
                    checked={showThinkingContent}
                    onCheckedChange={(checked) => setShowThinkingContent(checked === true)}
                  />
                  <Label htmlFor="show-thinking" className="text-sm flex items-center space-x-1">
                    <Brain className="h-4 w-4 text-blue-600" />
                    <span>Show thinking process for models that provide it</span>
                  </Label>
                </div>
              )}

              {/* Progress Bar */}
              {isRunning && (
                <div className="space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-xs text-gray-500 text-center">
                    Testing {selectedModels.length} models...
                  </p>
                </div>
              )}

              {/* Export Buttons */}
              {testResults.length > 0 && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportAsJSON}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportAsCSV}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    CSV
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bot className="h-5 w-5" />
                <span>Comparison Results</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {testResults.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No test results yet. Configure your test and click "Run Comparison" to begin.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {testResults.map(result => (
                    <div key={result.modelId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{result.modelName}</h3>
                          <Badge variant="outline">{result.provider}</Badge>
                          {result.status === 'success' && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          )}
                          {result.status === 'error' && (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                          {result.status === 'running' && (
                            <Badge variant="secondary">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Running
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          {result.responseTime && (
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{result.responseTime}ms</span>
                            </div>
                          )}
                          {result.response && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(result.response!)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {result.error && (
                        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                          <p className="text-red-800 text-sm">
                            {typeof result.error === 'string'
                              ? result.error
                              : JSON.stringify(result.error)
                            }
                          </p>
                        </div>
                      )}

                      {result.hasThinking && result.thinkingContent && showThinkingContent && (
                        <div className="mb-3">
                          <ThinkingContentDisplay
                            thinkingContent={result.thinkingContent}
                            modelName={result.modelName}
                            onCopy={copyToClipboard}
                          />
                        </div>
                      )}

                      {result.response && (
                        <div className="bg-gray-50 rounded p-3 mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-600">Final Response</span>
                            {result.hasThinking && (
                              <Badge variant="outline" className="text-xs">
                                <Brain className="h-3 w-3 mr-1" />
                                Thinking Separated
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {typeof result.response === 'string'
                              ? result.response
                              : JSON.stringify(result.response, null, 2)
                            }
                          </p>
                        </div>
                      )}

                      {result.tokenUsage && (
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                          {result.tokenUsage.input && (
                            <span>Input: {result.tokenUsage.input} tokens</span>
                          )}
                          {result.tokenUsage.output && (
                            <span>Output: {result.tokenUsage.output} tokens</span>
                          )}
                          {result.tokenUsage.total && (
                            <span>Total: {result.tokenUsage.total} tokens</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
