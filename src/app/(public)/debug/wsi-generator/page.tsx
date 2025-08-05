'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Badge } from '@/shared/components/ui/badge'
import { Loader2, Bug, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface DebugStep {
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  data?: any
  error?: string
  duration?: number
}

interface TestSlide {
  id: string
  repository: string
  category: string
  subcategory: string
  diagnosis: string
  patient_info: string
  age: string | null
  gender: string | null
  clinical_history: string
  stain_type: string
  preview_image_url: string
  slide_url: string
  case_url: string
  other_urls: string[]
  source_metadata: Record<string, unknown>
}

export default function WSIGeneratorDebugPage() {
  const [testSlideUrl, setTestSlideUrl] = useState('https://image.upmc.edu/Ameloblastoma/03-5999-3j-001.svs/view.apml?')
  const [customSlideData, setCustomSlideData] = useState('')
  const [debugSteps, setDebugSteps] = useState<DebugStep[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [finalResult, setFinalResult] = useState<any>(null)

  const updateStep = (stepName: string, updates: Partial<DebugStep>) => {
    setDebugSteps(prev => prev.map(step => 
      step.name === stepName ? { ...step, ...updates } : step
    ))
  }

  const addStep = (step: DebugStep) => {
    setDebugSteps(prev => [...prev, step])
  }

  const testWithCustomSlide = async () => {
    setIsRunning(true)
    setDebugSteps([])
    setFinalResult(null)

    try {
      // Create a test slide object
      const testSlide: TestSlide = {
        id: 'debug-test-001',
        repository: 'UPMC',
        category: 'Head and Neck',
        subcategory: 'Odontogenic Tumors',
        diagnosis: 'Ameloblastoma',
        patient_info: 'Debug test case',
        age: null,
        gender: null,
        clinical_history: 'Test case for WSI Question Generator debugging',
        stain_type: 'H&E',
        preview_image_url: '',
        slide_url: testSlideUrl,
        case_url: testSlideUrl,
        other_urls: [],
        source_metadata: { debug: true }
      }

      // Step 1: Test slide data validation
      addStep({ name: 'Slide Data Validation', status: 'running' })
      await new Promise(resolve => setTimeout(resolve, 500))
      
      if (!testSlide.slide_url || !testSlide.diagnosis) {
        updateStep('Slide Data Validation', { 
          status: 'error', 
          error: 'Missing required slide data (URL or diagnosis)' 
        })
        return
      }
      
      updateStep('Slide Data Validation', { 
        status: 'success', 
        data: { slideUrl: testSlide.slide_url, diagnosis: testSlide.diagnosis }
      })

      // Step 2: Test Educational content search
      addStep({ name: 'Educational Content Search', status: 'running' })
      const searchStart = Date.now()
      
      try {
        const searchResponse = await fetch('/api/tools/wsi-question-generator/debug/search-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slide: testSlide })
        })
        
        const searchDuration = Date.now() - searchStart
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json()
          updateStep('Educational Content Search', { 
            status: 'success', 
            data: searchData,
            duration: searchDuration
          })
        } else {
          const errorData = await searchResponse.json()
          updateStep('Educational Content Search', { 
            status: 'error', 
            error: errorData.error || 'Search failed',
            duration: searchDuration
          })
        }
      } catch (error) {
        updateStep('Educational Content Search', { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Network error'
        })
      }

      // Step 3: Test question generation
      addStep({ name: 'Question Generation', status: 'running' })
      const genStart = Date.now()
      
      try {
        const genResponse = await fetch('/api/tools/wsi-question-generator/debug/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slide: testSlide })
        })
        
        const genDuration = Date.now() - genStart
        
        if (genResponse.ok) {
          const genData = await genResponse.json()
          updateStep('Question Generation', { 
            status: 'success', 
            data: genData,
            duration: genDuration
          })
        } else {
          const errorData = await genResponse.json()
          updateStep('Question Generation', { 
            status: 'error', 
            error: errorData.error || 'Generation failed',
            duration: genDuration
          })
        }
      } catch (error) {
        updateStep('Question Generation', { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Network error'
        })
      }

      // Step 4: Test full workflow
      addStep({ name: 'Full Workflow Test', status: 'running' })
      const workflowStart = Date.now()
      
      try {
        const workflowResponse = await fetch('/api/tools/wsi-question-generator', {
          method: 'GET'
        })
        
        const workflowDuration = Date.now() - workflowStart
        
        if (workflowResponse.ok) {
          const workflowData = await workflowResponse.json()
          updateStep('Full Workflow Test', { 
            status: 'success', 
            data: workflowData,
            duration: workflowDuration
          })
          setFinalResult(workflowData)
        } else {
          const errorData = await workflowResponse.json()
          updateStep('Full Workflow Test', { 
            status: 'error', 
            error: errorData.error || 'Workflow failed',
            duration: workflowDuration
          })
        }
      } catch (error) {
        updateStep('Full Workflow Test', { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Network error'
        })
      }

    } catch (error) {
      console.error('Debug test failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const testWithCustomData = async () => {
    if (!customSlideData.trim()) return
    
    try {
      const slideData = JSON.parse(customSlideData)
      setTestSlideUrl(slideData.slide_url || '')
      await testWithCustomSlide()
    } catch (error) {
      alert('Invalid JSON data')
    }
  }

  const getStatusIcon = (status: DebugStep['status']) => {
    switch (status) {
      case 'pending': return <AlertCircle className="h-4 w-4 text-gray-400" />
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Bug className="h-8 w-8" />
          WSI Question Generator Debug Tool
        </h1>
        <p className="text-muted-foreground">
          Debug and test the WSI Question Generator with specific slides and configurations
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Test Configuration */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="slide-url">Test Slide URL</Label>
                <Input
                  id="slide-url"
                  value={testSlideUrl}
                  onChange={(e) => setTestSlideUrl(e.target.value)}
                  placeholder="Enter WSI slide URL"
                />
              </div>
              
              <div>
                <Label htmlFor="custom-data">Custom Slide Data (JSON)</Label>
                <Textarea
                  id="custom-data"
                  value={customSlideData}
                  onChange={(e) => setCustomSlideData(e.target.value)}
                  placeholder='{"slide_url": "...", "diagnosis": "...", ...}'
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={testWithCustomSlide}
                  disabled={isRunning || !testSlideUrl.trim()}
                  className="flex-1"
                >
                  {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Test with URL
                </Button>
                <Button 
                  onClick={testWithCustomData}
                  disabled={isRunning || !customSlideData.trim()}
                  variant="outline"
                  className="flex-1"
                >
                  Test with JSON
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Debug Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Debug Steps</CardTitle>
            </CardHeader>
            <CardContent>
              {debugSteps.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No debug steps yet. Run a test to see the workflow.
                </p>
              ) : (
                <div className="space-y-3">
                  {debugSteps.map((step, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                      {getStatusIcon(step.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{step.name}</h4>
                          {step.duration && (
                            <Badge variant="outline" className="text-xs">
                              {step.duration}ms
                            </Badge>
                          )}
                        </div>
                        {step.error && (
                          <p className="text-sm text-red-600 mt-1">{step.error}</p>
                        )}
                        {step.data && step.status === 'success' && (
                          <details className="mt-2">
                            <summary className="text-sm text-muted-foreground cursor-pointer">
                              View data
                            </summary>
                            <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                              {JSON.stringify(step.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              {finalResult ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">✅ Test Successful</h4>
                    <p className="text-sm text-green-700">
                      Generated question for: {finalResult.wsi?.diagnosis}
                    </p>
                  </div>
                  
                  <div>
                    <h5 className="font-medium mb-2">Generated Question:</h5>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm mb-3">{finalResult.question?.stem}</p>
                      <div className="space-y-1">
                        {finalResult.question?.options?.map((option: any) => (
                          <div key={option.id} className="text-sm flex items-start gap-2">
                            <span className="font-medium">{option.id}.</span>
                            <span className={option.is_correct ? 'text-green-600 font-medium' : ''}>
                              {option.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <details>
                    <summary className="cursor-pointer font-medium">Full Response Data</summary>
                    <pre className="text-xs bg-muted p-3 rounded mt-2 overflow-auto max-h-96">
                      {JSON.stringify(finalResult, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Run a test to see results here
                </p>
              )}
            </CardContent>
          </Card>

          {/* WSI Preview */}
          {testSlideUrl && (
            <Card>
              <CardHeader>
                <CardTitle>WSI Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <iframe
                    src={testSlideUrl}
                    className="w-full h-96"
                    title="WSI Preview"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  URL: {testSlideUrl}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
