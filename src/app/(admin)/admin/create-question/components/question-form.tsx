'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Badge } from '@/shared/components/ui/badge'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Loader2, Brain, Upload, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  getModelProvider
} from '@/shared/config/ai-models'

// Admin AI models (matches the admin API exactly) - optimized for speed and quality
const ADMIN_AI_MODELS = [
  // Tier 1: FASTEST - Prioritize speed for better UX
  'Llama-3.3-8B-Instruct',                  // 394ms - FASTEST, excellent quality
  'ministral-8b-2410',                      // 596ms - Fast Mistral model
  'gemini-1.5-flash',                       // 763ms - Fast Google model
  'mistral-small-2501',                     // 790ms - Latest small Mistral
  'gemini-2.0-flash',                       // 829ms - Good balance

  // Tier 2: BALANCED - Good speed + capability
  'Llama-4-Scout-17B-16E-Instruct-FP8',     // 1063ms - Latest multimodal + medical reasoning
  'mistral-medium-2505',                    // 1311ms - Best balance of capability/volume

  // Tier 3: POWERFUL - Slower but high quality
  'Llama-3.3-70B-Instruct',                 // 1788ms - Proven large model performance
  'Llama-4-Maverick-17B-128E-Instruct-FP8', // 1917ms - Complex reasoning powerhouse

  // Tier 4: PREMIUM - Highest quality but slowest
  'gemini-2.5-flash',                       // 3765ms - Best quality (but slow)
  'gemini-2.5-pro'                          // Premium reasoning (slowest)
]

interface EducationalContent {
  category: string
  subject: string
  lesson: string
  topic: string
  content: any
}

interface GeneratedQuestion {
  title: string
  stem: string
  difficulty: 'easy' | 'medium' | 'hard'
  teaching_point: string
  question_references: string
  status: string
  question_set_id: string
  category_id: string
  answer_options: Array<{
    text: string
    is_correct: boolean
    explanation: string
    order_index: number
  }>
  question_images: Array<{
    question_section: 'stem' | 'explanation'
    order_index: number
    image_url: string
    alt_text: string
    caption: string
  }>
  tag_ids: string[]
  metadata: any
}

interface QuestionFormProps {
  selectedContent: EducationalContent | null
  onQuestionGenerated: (question: GeneratedQuestion) => void
  onFilesUploaded: (files: File[]) => void
  isEditMode?: boolean
}

const DEFAULT_INSTRUCTIONS = `You are an expert pathology educator creating multiple-choice questions for medical students and residents. Generate a high-quality pathology question based on the provided content.

Requirements:
1. Create a clinically relevant scenario-based question
2. Include 5 answer choices with one clearly correct answer
3. Provide detailed explanations for each choice
4. Ensure the question tests understanding, not just memorization
5. Use appropriate medical terminology
6. Make the question challenging but fair
7. Suggest 2-4 relevant medical/pathology tags that categorize this question

Return the response in this exact JSON format:
{
  "title": "Brief descriptive title",
  "stem": "Clinical scenario and question",
  "difficulty": "easy|medium|hard",
  "teaching_point": "Concise 1-2 sentence key learning point about [specific concept being tested].",
  "suggested_tags": ["Tag1", "Tag2", "Tag3"]
  "question_references": "Relevant citations",
  "status": "draft",
  "answer_options": [
    {
      "text": "Answer choice A text",
      "is_correct": false,
      "explanation": "Detailed explanation for A",
      "order_index": 0
    },
    {
      "text": "Answer choice B text", 
      "is_correct": true,
      "explanation": "Detailed explanation for B (correct answer)",
      "order_index": 1
    },
    {
      "text": "Answer choice C text",
      "is_correct": false,
      "explanation": "Detailed explanation for C",
      "order_index": 2
    },
    {
      "text": "Answer choice D text",
      "is_correct": false,
      "explanation": "Detailed explanation for D",
      "order_index": 3
    },
    {
      "text": "Answer choice E text",
      "is_correct": false,
      "explanation": "Detailed explanation for E",
      "order_index": 4
    }
  ]
}`

