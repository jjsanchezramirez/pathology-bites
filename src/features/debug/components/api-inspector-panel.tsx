// src/features/debug/components/api-inspector-panel.tsx
/**
 * API Inspector Panel - Interactive API client for testing endpoints
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { 
  Code, 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Copy,
  Plus,
  Trash2,
  Search,
  Filter,
  Download
} from 'lucide-react'
import { DebugPanelState, DebugAccessLevel, ApiEndpoint, ApiTestResult } from '@/shared/types/debug'
import { toast } from '@/shared/utils/toast'

interface ApiInspectorPanelProps {
  debugState: DebugPanelState
  executeAction: (action: string, payload?: any) => Promise<any>
  accessLevel: DebugAccessLevel
}

export function ApiInspectorPanel({ 
  debugState, 
  executeAction, 
  accessLevel 
}: ApiInspectorPanelProps) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null)
  const [method, setMethod] = useState<string>('GET')
  const [url, setUrl] = useState<string>('')
  const [headers, setHeaders] = useState<Record<string, string>>({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  })
  const [body, setBody] = useState<string>('')
  const [queryParams, setQueryParams] = useState<Record<string, string>>({})
  const [testResults, setTestResults] = useState<ApiTestResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>('all')

  // Mock API endpoints - in real implementation, these would be discovered automatically
  const apiEndpoints: ApiEndpoint[] = [
    {
      path: '/api/auth/callback',
      method: 'GET',
      description: 'OAuth callback handler',
      requiresAuth: false,
      parameters: [
        { name: 'code', type: 'string', required: true, description: 'OAuth authorization code' },
        { name: 'state', type: 'string', required: false, description: 'CSRF protection state' }
      ]
    },
    {
      path: '/api/admin/users',
      method: 'GET',
      description: 'Get all users (admin only)',
      requiresAuth: true,
      requiredRole: 'admin',
      parameters: [
        { name: 'page', type: 'number', required: false, description: 'Page number' },
        { name: 'limit', type: 'number', required: false, description: 'Items per page' },
        { name: 'role', type: 'string', required: false, description: 'Filter by role' }
      ]
    },
    {
      path: '/api/questions',
      method: 'POST',
      description: 'Create new question',
      requiresAuth: true,
      requiredRole: 'creator',
      parameters: [
        { name: 'title', type: 'string', required: true, description: 'Question title' },
        { name: 'stem', type: 'string', required: true, description: 'Question content' },
        { name: 'options', type: 'array', required: true, description: 'Answer options' }
      ]
    },
    {
      path: '/api/quiz/sessions',
      method: 'GET',
      description: 'Get user quiz sessions',
      requiresAuth: true,
      parameters: [
        { name: 'status', type: 'string', required: false, description: 'Filter by status' },
        { name: 'limit', type: 'number', required: false, description: 'Number of sessions' }
      ]
    },
    {
      path: '/api/debug/panel',
      method: 'GET',
      description: 'Get debug panel state (No Auth Required)',
      requiresAuth: false
    },
    {
      path: '/api/r2/anki-media/delete-all',
      method: 'POST',
      description: 'Delete all Anki media files (Debug - No Auth Required)',
      requiresAuth: false
    },
    {
      path: '/api/security/events',
      method: 'GET',
      description: 'Get security events for debugging (No Auth Required)',
      requiresAuth: false
    },
    {
      path: '/api/public/stats',
      method: 'GET',
      description: 'Get public statistics',
      requiresAuth: false
    }
  ]

  const filteredEndpoints = apiEndpoints.filter(endpoint => {
    const matchesSearch = endpoint.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         endpoint.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesMethod = methodFilter === 'all' || endpoint.method === methodFilter
    return matchesSearch && matchesMethod
  })

  const executeApiRequest = async () => {
    if (!url) {
      toast.error('URL is required')
      return
    }

    setLoading(true)
    const startTime = performance.now()

    try {
      // Build the full URL with query parameters
      const urlObj = new URL(url, window.location.origin)
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value) urlObj.searchParams.set(key, value)
      })

      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers: Object.fromEntries(
          Object.entries(headers).filter(([_, value]) => value.trim() !== '')
        )
      }

      // Add body for non-GET requests
      if (method !== 'GET' && body.trim()) {
        try {
          // Validate JSON if Content-Type is application/json
          if (headers['Content-Type']?.includes('application/json')) {
            JSON.parse(body)
          }
          requestOptions.body = body
        } catch (error) {
          toast.error('Invalid JSON in request body')
          return
        }
      }

      // Execute the request
      const response = await fetch(urlObj.toString(), requestOptions)
      const endTime = performance.now()
      const responseTime = Math.round(endTime - startTime)

      // Parse response
      let responseBody: any
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        responseBody = await response.json()
      } else {
        responseBody = await response.text()
      }

      // Create test result
      const testResult: ApiTestResult = {
        request: {
          endpoint: selectedEndpoint || {
            path: url,
            method: method as any,
            requiresAuth: false
          },
          headers,
          body: body ? JSON.parse(body) : undefined,
          queryParams
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
          responseTime,
          timestamp: new Date().toISOString()
        },
        success: response.ok,
        error: response.ok ? undefined : `${response.status} ${response.statusText}`
      }

      setTestResults(prev => [testResult, ...prev.slice(0, 9)]) // Keep last 10 results
      
      if (response.ok) {
        toast.success(`Request completed in ${responseTime}ms`)
      } else {
        toast.error(`Request failed: ${response.status} ${response.statusText}`)
      }

    } catch (error) {
      const endTime = performance.now()
      const responseTime = Math.round(endTime - startTime)

      const testResult: ApiTestResult = {
        request: {
          endpoint: selectedEndpoint || {
            path: url,
            method: method as any,
            requiresAuth: false
          },
          headers,
          body: body ? JSON.parse(body) : undefined,
          queryParams
        },
        response: {
          status: 0,
          statusText: 'Network Error',
          headers: {},
          body: null,
          responseTime,
          timestamp: new Date().toISOString()
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }

      setTestResults(prev => [testResult, ...prev.slice(0, 9)])
      toast.error(`Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const selectEndpoint = (endpoint: ApiEndpoint) => {
    setSelectedEndpoint(endpoint)
    setMethod(endpoint.method)
    setUrl(endpoint.path)
    
    // Set default headers based on endpoint requirements
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (endpoint.requiresAuth) {
      defaultHeaders['Authorization'] = 'Bearer <token>'
    }
    
    setHeaders(defaultHeaders)
    setBody('')
    setQueryParams({})
  }

  const addHeader = () => {
    setHeaders(prev => ({ ...prev, '': '' }))
  }

  const updateHeader = (oldKey: string, newKey: string, value: string) => {
    setHeaders(prev => {
      const updated = { ...prev }
      if (oldKey !== newKey) {
        delete updated[oldKey]
      }
      updated[newKey] = value
      return updated
    })
  }

  const removeHeader = (key: string) => {
    setHeaders(prev => {
      const updated = { ...prev }
      delete updated[key]
      return updated
    })
  }

  const addQueryParam = () => {
    setQueryParams(prev => ({ ...prev, '': '' }))
  }

  const updateQueryParam = (oldKey: string, newKey: string, value: string) => {
    setQueryParams(prev => {
      const updated = { ...prev }
      if (oldKey !== newKey) {
        delete updated[oldKey]
      }
      updated[newKey] = value
      return updated
    })
  }

  const removeQueryParam = (key: string) => {
    setQueryParams(prev => {
      const updated = { ...prev }
      delete updated[key]
      return updated
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const exportResults = () => {
    const dataStr = JSON.stringify(testResults, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `api-test-results-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Endpoints List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Code className="h-5 w-5" />
              <span>Available Endpoints</span>
            </CardTitle>
            <div className="flex space-x-2">
              <div className="flex-1">
                <Input
                  placeholder="Search endpoints..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {filteredEndpoints.map((endpoint, index) => (
                  <div
                    key={index}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedEndpoint?.path === endpoint.path 
                        ? 'border-blue-300 bg-blue-50' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => selectEndpoint(endpoint)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={endpoint.method === 'GET' ? 'default' : 'secondary'}>
                          {endpoint.method}
                        </Badge>
                        <span className="font-mono text-sm">{endpoint.path}</span>
                      </div>
                      {endpoint.requiresAuth && (
                        <Badge variant="outline">Auth Required</Badge>
                      )}
                    </div>
                    {endpoint.description && (
                      <p className="text-xs text-muted-foreground">{endpoint.description}</p>
                    )}
                    {endpoint.requiredRole && (
                      <p className="text-xs text-orange-600 mt-1">
                        Requires: {endpoint.requiredRole}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Request Builder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Send className="h-5 w-5" />
                <span>Request Builder</span>
              </div>
              <Button 
                onClick={executeApiRequest} 
                disabled={loading || !url}
                size="sm"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Request
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Method and URL */}
            <div className="flex space-x-2">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="/api/endpoint"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
              />
            </div>

            <Tabs defaultValue="headers" className="space-y-4">
              <TabsList>
                <TabsTrigger value="headers">Headers</TabsTrigger>
                <TabsTrigger value="params">Query Params</TabsTrigger>
                <TabsTrigger value="body">Body</TabsTrigger>
              </TabsList>

              <TabsContent value="headers" className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Headers</Label>
                  <Button variant="outline" size="sm" onClick={addHeader}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(headers).map(([key, value]) => (
                    <div key={key} className="flex space-x-2">
                      <Input
                        placeholder="Header name"
                        value={key}
                        onChange={(e) => updateHeader(key, e.target.value, value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Header value"
                        value={value}
                        onChange={(e) => updateHeader(key, key, e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeHeader(key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="params" className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Query Parameters</Label>
                  <Button variant="outline" size="sm" onClick={addQueryParam}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(queryParams).map(([key, value]) => (
                    <div key={key} className="flex space-x-2">
                      <Input
                        placeholder="Parameter name"
                        value={key}
                        onChange={(e) => updateQueryParam(key, e.target.value, value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Parameter value"
                        value={value}
                        onChange={(e) => updateQueryParam(key, key, e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeQueryParam(key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="body">
                <div>
                  <Label>Request Body (JSON)</Label>
                  <Textarea
                    placeholder='{"key": "value"}'
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="mt-2 font-mono text-sm"
                    rows={8}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Test Results</span>
                <Badge variant="outline">{testResults.length}</Badge>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={exportResults}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {testResults.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {result.success ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <Badge variant={result.request.endpoint.method === 'GET' ? 'default' : 'secondary'}>
                          {result.request.endpoint.method}
                        </Badge>
                        <span className="font-mono text-sm">{result.request.endpoint.path}</span>
                        <Badge variant={result.success ? 'default' : 'destructive'}>
                          {result.response.status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{result.response.responseTime}ms</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {result.error && (
                      <div className="text-red-600 text-sm mb-2">
                        Error: {result.error}
                      </div>
                    )}
                    
                    <div className="bg-gray-50 rounded p-3">
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(result.response.body, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
