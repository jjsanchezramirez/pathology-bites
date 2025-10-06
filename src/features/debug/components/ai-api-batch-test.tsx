'use client'

import { useState } from 'react'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Progress } from '@/shared/components/ui/progress'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  TestTube2,
  Play,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  Brain,
  FileText
} from 'lucide-react'
import { toast } from 'sonner'

interface TestResult {
  endpoint: string
  status: 'pending' | 'running' | 'success' | 'error'
  responseTime?: number
  error?: string
  response?: any
  statusCode?: number
}

interface AIEndpoint {
  id: string
  name: string
  path: string
  method: string
  testPayload: any
  description: string
  category: 'generation' | 'testing' | 'processing'
  requiresAuth?: boolean
  adminOnly?: boolean
}

// All AI API endpoints with test payloads
const AI_ENDPOINTS: AIEndpoint[] = [
  {
    id: 'ai-test',
    name: 'AI Model Test',
    path: '/api/debug/ai-test',
    method: 'POST',
    category: 'testing',
    description: 'Test individual AI models with custom prompts',
    testPayload: {
      model: 'Llama-3.3-8B-Instruct',
      prompt: 'What is the primary function of mitochondria in cells? Respond in 1-2 sentences.'
    }
  },
  {
    id: 'wsi-question-generator',
    name: 'WSI Question Generator',
    path: '/api/public/tools/wsi-question-generator/generate',
    method: 'POST',
    category: 'generation',
    description: 'Generate pathology questions from virtual slide images',
    testPayload: {
      wsi: {
        id: 'test-slide-001',
        repository: 'test-repo',
        category: 'Renal Pathology',
        subcategory: 'Glomerular Disease',
        diagnosis: 'Acute tubular necrosis',
        patient_info: 'Test patient case',
        age: '45',
        gender: 'Male',
        clinical_history: 'Patient presents with acute kidney injury following hypotensive episode.',
        stain_type: 'H&E',
        image_url: 'https://example.com/test-slide.jpg', // Required by API
        preview_image_url: 'https://example.com/preview.jpg',
        slide_url: 'https://example.com/slide.svs',
        case_url: 'https://example.com/case.html',
        other_urls: [],
        source_metadata: { test: true }
      },
      context: 'Test case for renal pathology diagnosis',
      modelIndex: 0
    }
  },
  {
    id: 'admin-ai-generate-question',
    name: 'Admin AI Question Generator',
    path: '/api/admin/ai-generate-question',
    method: 'POST',
    category: 'generation',
    description: 'Generate pathology questions from educational content using AI',
    requiresAuth: true,
    adminOnly: true,
    testPayload: {
      content: {
        category: 'Pathology',
        subject: 'Renal Pathology',
        lesson: 'Acute Kidney Injury',
        topic: 'Acute Tubular Necrosis',
        text: 'Acute tubular necrosis (ATN) is a common cause of acute kidney injury characterized by damage to the tubular epithelial cells. It can be caused by ischemic or toxic insults.'
      },
      instructions: 'Create a multiple-choice question about acute tubular necrosis pathophysiology.',
      additionalContext: 'Focus on histologic features and clinical presentation.',
      model: 'Llama-3.3-8B-Instruct'
    }
  },
  {
    id: 'questions-create',
    name: 'Question Database Creation',
    path: '/api/admin/questions-create',
    method: 'POST',
    category: 'processing',
    description: 'Save generated questions to database',
    requiresAuth: true,
    adminOnly: true,
    testPayload: {
      title: 'Test Database Question',
      stem: 'A 45-year-old patient presents with kidney dysfunction. Examination shows...',
      difficulty: 'medium',
      answer_options: [
        { text: 'Acute tubular necrosis', is_correct: true, explanation: 'Correct based on clinical presentation' },
        { text: 'Glomerulonephritis', is_correct: false, explanation: 'Incorrect - different pathology' },
        { text: 'Renal cell carcinoma', is_correct: false, explanation: 'Incorrect - this is malignant' },
        { text: 'Normal kidney', is_correct: false, explanation: 'Incorrect - patient has dysfunction' }
      ],
      teaching_point: 'Understanding acute kidney injury patterns',
      category_id: null,
      question_set_id: null,
      tag_ids: []
    }
  }
]

