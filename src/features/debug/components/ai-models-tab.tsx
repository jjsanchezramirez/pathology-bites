// src/features/debug/components/ai-models-tab.tsx
/**
 * AI Models Tab - Test AI models and APIs with unified configuration
 */

'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import {
  Bot,
  Send,
  Copy,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Play,
  Hash
} from 'lucide-react'
import { toast } from 'sonner'
import { ACTIVE_AI_MODELS, DISABLED_AI_MODELS, hasApiKey, getModelProvider, getModelById } from '@/shared/config/ai-models'

// Get all models with API key availability check
const getAvailableModels = () => {
  const allModels = [...ACTIVE_AI_MODELS, ...DISABLED_AI_MODELS]
  return allModels.map(model => ({
    ...model,
    available: model.available && hasApiKey(getModelProvider(model.id)),
    providerName: model.provider.charAt(0).toUpperCase() + model.provider.slice(1)
  }))
}

// Get only models for Gemini, Mistral, and Meta (excluding ChatGPT and Claude)
const getTargetModels = () => {
  return getAvailableModels().filter(model => 
    ['gemini', 'mistral', 'llama'].includes(model.provider) && model.available
  )
}

export function AiModelsTab() {
  const availableModels = getAvailableModels()
  const [selectedModel, setSelectedModel] = useState(availableModels.find(m => m.available)?.id || 'gemini-1.5-flash')
  const [prompt, setPrompt] = useState('Create a pathology MCQ following the ABP format.')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [responseTime, setResponseTime] = useState<number | null>(null)
  const [testAllLoading, setTestAllLoading] = useState(false)
  const [batchResults, setBatchResults] = useState<Record<string, any>>({})
  const [tokenCounts, setTokenCounts] = useState<Record<string, number>>({})

  const handleTestModel = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    setLoading(true)
    setResponse(null)
    setResponseTime(null)

    const startTime = Date.now()

    try {
      const res = await fetch('/api/debug/ai-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          prompt: prompt,
        }),
      })

      const endTime = Date.now()
      setResponseTime(endTime - startTime)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()
      setResponse(data)
      
      // Track token count if available
      if (data.tokenCount) {
        setTokenCounts(prev => ({ ...prev, [selectedModel]: data.tokenCount }))
      }
      
      toast.success('AI model test completed')
    } catch (error) {
      console.error('AI test error:', error)
      
      let errorMessage = 'Unknown error'
      let errorType = 'unknown'
      
      if (error instanceof Error) {
        errorMessage = error.message
        
        // Parse specific error types
        if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
          errorType = 'unauthorized'
          errorMessage = 'Unauthorized - Check your API key'
        } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
          errorType = 'rate_limit'
          errorMessage = 'Rate limit exceeded - Try again later'
        } else if (errorMessage.includes('402') || errorMessage.includes('quota')) {
          errorType = 'quota_exceeded'
          errorMessage = 'Quota exceeded - Check your billing/usage'
        } else if (errorMessage.includes('403')) {
          errorType = 'forbidden'
          errorMessage = 'Forbidden - Check your API permissions'
        } else if (errorMessage.includes('timeout')) {
          errorType = 'timeout'
          errorMessage = 'Request timeout - Model may be overloaded'
        }
      }
      
      setResponse({ 
        error: errorMessage, 
        errorType,
        timestamp: new Date().toISOString()
      })
      toast.error(`AI model test failed: ${errorType}`)
    } finally {
      setLoading(false)
    }
  }

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response, null, 2))
      toast.success('Response copied to clipboard')
    }
  }

  const testAllModels = useCallback(async () => {
    const targetModels = getTargetModels()
    
    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    if (targetModels.length === 0) {
      toast.error('No available models to test')
      return
    }

    setTestAllLoading(true)
    setBatchResults({})
    setTokenCounts({})
    
    const results: Record<string, any> = {}
    const tokens: Record<string, number> = {}
    let successCount = 0
    let errorCount = 0

    toast.info(`Testing ${targetModels.length} models...`)

    // Test models in batches to avoid overwhelming APIs
    const batchSize = 3
    for (let i = 0; i < targetModels.length; i += batchSize) {
      const batch = targetModels.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (model) => {
        const startTime = Date.now()
        
        try {
          const res = await fetch('/api/debug/ai-test', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: model.id,
              prompt: prompt,
            }),
          })

          const endTime = Date.now()
          const responseTime = endTime - startTime

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          }

          const data = await res.json()
          
          results[model.id] = {
            ...data,
            responseTime,
            status: 'success',
            modelName: model.name
          }
          
          if (data.tokenCount) {
            tokens[model.id] = data.tokenCount
          }
          
          successCount++
        } catch (error) {
          let errorMessage = 'Unknown error'
          let errorType = 'unknown'
          
          if (error instanceof Error) {
            errorMessage = error.message
            
            if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
              errorType = 'unauthorized'
            } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
              errorType = 'rate_limit'
            } else if (errorMessage.includes('402') || errorMessage.includes('quota')) {
              errorType = 'quota_exceeded'
            } else if (errorMessage.includes('403')) {
              errorType = 'forbidden'
            } else if (errorMessage.includes('timeout')) {
              errorType = 'timeout'
            }
          }
          
          results[model.id] = {
            status: 'error',
            error: errorMessage,
            errorType,
            modelName: model.name,
            responseTime: Date.now() - startTime
          }
          
          errorCount++
        }
        
        // Update UI with progress
        setBatchResults(prev => ({ ...prev, [model.id]: results[model.id] }))
        setTokenCounts(prev => ({ ...prev, ...tokens }))
      })

      await Promise.all(batchPromises)
      
      // Small delay between batches
      if (i + batchSize < targetModels.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    setTestAllLoading(false)
    toast.success(`Batch test completed: ${successCount} succeeded, ${errorCount} failed`)
  }, [prompt])

  const selectedModelInfo = availableModels.find(m => m.id === selectedModel)

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Models Testing
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Test different AI models with custom prompts and compare responses.
          </p>
        </CardHeader>
      </Card>

      {/* Model Selection and Testing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model-select">AI Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id} disabled={!model.available}>
                      <div className="flex items-center justify-between w-full">
                        <span className={!model.available ? 'text-muted-foreground' : ''}>{model.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {model.providerName}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedModelInfo && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant={selectedModelInfo.available ? 'default' : 'destructive'}>
                    {selectedModelInfo.available ? 'Available' : 'Unavailable'}
                  </Badge>
                  <span>{selectedModelInfo.providerName}</span>
                  {selectedModelInfo.description && (
                    <span className="text-xs">• {selectedModelInfo.description}</span>
                  )}
                </div>
              )}
            </div>

            {/* Prompt Input */}
            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                rows={6}
              />
            </div>

            {/* Test Buttons */}
            <div className="space-y-2">
              <Button 
                onClick={handleTestModel} 
                disabled={loading || testAllLoading || !selectedModelInfo?.available}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Test Model
                  </>
                )}
              </Button>
              
              <Button 
                onClick={testAllModels}
                disabled={loading || testAllLoading}
                variant="outline"
                className="w-full"
              >
                {testAllLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Testing All Models...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Test All Available Models ({getTargetModels().length})
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Response Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Response</CardTitle>
              {response && (
                <div className="flex items-center gap-2">
                  {responseTime && (
                    <Badge variant="outline">
                      {responseTime}ms
                    </Badge>
                  )}
                  {tokenCounts[selectedModel] && (
                    <Badge variant="outline" className="bg-blue-50">
                      <Hash className="h-3 w-3 mr-1" />
                      {tokenCounts[selectedModel]} tokens
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" onClick={copyResponse}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!response ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No response yet. Test a model to see results.</p>
              </div>
            ) : response.error ? (
              <div className="flex items-start gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Error ({response.errorType || 'unknown'})</p>
                  <p className="text-sm text-destructive/80">{response.error}</p>
                  {response.timestamp && (
                    <p className="text-xs text-destructive/60 mt-1">
                      {new Date(response.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">Success</p>
                    <p className="text-sm text-green-700">Model responded successfully</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Response Content</Label>
                  <div className="p-4 bg-muted rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap">
                      {typeof response.content === 'string' 
                        ? response.content 
                        : JSON.stringify(response, null, 2)
                      }
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Batch Test Results */}
      {Object.keys(batchResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Batch Test Results</CardTitle>
            <p className="text-sm text-muted-foreground">
              Results from testing multiple models simultaneously
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(batchResults).map(([modelId, result]) => {
                const model = getModelById(modelId)
                return (
                  <div key={modelId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{result.modelName || model?.name || modelId}</h4>
                        <Badge variant="outline">{model?.provider}</Badge>
                        {result.status === 'success' ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {result.responseTime && (
                          <span>{result.responseTime}ms</span>
                        )}
                        {tokenCounts[modelId] && (
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {tokenCounts[modelId]} tokens
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {result.status === 'error' ? (
                      <div className="text-sm text-destructive">
                        <span className="font-medium">{result.errorType}:</span> {result.error}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto">
                        {typeof result.content === 'string' 
                          ? result.content.substring(0, 200) + (result.content.length > 200 ? '...' : '')
                          : JSON.stringify(result.content).substring(0, 200) + '...'
                        }
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
