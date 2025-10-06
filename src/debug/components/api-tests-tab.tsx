// src/features/debug/components/api-tests-tab.tsx
/**
 * API Tests Tab - Test various API endpoints
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import {
  TestTube,
  Send,
  Copy,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

// Available API endpoints for testing
const API_ENDPOINTS = [
  { id: 'health', name: 'Health Check', path: '/api/public/health', method: 'GET' },
  { id: 'stats', name: 'Public Stats', path: '/api/public/stats', method: 'GET' },
  { id: 'quiz-options', name: 'Quiz Options', path: '/api/content/quiz/options', method: 'GET' },
  { id: 'demo-questions', name: 'Demo Questions', path: '/api/content/demo-questions', method: 'GET' },
  { id: 'virtual-slides', name: 'Virtual Slides', path: '/api/public/data/virtual-slides', method: 'GET' },
]

export function ApiTestsTab() {
  const [selectedEndpoint, setSelectedEndpoint] = useState('health')
  const [customPath, setCustomPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [responseTime, setResponseTime] = useState<number | null>(null)
  const [statusCode, setStatusCode] = useState<number | null>(null)

  const handleTestEndpoint = async () => {
    const endpoint = API_ENDPOINTS.find(e => e.id === selectedEndpoint)
    const path = customPath || endpoint?.path
    
    if (!path) {
      toast.error('Please select an endpoint or enter a custom path')
      return
    }

    setLoading(true)
    setResponse(null)
    setResponseTime(null)
    setStatusCode(null)

    const startTime = Date.now()

    try {
      const res = await fetch(path, {
        method: endpoint?.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const endTime = Date.now()
      setResponseTime(endTime - startTime)
      setStatusCode(res.status)

      let data
      const contentType = res.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        data = await res.json()
      } else {
        data = await res.text()
      }

      setResponse(data)
      
      if (res.ok) {
        toast.success('API test completed successfully')
      } else {
        toast.error(`API test failed with status ${res.status}`)
      }
    } catch (error) {
      console.error('API test error:', error)
      setResponse({ error: error instanceof Error ? error.message : 'Unknown error' })
      toast.error('API test failed')
    } finally {
      setLoading(false)
    }
  }

  const copyResponse = () => {
    if (response) {
      const content = typeof response === 'string' ? response : JSON.stringify(response, null, 2)
      navigator.clipboard.writeText(content)
      toast.success('Response copied to clipboard')
    }
  }

  const selectedEndpointInfo = API_ENDPOINTS.find(e => e.id === selectedEndpoint)

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            API Endpoint Testing
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Test various API endpoints to verify functionality and response times.
          </p>
        </CardHeader>
      </Card>

      {/* API Testing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Endpoint Selection */}
            <div className="space-y-2">
              <Label htmlFor="endpoint-select">API Endpoint</Label>
              <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an endpoint" />
                </SelectTrigger>
                <SelectContent>
                  {API_ENDPOINTS.map((endpoint) => (
                    <SelectItem key={endpoint.id} value={endpoint.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{endpoint.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {endpoint.method}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEndpointInfo && (
                <div className="text-sm text-muted-foreground">
                  <code>{selectedEndpointInfo.method} {selectedEndpointInfo.path}</code>
                </div>
              )}
            </div>

            {/* Custom Path */}
            <div className="space-y-2">
              <Label htmlFor="custom-path">Custom Path (optional)</Label>
              <Input
                id="custom-path"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="/api/custom/endpoint"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the selected endpoint path
              </p>
            </div>

            {/* Test Button */}
            <Button 
              onClick={handleTestEndpoint} 
              disabled={loading}
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
                  Test Endpoint
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
                  {statusCode && (
                    <Badge variant={statusCode < 400 ? 'default' : 'destructive'}>
                      {statusCode}
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
                <TestTube className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No response yet. Test an endpoint to see results.</p>
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
                    <p className="text-sm text-green-700">API responded successfully</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Response Content</Label>
                  <div className="p-4 bg-muted rounded-lg max-h-96 overflow-auto">
                    <pre className="text-sm whitespace-pre-wrap">
                      {typeof response === 'string' 
                        ? response 
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
