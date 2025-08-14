// src/features/debug/components/ai-models-tab.tsx
/**
 * AI Models Tab - Test AI models and APIs with unified configuration
 * Restructured with sub-tabs for AI Question Testing and All AI Models comparison
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import {
  Bot,
  Send,
  Copy,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Upload,
  X,
  FileText,
  Zap
} from 'lucide-react'
import { toast } from '@/shared/utils/toast'
import { cacheService } from '@/shared/services/cache-service'
import {
  ACTIVE_AI_MODELS,
  DISABLED_AI_MODELS,
  getModelProvider,
  getApiKey,
  DEFAULT_MODEL,
  type AIModel
} from '@/shared/config/ai-models'
import { AiModelComparisonTab } from './ai-model-comparison-tab'

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

export function AiModelsTab() {
  // Unified state
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [prompt, setPrompt] = useState('Create a pathology MCQ following the ABP format using the provided educational context.')
  const [instructions, setInstructions] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [rawResponse, setRawResponse] = useState('')
  const [responseTime, setResponseTime] = useState<number | null>(null)
  const [tokenUsage, setTokenUsage] = useState<{input?: number, output?: number, total?: number} | null>(null)
  const [educationalContext, setEducationalContext] = useState<string>('')
  const [selectedEducationalFile, setSelectedEducationalFile] = useState<string>('')

  // Get all models (active + disabled)
  const activeModels = ACTIVE_AI_MODELS.map(model => ({
    value: model.id,
    label: model.name,
    provider: model.provider,
    available: model.available,
    description: model.description
  }))

  const disabledModels = DISABLED_AI_MODELS.map(model => ({
    value: model.id,
    label: model.name,
    provider: model.provider,
    available: model.available,
    description: model.description
  }))

  const allModels = [...activeModels, ...disabledModels]

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Educational files list - complete list from admin create question page
  const educationalFiles = [
    // Anatomic Pathology files
    'ap-bone.json',
    'ap-breast.json',
    'ap-cardiovascular-and-thoracic.json',
    'ap-cytopathology.json',
    'ap-dermatopathology.json',
    'ap-forensics-and-autopsy.json',
    'ap-gastrointestinal.json',
    'ap-general-topics.json',
    'ap-genitourinary.json',
    'ap-gynecological.json',
    'ap-head-and-neck---endocrine.json',
    'ap-hematopathology.json',
    'ap-molecular.json',
    'ap-neuropathology.json',
    'ap-pancreas-biliary-liver.json',
    'ap-pediatrics.json',
    'ap-soft-tissue.json',
    
    // Clinical Pathology files
    'cp-clinical-chemistry.json',
    'cp-hematology-hemostasis-and-thrombosis.json',
    'cp-hematopathology.json',
    'cp-immunology.json',
    'cp-laboratory-management-and-clinical-laboratory-informatics.json',
    'cp-medical-microbiology.json',
    'cp-molecular-pathology-and-cytogenetics.json',
    'cp-toxicology-body-fluids-and-special-techniques.json',
    'cp-transfusion-medicine.json'
  ]

  // Load saved instructions on mount
  useEffect(() => {
    const savedInstructions = cacheService.get('ai-model-instructions')
    if (savedInstructions && typeof savedInstructions === 'string') {
      setInstructions(savedInstructions)
    } else {
      resetToDefaultInstructions()
    }
  }, [])

  const resetToDefaultInstructions = () => {
    const defaultInstructions = `You are an expert pathologist and medical educator. Your task is to create high-quality pathology questions following the American Board of Pathology (ABP) format.

Guidelines:
1. Create multiple-choice questions with 4-5 options (A, B, C, D, E)
2. Focus on clinically relevant scenarios
3. Include appropriate clinical context and patient demographics
4. Ensure one clearly correct answer
5. Make distractors plausible but incorrect
6. Use proper medical terminology
7. Follow ABP question style and format

When educational context is provided, use it as reference material for creating questions about specific topics, diagnoses, or pathological processes.`

    setInstructions(defaultInstructions)
  }

  const saveInstructions = (instructions: string) => {
    cacheService.set('ai-model-instructions', instructions, { ttl: 24 * 60 * 60 * 1000 }) // 24 hours
    toast.success('Instructions saved!')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments(prev => [...prev, ...files])
  }

  const handleEducationalFileChange = async (fileName: string) => {
    setSelectedEducationalFile(fileName)
    if (!fileName) {
      setEducationalContext('')
      return
    }

    try {
      // Use direct R2 access to avoid Vercel API costs
      const EDUCATIONAL_CONTENT_BASE = process.env.CLOUDFLARE_R2_DATA_PUBLIC_URL || 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev'
      const response = await fetch(`${EDUCATIONAL_CONTENT_BASE}/context/${fileName}`)
      if (response.ok) {
        const contentData = await response.json()
        // Extract meaningful content for AI context
        let contextText = `Subject: ${contentData.subject?.name || 'Unknown'}\n\n`
        
        if (contentData.subject?.lessons) {
          Object.entries(contentData.subject.lessons).forEach(([lessonKey, lesson]: [string, any]) => {
            contextText += `Lesson: ${lesson.name}\n`
            if (lesson.topics) {
              Object.entries(lesson.topics).forEach(([topicKey, topic]: [string, any]) => {
                contextText += `\nTopic: ${topic.name}\n`
                if (topic.content) {
                  contextText += `Content: ${JSON.stringify(topic.content, null, 2)}\n\n`
                }
              })
            }
          })
        } else {
          // Fallback if structure is different
          contextText += JSON.stringify(contentData, null, 2)
        }
        
        setEducationalContext(contextText)
        toast.success(`Loaded ${fileName}`)
      } else {
        toast.error(`Failed to load ${fileName}`)
        setEducationalContext('')
      }
    } catch (error) {
      console.error('Error loading educational file:', error)
      toast.error(`Error loading ${fileName}`)
      setEducationalContext('')
    }
  }

  const getCurrentProvider = () => {
    return getModelProvider(selectedModel)
  }

  const testAPI = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    const provider = getCurrentProvider()
    const apiKey = getApiKey(provider)

    if (!apiKey) {
      toast.error(`No API key configured for ${provider}`)
      return
    }

    setLoading(true)
    setResponse(null)
    setRawResponse('')
    setResponseTime(null)
    setTokenUsage(null)

    const startTime = Date.now()

    try {
      let apiResponse: Response
      let data: any

      if (provider === 'gemini' || provider === 'google') {
        // Prepare form data for file uploads
        const formData = new FormData()
        formData.append('apiKey', apiKey)
        formData.append('model', selectedModel)
        formData.append('prompt', prompt)
        formData.append('instructions', instructions)
        if (educationalContext) {
          formData.append('educationalContext', educationalContext)
        }

        // Add attachments
        attachments.forEach((file, index) => {
          formData.append(`attachment_${index}`, file)
        })

        apiResponse = await fetch('/api/debug/google-test', {
          method: 'POST',
          body: formData
        })
        data = await apiResponse.json()
      } else if (provider === 'claude') {
        apiResponse = await fetch('/api/debug/claude-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            model: selectedModel,
            prompt,
            instructions,
            educationalContext: educationalContext || undefined
          })
        })
        data = await apiResponse.json()
      } else if (provider === 'chatgpt') {
        apiResponse = await fetch('/api/debug/chatgpt-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            model: selectedModel,
            prompt,
            instructions,
            educationalContext: educationalContext || undefined
          })
        })
        data = await apiResponse.json()
      } else if (provider === 'mistral') {
        apiResponse = await fetch('/api/debug/mistral-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            model: selectedModel,
            prompt,
            instructions,
            educationalContext: educationalContext || undefined
          })
        })
        data = await apiResponse.json()
      } else if (provider === 'deepseek') {
        apiResponse = await fetch('/api/debug/deepseek-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            model: selectedModel,
            prompt,
            instructions,
            educationalContext: educationalContext || undefined
          })
        })
        data = await apiResponse.json()
      } else if (provider === 'llama' || provider === 'groq') {
        // Use LLM question generator API for LLAMA and Groq models
        apiResponse = await fetch('/api/tools/wsi-question-generator/generate-llm-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wsi: {
              diagnosis: 'Test Case',
              category: 'Test',
              subcategory: 'Debug',
              stain_type: 'H&E'
            },
            context: educationalContext || null,
            modelId: selectedModel
          })
        })
        data = await apiResponse.json()
      } else {
        throw new Error(`Unsupported provider: ${provider}`)
      }

      const endTime = Date.now()
      setResponseTime(endTime - startTime)
      setRawResponse(JSON.stringify(data, null, 2))
      setResponse(data)
      
      // Extract token usage information from various API formats
      if (data?.usage) {
        setTokenUsage({
          input: data.usage.prompt_tokens || data.usage.input_tokens || 0,
          output: data.usage.completion_tokens || data.usage.output_tokens || 0,
          total: data.usage.total_tokens || 
                 (data.usage.prompt_tokens || data.usage.input_tokens || 0) + 
                 (data.usage.completion_tokens || data.usage.output_tokens || 0)
        })
      }

      if (apiResponse?.ok) {
        toast.success(`${provider?.toUpperCase() || 'UNKNOWN'} API call successful! (${responseTime}ms)`)
      } else if (data?.error) {
        toast.error(`${provider?.toUpperCase() || 'UNKNOWN'} API Error: ${data.error.message}`)
      } else {
        toast.warning('Unexpected response format')
      }
    } catch (error) {
      console.error('API test error:', error)
      toast.error(`Failed to call ${provider?.toUpperCase() || 'UNKNOWN'} API`)
      setRawResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getResponseText = () => {
    const provider = getCurrentProvider()
    if (!response) return null

    let text: any = null

    if ((provider === 'gemini' || provider === 'google') && response.candidates?.[0]?.content?.parts?.[0]?.text) {
      text = response.candidates[0].content.parts[0].text
    } else if (provider === 'claude' && response.content?.[0]?.text) {
      text = response.content[0].text
    } else if (provider === 'chatgpt' && response.choices?.[0]?.message?.content) {
      text = response.choices[0].message.content
    } else if (provider === 'mistral' && response.choices?.[0]?.message?.content) {
      text = response.choices[0].message.content
    } else if (provider === 'deepseek' && response.choices?.[0]?.message?.content) {
      text = response.choices[0].message.content
    } else if (provider === 'llama' && response.choices?.[0]?.message?.content) {
      text = response.choices[0].message.content
    } else if (provider === 'groq' && response.choices?.[0]?.message?.content) {
      text = response.choices[0].message.content
    }

    // Ensure we return a string, not an object
    if (text && typeof text === 'object') {
      return JSON.stringify(text, null, 2)
    }
    
    return typeof text === 'string' ? text : null
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">AI Models</h2>
        <p className="text-gray-600">Test AI models and APIs with unified configuration</p>
      </div>

      <Tabs defaultValue="question-testing" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="question-testing">AI Question Testing</TabsTrigger>
          <TabsTrigger value="model-comparison">All AI Models</TabsTrigger>
        </TabsList>

        <TabsContent value="question-testing" className="space-y-6">
          <AiQuestionTestingContent
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            prompt={prompt}
            setPrompt={setPrompt}
            instructions={instructions}
            setInstructions={setInstructions}
            attachments={attachments}
            setAttachments={setAttachments}
            loading={loading}
            response={response}
            rawResponse={rawResponse}
            responseTime={responseTime}
            tokenUsage={tokenUsage}
            educationalContext={educationalContext}
            selectedEducationalFile={selectedEducationalFile}
            activeModels={activeModels}
            disabledModels={disabledModels}
            allModels={allModels}
            fileInputRef={fileInputRef}
            educationalFiles={educationalFiles}
            handleFileUpload={handleFileUpload}
            handleEducationalFileChange={handleEducationalFileChange}
            resetToDefaultInstructions={resetToDefaultInstructions}
            saveInstructions={saveInstructions}
            testAPI={testAPI}
            copyToClipboard={copyToClipboard}
            formatFileSize={formatFileSize}
            getResponseText={getResponseText}
            getCurrentProvider={getCurrentProvider}
          />
        </TabsContent>

        <TabsContent value="model-comparison" className="space-y-6">
          <AiModelComparisonTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Extract the existing content into a separate component
interface AiQuestionTestingContentProps {
  selectedModel: string
  setSelectedModel: (model: string) => void
  prompt: string
  setPrompt: (prompt: string) => void
  instructions: string
  setInstructions: (instructions: string) => void
  attachments: File[]
  setAttachments: (attachments: File[]) => void
  loading: boolean
  response: any
  rawResponse: string
  responseTime: number | null
  tokenUsage: {input?: number, output?: number, total?: number} | null
  educationalContext: string
  selectedEducationalFile: string
  activeModels: any[]
  disabledModels: any[]
  allModels: any[]
  fileInputRef: React.RefObject<HTMLInputElement | null>
  educationalFiles: string[]
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleEducationalFileChange: (file: string) => void
  resetToDefaultInstructions: () => void
  saveInstructions: (instructions: string) => void
  testAPI: () => void
  copyToClipboard: (text: string) => void
  formatFileSize: (bytes: number) => string
  getResponseText: () => string | null
  getCurrentProvider: () => string
}

function AiQuestionTestingContent({
  selectedModel,
  setSelectedModel,
  prompt,
  setPrompt,
  instructions,
  setInstructions,
  attachments,
  setAttachments,
  loading,
  response,
  rawResponse,
  responseTime,
  tokenUsage,
  educationalContext,
  selectedEducationalFile,
  activeModels,
  disabledModels,
  allModels,
  fileInputRef,
  educationalFiles,
  handleFileUpload,
  handleEducationalFileChange,
  resetToDefaultInstructions,
  saveInstructions,
  testAPI,
  copyToClipboard,
  formatFileSize,
  getResponseText,
  getCurrentProvider
}: AiQuestionTestingContentProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Configuration */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bot className="h-5 w-5" />
              <span>AI Model Configuration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Model Selection */}
            <div>
              <Label htmlFor="model">Model</Label>
              <select
                id="model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full p-2 border border-input rounded-md bg-background"
              >
                <optgroup label="✅ Active Models">
                  {activeModels.map(model => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="❌ Unavailable Models">
                  {disabledModels.map(model => (
                    <option key={model.value} value={model.value} disabled>
                      {model.label} (Unavailable)
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Instructions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="instructions">Instructions</Label>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetToDefaultInstructions}
                  >
                    Reset
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveInstructions(instructions)}
                  >
                    Save
                  </Button>
                </div>
              </div>
              <Textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="System instructions for the AI model..."
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            {/* Educational Context */}
            <div>
              <Label htmlFor="educational-file">Educational Context</Label>
              <select
                id="educational-file"
                value={selectedEducationalFile}
                onChange={(e) => handleEducationalFileChange(e.target.value)}
                className="w-full p-2 border border-input rounded-md bg-background mb-2"
              >
                <option value="">Select educational file...</option>
                {educationalFiles.map(file => (
                  <option key={file} value={file}>
                    {file.replace('.json', '').replace(/\-/g, ' ').toUpperCase()}
                  </option>
                ))}
              </select>
              {educationalContext && (
                <div className="text-xs text-gray-500 mb-2">
                  Context loaded: {(educationalContext.length / 1024).toFixed(1)}KB
                </div>
              )}
            </div>

            {/* Prompt */}
            <div>
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                rows={4}
              />
            </div>

            {/* Attachments (only for Gemini) */}
            {(getCurrentProvider() === 'gemini' || getCurrentProvider() === 'google') && (
              <div>
                <Label>Attachments</Label>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,text/*,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="text-sm font-medium">{file.name}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newAttachments = attachments.filter((_, i) => i !== index)
                              setAttachments(newAttachments)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Test Button */}
            <Button onClick={testAPI} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Testing {getCurrentProvider().toUpperCase()} API...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Test {getCurrentProvider().toUpperCase()} API
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Response */}
      <div className="space-y-4">
        {response ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  {response.error ? (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <span>{getCurrentProvider().toUpperCase()} Response</span>
                  <div className="text-sm text-gray-500 flex items-center space-x-2">
                    {responseTime && (
                      <span>({responseTime}ms)</span>
                    )}
                    {tokenUsage && (
                      <span>
                        | Tokens: {tokenUsage.input || 0} in, {tokenUsage.output || 0} out
                        {tokenUsage.total && ` (${tokenUsage.total} total)`}
                      </span>
                    )}
                  </div>
                </span>
                <Badge variant={response.error ? 'destructive' : 'default'}>
                  {response.error ? 'Error' : 'Success'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {response.error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-semibold text-red-800 mb-2">Error Details</h4>
                  <p><strong>Type:</strong> {response.error.type}</p>
                  <p><strong>Message:</strong> {response.error.message}</p>
                  {response.error.code && <p><strong>Code:</strong> {response.error.code}</p>}
                </div>
              ) : getResponseText() ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">Generated Text</h4>
                  <div className="whitespace-pre-wrap text-sm">
                    {getResponseText()}
                  </div>
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
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto max-h-96">
                  <pre className="text-xs">
                    <code>{rawResponse}</code>
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Bot className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Configure and test AI models</p>
                <p className="text-sm text-gray-400 mt-1">
                  Current: {getCurrentProvider().toUpperCase()}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}