'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
import {
  Bot,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  Zap
} from 'lucide-react'
import { toast } from 'sonner'

interface LlamaModel {
  id: string
  name: string
  description: string
  contextLength: string
  available: boolean
}

interface LlamaResponse {
  choices?: Array<{
    message: {
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  error?: {
    message: string
    helpfulMessage?: string
    details?: any
  }
}

export default function LlamaDebugPage() {
  // State
  const [selectedModel, setSelectedModel] = useState('Llama-3.3-70B-Instruct')
  const [prompt, setPrompt] = useState('Create a pathology MCQ about liver cirrhosis following the ABP format.')
  const [instructions, setInstructions] = useState('You are an expert pathologist creating educational content for board preparation.')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<LlamaResponse | null>(null)
  const [rawResponse, setRawResponse] = useState('')

  // LLAMA models from the official API documentation
  const llamaModels: LlamaModel[] = [
    {
      id: 'Llama-3.3-70B-Instruct',
      name: 'LLAMA 3.3 70B Instruct',
      description: 'Latest LLAMA 3.3 model with 70B parameters',
      contextLength: '128K tokens',
      available: true
    },
    {
      id: 'Llama-3.3-8B-Instruct',
      name: 'LLAMA 3.3 8B Instruct',
      description: 'Smaller LLAMA 3.3 model with 8B parameters',
      contextLength: '128K tokens',
      available: true
    },
    {
      id: 'Llama-4-Maverick-17B-128E-Instruct-FP8',
      name: 'LLAMA 4 Maverick 17B',
      description: 'Latest LLAMA 4 model with enhanced capabilities',
      contextLength: '128K tokens',
      available: true
    },
    {
      id: 'Llama-4-Scout-17B-16E-Instruct-FP8',
      name: 'LLAMA 4 Scout 17B',
      description: 'LLAMA 4 Scout model optimized for efficiency',
      contextLength: '128K tokens',
      available: true
    }
  ]

  const testLlamaAPI = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    setLoading(true)
    setResponse(null)
    setRawResponse('')

    try {
      const apiResponse = await fetch('/api/debug/llama-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: process.env.NEXT_PUBLIC_LLAMA_API_KEY || '',
          model: selectedModel,
          prompt,
          instructions: instructions.trim() || undefined
        })
      })

      const data = await apiResponse.json()
      setRawResponse(JSON.stringify(data, null, 2))
      setResponse(data)

      if (apiResponse.ok && !data.error) {
        toast.success('LLAMA API call successful!')
      } else {
        toast.error(`LLAMA API Error: ${data.error?.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('LLAMA API test error:', error)
      toast.error('Failed to call LLAMA API')
      setRawResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const selectedModelInfo = llamaModels.find(m => m.id === selectedModel)

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Bot className="h-10 w-10 text-purple-600" />
              <h1 className="text-4xl font-bold">LLAMA API Debug</h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Test and debug Meta's LLAMA models through the official LLAMA API.
              Build with the latest LLAMA 4 models for pathology content generation.
            </p>
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mt-6">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span>{llamaModels.length} LLAMA Models</span>
              </div>
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                <a 
                  href="https://llama.developer.meta.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-purple-600 transition-colors"
                >
                  Official LLAMA API
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  LLAMA Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Model Selection */}
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {llamaModels.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{model.name}</span>
                            {!model.available && (
                              <Badge variant="secondary" className="ml-2">Unavailable</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedModelInfo && (
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">{selectedModelInfo.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Context Length: {selectedModelInfo.contextLength}
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Instructions */}
                <div>
                  <Label htmlFor="instructions">System Instructions (Optional)</Label>
                  <Textarea
                    id="instructions"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Enter system instructions for the model..."
                    className="min-h-[80px]"
                  />
                </div>

                {/* Prompt */}
                <div>
                  <Label htmlFor="prompt">Prompt</Label>
                  <Textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter your prompt here..."
                    className="min-h-[120px]"
                  />
                </div>

                {/* Test Button */}
                <Button onClick={testLlamaAPI} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing LLAMA API...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Test LLAMA API
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Response Panel */}
          <div className="space-y-6">
            {response && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {response.error ? (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                      Response
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(response.choices?.[0]?.message?.content || rawResponse)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {response.error ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-red-800 font-medium">{response.error.message}</p>
                        {response.error.helpfulMessage && (
                          <p className="text-red-700 text-sm mt-2 whitespace-pre-line">
                            {response.error.helpfulMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-md">
                        <p className="whitespace-pre-wrap text-sm">
                          {response.choices?.[0]?.message?.content || 'No content received'}
                        </p>
                      </div>
                      
                      {response.usage && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Tokens: {response.usage.total_tokens || 'N/A'}</span>
                          <span>Prompt: {response.usage.prompt_tokens || 'N/A'}</span>
                          <span>Completion: {response.usage.completion_tokens || 'N/A'}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {rawResponse && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Raw Response
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(rawResponse)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-96">
                    {rawResponse}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