export function AIApiBatchTest() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<Record<string, TestResult>>({})
  const [currentTest, setCurrentTest] = useState<string | null>(null)
  const [includeAuthTests, setIncludeAuthTests] = useState(false)
  const { isAdmin, isLoading: authLoading } = useUserRole()

  const initializeResults = () => {
    const initialResults: Record<string, TestResult> = {}
    AI_ENDPOINTS.forEach(endpoint => {
      initialResults[endpoint.id] = {
        endpoint: endpoint.name,
        status: 'pending'
      }
    })
    return initialResults
  }

  const runSingleTest = async (endpoint: AIEndpoint): Promise<TestResult> => {
    const startTime = Date.now()
    
    // Skip auth-required endpoints if not properly authenticated
    if (endpoint.requiresAuth && authLoading) {
      return {
        endpoint: endpoint.name,
        status: 'error',
        error: 'Authentication status unknown - please wait for auth to load'
      }
    }
    
    if (endpoint.adminOnly && !isAdmin) {
      return {
        endpoint: endpoint.name,
        status: 'error',
        error: 'Admin permissions required - skipped (this is expected for non-admin users)'
      }
    }
    
    try {
      const response = await fetch(endpoint.path, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(endpoint.testPayload)
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      let responseData
      try {
        responseData = await response.json()
      } catch {
        responseData = await response.text()
      }

      if (response.ok) {
        return {
          endpoint: endpoint.name,
          status: 'success',
          responseTime,
          statusCode: response.status,
          response: responseData
        }
      } else {
        return {
          endpoint: endpoint.name,
          status: 'error',
          responseTime,
          statusCode: response.status,
          error: responseData.error || `HTTP ${response.status}: ${response.statusText}`,
          response: responseData
        }
      }
    } catch (error) {
      return {
        endpoint: endpoint.name,
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  const runBatchTest = async () => {
    setIsRunning(true)
    setResults(initializeResults())
    setCurrentTest(null)

    try {
      // Filter endpoints based on settings
      const endpointsToTest = AI_ENDPOINTS.filter(endpoint => {
        if (endpoint.adminOnly && !includeAuthTests) return false
        return true
      })

      // Run tests sequentially to avoid overwhelming the APIs
      for (const endpoint of endpointsToTest) {
        setCurrentTest(endpoint.id)
        
        // Update status to running
        setResults(prev => ({
          ...prev,
          [endpoint.id]: {
            ...prev[endpoint.id],
            status: 'running'
          }
        }))

        const result = await runSingleTest(endpoint)
        
        // Update with result
        setResults(prev => ({
          ...prev,
          [endpoint.id]: result
        }))

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      setCurrentTest(null)
      
      // Show summary
      const totalTests = endpointsToTest.length
      const successCount = Object.values(results).filter(r => r.status === 'success').length
      const errorCount = Object.values(results).filter(r => r.status === 'error').length
      const skippedCount = AI_ENDPOINTS.length - endpointsToTest.length

      if (errorCount === 0) {
        toast.success(`All ${totalTests} AI API tests passed!${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`)
      } else {
        toast.error(`${errorCount} of ${totalTests} AI API tests failed${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`)
      }

    } catch (error) {
      console.error('Batch test error:', error)
      toast.error('Batch test failed to complete')
    } finally {
      setIsRunning(false)
    }
  }

  const resetTests = () => {
    setResults({})
    setCurrentTest(null)
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />
      case 'running':
        return <Zap className="h-4 w-4 text-blue-500 animate-pulse" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getCategoryIcon = (category: AIEndpoint['category']) => {
    switch (category) {
      case 'generation':
        return <Brain className="h-4 w-4" />
      case 'testing':
        return <TestTube2 className="h-4 w-4" />
      case 'processing':
        return <FileText className="h-4 w-4" />
    }
  }

  const resultsArray = Object.entries(results)
  const totalTests = AI_ENDPOINTS.length
  const completedTests = resultsArray.filter(([_, result]) => 
    result.status === 'success' || result.status === 'error'
  ).length
  const successCount = resultsArray.filter(([_, result]) => result.status === 'success').length
  const errorCount = resultsArray.filter(([_, result]) => result.status === 'error').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI API Batch Testing
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Comprehensive testing of all AI endpoints with diagnostic information for debugging API failures.
            {!isAdmin && !authLoading && (
              <span className="block mt-1 text-amber-600">
                ⚠️ Some tests require admin permissions and will be skipped.
              </span>
            )}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Test Options */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="includeAuth" 
                checked={includeAuthTests}
                onCheckedChange={(checked) => setIncludeAuthTests(checked === true)}
                disabled={isRunning}
              />
              <label 
                htmlFor="includeAuth" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Include auth-required tests {isAdmin ? '(you have admin access)' : '(requires admin login)'}
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button 
                onClick={runBatchTest} 
                disabled={isRunning}
                className="flex-1"
              >
                {isRunning ? (
                  <>
                    <Zap className="h-4 w-4 mr-2 animate-pulse" />
                    Running Tests...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run AI Tests
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={resetTests}
                disabled={isRunning}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          {/* Progress */}
          {isRunning && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress: {completedTests}/{totalTests} tests</span>
                <span>{Math.round((completedTests / totalTests) * 100)}%</span>
              </div>
              <Progress value={(completedTests / totalTests) * 100} />
              {currentTest && (
                <p className="text-sm text-muted-foreground">
                  Currently testing: {AI_ENDPOINTS.find(e => e.id === currentTest)?.name}
                </p>
              )}
            </div>
          )}

          {/* Summary */}
          {completedTests > 0 && (
            <div className="mt-4 flex gap-4">
              <Badge variant="outline" className="text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                {successCount} passed
              </Badge>
              <Badge variant="outline" className="text-red-600">
                <AlertCircle className="h-3 w-3 mr-1" />
                {errorCount} failed
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {Object.keys(results).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {AI_ENDPOINTS.map((endpoint) => {
                  const result = results[endpoint.id]
                  if (!result) return null

                  return (
                    <Card key={endpoint.id} className="p-4">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(endpoint.category)}
                            <h4 className="font-semibold">{endpoint.name}</h4>
                            <Badge variant="outline">{endpoint.method}</Badge>
                            {endpoint.requiresAuth && (
                              <Badge variant="secondary" className="text-xs">
                                Auth Required
                              </Badge>
                            )}
                            {endpoint.adminOnly && (
                              <Badge variant="secondary" className="text-xs">
                                Admin Only
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {result.responseTime && (
                              <Badge variant="outline">
                                {result.responseTime}ms
                              </Badge>
                            )}
                            {result.statusCode && (
                              <Badge variant={result.statusCode < 400 ? 'default' : 'destructive'}>
                                {result.statusCode}
                              </Badge>
                            )}
                            {getStatusIcon(result.status)}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground">
                          {endpoint.description}
                        </p>

                        {/* Path */}
                        <div className="text-sm">
                          <code className="bg-muted px-2 py-1 rounded text-xs">
                            {endpoint.method} {endpoint.path}
                          </code>
                        </div>

                        {/* Error */}
                        {result.status === 'error' && result.error && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded">
                            <p className="text-sm font-medium text-red-800">Error:</p>
                            <p className="text-sm text-red-700">{result.error}</p>
                          </div>
                        )}

                        {/* Response Preview */}
                        {result.response && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              View Response
                            </summary>
                            <div className="mt-2 p-3 bg-muted rounded max-h-40 overflow-auto">
                              <pre className="text-xs whitespace-pre-wrap">
                                {typeof result.response === 'string' 
                                  ? result.response 
                                  : JSON.stringify(result.response, null, 2)
                                }
                              </pre>
                            </div>
                          </details>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}