export function QuestionForm({ selectedContent, onQuestionGenerated, onFilesUploaded, isEditMode = false }: QuestionFormProps) {
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS)
  const [additionalContext, setAdditionalContext] = useState('')
  const [selectedModelIndex, setSelectedModelIndex] = useState(0) // Default to Llama-3.3-8B-Instruct (most reliable)
  const [assumeHistologicImages, setAssumeHistologicImages] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])



  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setUploadedFiles(prev => [...prev, ...files])
    onFilesUploaded([...uploadedFiles, ...files])
  }

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index)
    setUploadedFiles(newFiles)
    onFilesUploaded(newFiles)
  }

  // Use centralized provider detection and API key management

  // Network retry utility with optimized backoff for form interactions
  const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 2): Promise<Response> => {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        // Reduced timeout for better user experience during form interactions
        const timeoutId = setTimeout(() => controller.abort(), 45000) // 45 second timeout

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        // If successful or client error (4xx), don't retry
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response
        }

        // Server error (5xx), retry with conservative backoff
        throw new Error(`Server error: ${response.status} ${response.statusText}`)

      } catch (error) {
        lastError = error as Error

        // Don't retry on abort (timeout) or network errors on final attempt
        if (attempt === maxRetries - 1) {
          break
        }

        // More conservative backoff for form interactions: 2s, 4s
        const delay = Math.pow(2, attempt + 1) * 1000

        // Show user-friendly retry message
        if (attempt === 0) {
          toast.info('Request failed, retrying...', { duration: 2000 })
        }

        await new Promise(resolve => setTimeout(resolve, delay))

        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay`)
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }

  const generateQuestion = async () => {
    if (!selectedContent) {
      toast.error('Please select content first')
      return
    }

    // Prevent multiple simultaneous requests
    if (isGenerating) {
      toast.warning('Question generation already in progress')
      return
    }

    setIsGenerating(true)

    try {
      const contextContent = JSON.stringify(selectedContent.content, null, 2)
      const selectedModel = ADMIN_AI_MODELS[selectedModelIndex]
      console.log('🔍 Model:', selectedModel, 'Using debug AI test API (restored functionality)')

      // Build comprehensive prompt for question generation
      const prompt = `Create a high-quality medical/pathology multiple-choice question based on the following educational content:

**Educational Context:**
Category: ${selectedContent.category}
Subject: ${selectedContent.subject}
Lesson: ${selectedContent.lesson}
Topic: ${selectedContent.topic}

**Content:**
${contextContent}

**Instructions:**
${instructions}

${additionalContext ? `**Additional Context:**
${additionalContext}` : ''}

Please generate a question following this exact JSON format:
{
  "title": "Brief descriptive title for the question",
  "stem": "The question text with clinical scenario",
  "difficulty": "easy|medium|hard",
  "teaching_point": "Key learning objective or clinical pearl",
  "question_references": "Relevant medical references if applicable",
  "answer_options": [
    {
      "text": "Option A text",
      "is_correct": true,
      "explanation": "Detailed explanation for this option"
    },
    {
      "text": "Option B text",
      "is_correct": false,
      "explanation": "Detailed explanation for this option"
    },
    {
      "text": "Option C text",
      "is_correct": false,
      "explanation": "Detailed explanation for this option"
    },
    {
      "text": "Option D text",
      "is_correct": false,
      "explanation": "Detailed explanation for this option"
    }
  ]
}`

      const response = await fetchWithRetry('/api/debug/ai-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          prompt: prompt
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Debug AI test API returns { content, model, provider, responseTime, tokenCount }
        const generatedText = data.content
        if (!generatedText) {
          throw new Error('No content received from AI service')
        }

        console.log('🔍 AI Response received, parsing JSON...')

        // Parse JSON from the debug AI test API response
        try {
          let questionData = null

          // The debug AI test API returns the extracted content in data.content
          // This content should be the question JSON (either direct or wrapped in markdown)

          // Strategy 1: Try direct JSON parsing (for models that return clean JSON)
          try {
            questionData = JSON.parse(generatedText)
          } catch (directError) {
            // Strategy 2: Extract JSON from markdown code blocks
            const markdownMatch = generatedText.match(/```json\n([\s\S]*?)\n```/)
            if (markdownMatch) {
              questionData = JSON.parse(markdownMatch[1])
            } else {
              // Strategy 3: Extract any JSON object from the text
              const jsonMatch = generatedText.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                questionData = JSON.parse(jsonMatch[0])
              } else {
                throw new Error('No valid JSON found in response')
              }
            }
          }

          if (questionData) {

            // Add required fields that might be missing
            const completeQuestion: GeneratedQuestion = {
              ...questionData,
              status: 'draft',
              question_set_id: '', // Will be set during finalization
              category_id: '', // Will be set during finalization
              answer_options: (questionData.answer_options || []).map((option: any, index: number) => ({
                ...option,
                order_index: index // Add missing order_index field
              })),
              question_images: questionData.question_images || [],
              tag_ids: questionData.tag_ids || [],
              metadata: {
                exported_at: new Date().toISOString(),
                exported_by: '', // Will be set during finalization
                source_content: {
                  category: selectedContent.category,
                  subject: selectedContent.subject,
                  lesson: selectedContent.lesson,
                  topic: selectedContent.topic
                },
                generated_by: {
                  provider: data.provider || 'debug-ai',
                  model: data.model || selectedModel
                }
              }
            }

            console.log('🎯 Generated question data:', completeQuestion)
            console.log('📋 Question title:', completeQuestion.title)
            console.log('📝 Answer options count:', completeQuestion.answer_options?.length)

            onQuestionGenerated(completeQuestion)
            toast.success(`Question generated successfully using ${selectedModel}!`)
          } else {
            throw new Error('No valid question data found in response')
          }
        } catch (parseError) {
          console.error('JSON parsing error:', parseError)
          console.error('Raw AI response:', generatedText.substring(0, 500))
          toast.error('Failed to parse generated question. Please try again.')
        }
      } else {
        // Handle different types of API errors
        const errorMessage = data.error || 'Failed to generate question'
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error generating question:', error)

      // Provide user-friendly error messages based on error type
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          toast.error('Request timed out. Please check your connection and try again.')
        } else if (error.message.includes('Failed to fetch')) {
          toast.error('Network error. Please check your internet connection and try again.')
        } else if (error.message.includes('Unsupported model')) {
          toast.error(`Model ${ADMIN_AI_MODELS[selectedModelIndex]} is not supported. Please try a different model.`)
        } else if (error.message.includes('rate limit')) {
          toast.error('API rate limit exceeded. Please wait a moment and try again.')
        } else if (error.message.includes('Server error: 5')) {
          toast.error('AI service temporarily unavailable. Please try again in a few moments.')
        } else {
          toast.error(`Generation failed: ${error.message}`)
        }
      } else {
        toast.error('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Selected Content Summary */}
      {selectedContent && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{selectedContent.category}</Badge>
              <Badge variant="outline">{selectedContent.subject}</Badge>
            </div>
            <p className="text-sm">
              <strong>Lesson:</strong> {selectedContent.lesson}
            </p>
            <p className="text-sm">
              <strong>Topic:</strong> {selectedContent.topic}
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI Model Selection */}
      {!isEditMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>AI Model</Label>
              <Select value={selectedModelIndex.toString()} onValueChange={(value) => setSelectedModelIndex(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_AI_MODELS.map((model, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  Provider: {getModelProvider(ADMIN_AI_MODELS[selectedModelIndex]).toUpperCase()}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Priority: #{selectedModelIndex + 1} in fallback chain
                </Badge>
              </div>
            </div>

            {/* Histologic Images Option */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="histologic-images"
                  checked={assumeHistologicImages}
                  onCheckedChange={(checked) => setAssumeHistologicImages(checked as boolean)}
                />
                <Label
                  htmlFor="histologic-images"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Assume histologic images are attached
                </Label>
              </div>
              <p className="text-sm text-muted-foreground ml-6">
                The AI will reference images without describing their microscopic appearance
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Generation Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Instructions for AI</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder="Enter instructions for the AI..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Context Preview */}
      {selectedContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Content Context (Read-only)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 w-full rounded border p-4">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(selectedContent.content, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Additional Context */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Context</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Additional Information</Label>
            <Textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              className="min-h-[100px]"
              placeholder="Add any specific learning objectives, constraints, or additional context..."
            />
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Supporting Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload images and supporting files
                </p>
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Uploaded Files</Label>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <div className="flex justify-end">
        {isEditMode ? (
          <div className="text-center space-y-2">
            <Button
              disabled
              size="lg"
              className="opacity-50 cursor-not-allowed"
            >
              <Brain className="mr-2 h-4 w-4" />
              Generate Question
            </Button>
            <p className="text-sm text-muted-foreground">
              AI generation is not available when editing existing questions
            </p>
          </div>
        ) : (
          <Button
            onClick={generateQuestion}
            disabled={!selectedContent || isGenerating}
            size="lg"
          >
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Brain className="mr-2 h-4 w-4" />
            Generate Question
          </Button>
        )}
      </div>
    </div>
  )
}
