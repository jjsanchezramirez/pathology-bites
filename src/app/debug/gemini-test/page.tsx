'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Textarea } from '@/shared/components/ui/textarea'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { Loader2, Send, Copy, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string
      }>
    }
    finishReason?: string
    index?: number
    safetyRatings?: Array<{
      category: string
      probability: string
    }>
  }>
  promptFeedback?: {
    safetyRatings?: Array<{
      category: string
      probability: string
    }>
  }
  error?: {
    code: number
    message: string
    status: string
  }
}

export default function GeminiTestPage() {
  const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '')
  const [prompt, setPrompt] = useState('Explain how AI works in a few words')
  const [model, setModel] = useState('gemini-2.0-flash')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<GeminiResponse | null>(null)
  const [rawResponse, setRawResponse] = useState('')

  const testGeminiAPI = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter your API key')
      return
    }

    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    setLoading(true)
    setResponse(null)
    setRawResponse('')

    try {
      // Call our API route instead of calling Gemini directly
      const response = await fetch('/api/debug/gemini-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          model,
          prompt
        })
      })

      const data = await response.json()
      setRawResponse(JSON.stringify(data, null, 2))
      setResponse(data)

      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        toast.success('API call successful!')
      } else if (data.error) {
        toast.error(`API Error: ${data.error.message}`)
      } else {
        toast.warning('Unexpected response format')
      }
    } catch (error) {
      console.error('Gemini API test error:', error)
      toast.error('Failed to call Gemini API')
      setRawResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Google AI Studio (Gemini) API Test</h1>
        <p className="text-muted-foreground">
          Test the Gemini API with different models and prompts. Based on the{' '}
          <a 
            href="https://ai.google.dev/gemini-api/docs/quickstart?lang=python" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            official quickstart guide
          </a>
        </p>
      </div>

      <div className="grid gap-6">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>API Configuration</CardTitle>
            <CardDescription>Configure your Gemini API settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key"
              />
            </div>
            
            <div>
              <Label htmlFor="model">Model</Label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full p-2 border border-input rounded-md bg-background"
              >
                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                <option value="gemini-pro">gemini-pro</option>
              </select>
            </div>

            <div>
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                rows={3}
              />
            </div>

            <Button onClick={testGeminiAPI} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing API...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Test Gemini API
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Response */}
        {response && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                API Response
                {response.error ? (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Error
                  </Badge>
                ) : (
                  <Badge variant="default" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Success
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {response.error ? (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                  <h4 className="font-semibold text-destructive mb-2">Error Details</h4>
                  <p><strong>Code:</strong> {response.error.code}</p>
                  <p><strong>Status:</strong> {response.error.status}</p>
                  <p><strong>Message:</strong> {response.error.message}</p>
                </div>
              ) : response.candidates?.[0]?.content?.parts?.[0]?.text ? (
                <div className="p-4 bg-muted rounded-md">
                  <h4 className="font-semibold mb-2">Generated Text</h4>
                  <p className="whitespace-pre-wrap">{response.candidates[0].content.parts[0].text}</p>
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Raw JSON Response</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(rawResponse)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto max-h-96">
                  <code>{rawResponse}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
