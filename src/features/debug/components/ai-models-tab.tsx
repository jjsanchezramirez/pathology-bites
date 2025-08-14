// src/features/debug/components/ai-models-tab.tsx
/**
 * AI Models Tab - Test AI models and APIs with unified configuration
 */

'use client'

import { useState } from 'react'
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
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { ACTIVE_AI_MODELS, DISABLED_AI_MODELS, hasApiKey, getModelProvider } from '@/shared/config/ai-models'

// Get all models with API key availability check
const getAvailableModels = () => {
  const allModels = [...ACTIVE_AI_MODELS, ...DISABLED_AI_MODELS]
  return allModels.map(model => ({
    ...model,
    available: model.available && hasApiKey(getModelProvider(model.id)),
    providerName: model.provider.charAt(0).toUpperCase() + model.provider.slice(1)
  }))
}

export function AiModelsTab() {
  const availableModels = getAvailableModels()
  const [selectedModel, setSelectedModel] = useState(availableModels.find(m => m.available)?.id || 'gemini-1.5-flash')
  const [prompt, setPrompt] = useState('Create a pathology MCQ following the ABP format.')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [responseTime, setResponseTime] = useState<number | null>(null)

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
      toast.success('AI model test completed')
    } catch (error) {
      console.error('AI test error:', error)
      setResponse({ error: error instanceof Error ? error.message : 'Unknown error' })
      toast.error('AI model test failed')
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

            {/* Test Button */}
            <Button 
              onClick={handleTestModel} 
              disabled={loading || !selectedModelInfo?.available}
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
                  <p className="font-medium text-destructive">Error</p>
                  <p className="text-sm text-destructive/80">{response.error}</p>
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
    </div>
  )
}
