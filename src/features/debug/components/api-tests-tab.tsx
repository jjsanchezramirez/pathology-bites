// src/features/debug/components/api-tests-tab.tsx
/**
 * API Tests Tab - Test all API endpoints with forms and responses
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { 
  Zap, 
  Play, 
  Copy, 
  Check,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react'
import { toast } from '@/shared/utils/toast'

interface ApiEndpoint {
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  description: string
  category: string
  requiresAuth?: boolean
  samplePayload?: string
}

export function ApiTestsTab() {
  const [selectedCategory, setSelectedCategory] = useState<string>('Authentication')
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null)
  const [requestBody, setRequestBody] = useState('')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const apiEndpoints: ApiEndpoint[] = [
    // Auth APIs
    {
      name: 'Auth Debug',
      method: 'GET',
      path: '/api/debug/auth',
      description: 'Get authentication configuration and environment info',
      category: 'Authentication',
      requiresAuth: false
    },
    
    // User APIs
    {
      name: 'User Profile',
      method: 'GET',
      path: '/api/user/profile',
      description: 'Get current user profile information',
      category: 'User Management',
      requiresAuth: true
    },
    {
      name: 'Update User Settings',
      method: 'POST',
      path: '/api/user/settings',
      description: 'Update user settings',
      category: 'User Management',
      requiresAuth: true,
      samplePayload: JSON.stringify({
        theme: 'dark',
        notifications: true,
        language: 'en'
      }, null, 2)
    },

    // Question APIs
    {
      name: 'Get Questions',
      method: 'GET',
      path: '/api/content/questions',
      description: 'Fetch questions with pagination and filters',
      category: 'Questions',
      requiresAuth: true
    },
    {
      name: 'Create Question',
      method: 'POST',
      path: '/api/content/questions/create',
      description: 'Create a new question',
      category: 'Questions',
      requiresAuth: true,
      samplePayload: JSON.stringify({
        title: 'Sample Question',
        stem: 'What is the diagnosis?',
        difficulty: 'intermediate',
        category_id: 'uuid-here',
        options: [
          { text: 'Option A', is_correct: true },
          { text: 'Option B', is_correct: false }
        ]
      }, null, 2)
    },

    // Quiz APIs
    {
      name: 'Start Quiz Session',
      method: 'POST',
      path: '/api/quiz/start',
      description: 'Start a new quiz session',
      category: 'Quiz',
      requiresAuth: true,
      samplePayload: JSON.stringify({
        question_count: 10,
        category_ids: [],
        difficulty: 'all'
      }, null, 2)
    },
    {
      name: 'Submit Quiz Answer',
      method: 'POST',
      path: '/api/quiz/answer',
      description: 'Submit an answer for a quiz question',
      category: 'Quiz',
      requiresAuth: true,
      samplePayload: JSON.stringify({
        session_id: 'uuid-here',
        question_id: 'uuid-here',
        selected_options: ['uuid-here']
      }, null, 2)
    },

    // Analytics APIs
    {
      name: 'Dashboard Stats',
      method: 'GET',
      path: '/api/analytics/dashboard',
      description: 'Get dashboard statistics',
      category: 'Analytics',
      requiresAuth: true
    },
    {
      name: 'User Performance',
      method: 'GET',
      path: '/api/analytics/performance',
      description: 'Get user performance analytics',
      category: 'Analytics',
      requiresAuth: true
    },

    // Admin APIs
    {
      name: 'Admin Dashboard Stats',
      method: 'GET',
      path: '/api/admin/stats',
      description: 'Get admin dashboard statistics',
      category: 'Admin',
      requiresAuth: true
    },
    {
      name: 'Manage Users',
      method: 'GET',
      path: '/api/admin/users',
      description: 'Get user management data',
      category: 'Admin',
      requiresAuth: true
    },

    // Debug APIs
    {
      name: 'Database Schema',
      method: 'GET',
      path: '/api/debug/database-schema',
      description: 'Get database schema information',
      category: 'Debug',
      requiresAuth: false
    },
    {
      name: 'Generate Sample Activities',
      method: 'POST',
      path: '/api/debug/generate-activities',
      description: 'Generate sample user activities for testing',
      category: 'Debug',
      requiresAuth: false
    },

    // Storage APIs
    {
      name: 'List R2 Files',
      method: 'GET',
      path: '/api/r2/files',
      description: 'List files in Cloudflare R2 storage with pagination and filtering',
      category: 'Storage',
      requiresAuth: false
    },
    {
      name: 'Generate R2 Signed URL',
      method: 'POST',
      path: '/api/r2/signed-url',
      description: 'Generate a signed URL for R2 file upload',
      category: 'Storage',
      requiresAuth: true,
      samplePayload: JSON.stringify({
        key: 'images/test-file.jpg',
        contentType: 'image/jpeg'
      }, null, 2)
    },
    {
      name: 'Generate Private File URL',
      method: 'POST',
      path: '/api/r2/private-url',
      description: 'Generate a signed URL for accessing private R2 files',
      category: 'Storage',
      requiresAuth: false,
      samplePayload: JSON.stringify({
        key: 'abpath-content-specs.json',
        bucket: 'pathology-bites-data',
        expiresIn: 3600
      }, null, 2)
    },
    {
      name: 'R2 Reorganization Status',
      method: 'GET',
      path: '/api/r2/reorganize',
      description: 'Check current R2 folder structure and planned reorganization operations',
      category: 'Storage',
      requiresAuth: false
    },
    {
      name: 'R2 Reorganization (Dry Run)',
      method: 'POST',
      path: '/api/r2/reorganize',
      description: 'Preview R2 folder reorganization without making changes',
      category: 'Storage',
      requiresAuth: false,
      samplePayload: JSON.stringify({
        operation: 'all',
        dryRun: true
      }, null, 2)
    },
    {
      name: 'R2 Reorganization (Execute)',
      method: 'POST',
      path: '/api/r2/reorganize',
      description: 'Execute R2 folder reorganization operations',
      category: 'Storage',
      requiresAuth: false,
      samplePayload: JSON.stringify({
        operation: 'all',
        dryRun: false
      }, null, 2)
    }
  ]

  const categories = [...new Set(apiEndpoints.map(endpoint => endpoint.category))]
  const filteredEndpoints = apiEndpoints.filter(endpoint => endpoint.category === selectedCategory)

  const testEndpoint = async (endpoint: ApiEndpoint) => {
    setLoading(true)
    setResponse(null)

    try {
      const options: RequestInit = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
      }

      if (endpoint.method !== 'GET' && requestBody.trim()) {
        options.body = requestBody
      }

      const response = await fetch(endpoint.path, options)
      const data = await response.json()

      setResponse({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: data
      })

      if (response.ok) {
        toast.success(`${endpoint.name} - Success`)
      } else {
        toast.error(`${endpoint.name} - Error ${response.status}`)
      }
    } catch (error) {
      setResponse({
        status: 0,
        statusText: 'Network Error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      toast.error(`${endpoint.name} - Network Error`)
    } finally {
      setLoading(false)
    }
  }

  const copyResponse = async () => {
    if (response) {
      try {
        await navigator.clipboard.writeText(JSON.stringify(response, null, 2))
        setCopied(true)
        toast.success('Response copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        toast.error('Failed to copy response')
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">API Tests</h2>
        <p className="text-gray-600">Test all API endpoints with interactive forms and view responses</p>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[800px]">
        {/* Column 1: Categories */}
        <div className="col-span-3">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Categories</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category)
                      setSelectedEndpoint(null)
                      setResponse(null)
                    }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                      selectedCategory === category
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 2: API Endpoints */}
        <div className="col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{selectedCategory} APIs</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto">
              <div className="space-y-1">
                {filteredEndpoints.map((endpoint, index) => (
                  <button
                    key={`${endpoint.method}-${endpoint.path}-${index}`}
                    onClick={() => {
                      setSelectedEndpoint(endpoint)
                      setRequestBody(endpoint.samplePayload || '')
                      setResponse(null)
                    }}
                    className={`w-full text-left p-4 transition-colors border-b border-gray-100 ${
                      selectedEndpoint?.path === endpoint.path && selectedEndpoint?.method === endpoint.method
                        ? 'bg-blue-50 border-l-2 border-l-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{endpoint.name}</span>
                      <div className="flex items-center space-x-1">
                        <Badge
                          variant={endpoint.method === 'GET' ? 'secondary' : 'default'}
                          className="text-xs"
                        >
                          {endpoint.method}
                        </Badge>
                        {endpoint.requiresAuth && (
                          <Badge variant="outline" className="text-xs">
                            Auth
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{endpoint.description}</p>
                    <p className="text-xs text-gray-500 font-mono">{endpoint.path}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Test Interface */}
        <div className="col-span-5">
          {selectedEndpoint ? (
            <div className="space-y-4 h-full">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Test {selectedEndpoint.name}</span>
                    <Badge variant={selectedEndpoint.method === 'GET' ? 'secondary' : 'default'}>
                      {selectedEndpoint.method}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Endpoint:</p>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded block">
                      {selectedEndpoint.method} {selectedEndpoint.path}
                    </code>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Description:</p>
                    <p className="text-sm text-gray-800">{selectedEndpoint.description}</p>
                  </div>

                  {selectedEndpoint.method !== 'GET' && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Request Body (JSON):</label>
                      <Textarea
                        value={requestBody}
                        onChange={(e) => setRequestBody(e.target.value)}
                        placeholder="Enter JSON request body..."
                        className="font-mono text-sm"
                        rows={6}
                      />
                    </div>
                  )}

                  <Button
                    onClick={() => testEndpoint(selectedEndpoint)}
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
                        <Play className="h-4 w-4 mr-2" />
                        Test Endpoint
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Response */}
              {response && (
                <Card className="flex-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center space-x-2">
                        {response.status >= 200 && response.status < 300 ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span>Response</span>
                      </span>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={response.status >= 200 && response.status < 300 ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {response.status} {response.statusText}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyResponse}
                        >
                          {copied ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                      <pre className="text-xs">
                        <code>{JSON.stringify(response, null, 2)}</code>
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="h-full">
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">Select a category and endpoint to test</p>
                  <p className="text-sm text-gray-400">Choose from the categories on the left, then select an API endpoint</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
