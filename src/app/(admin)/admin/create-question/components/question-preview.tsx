'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { Edit, Save, MessageSquare, Brain } from 'lucide-react'
import { toast } from 'sonner'


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

interface QuestionPreviewProps {
  question: GeneratedQuestion | null
  onQuestionUpdated: (question: GeneratedQuestion) => void
}

export function QuestionPreview({ question, onQuestionUpdated }: QuestionPreviewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedQuestion, setEditedQuestion] = useState<GeneratedQuestion | null>(null)
  const [chatMessage, setChatMessage] = useState('')
  const [isRefining, setIsRefining] = useState(false)

  if (!question) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">No question generated yet.</p>
        </CardContent>
      </Card>
    )
  }

  const startEditing = () => {
    setEditedQuestion({
      ...question,
      // Ensure answer_options is always an array
      answer_options: question.answer_options || []
    })
    setIsEditing(true)
  }

  const saveChanges = () => {
    if (editedQuestion) {
      onQuestionUpdated(editedQuestion)
      setIsEditing(false)
      toast.success('Changes saved successfully!')
    }
  }

  const cancelEditing = () => {
    setEditedQuestion(null)
    setIsEditing(false)
  }



  // Network retry utility with exponential backoff
  const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        // If successful or client error (4xx), don't retry
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response
        }

        // Server error (5xx), retry with exponential backoff
        throw new Error(`Server error: ${response.status} ${response.statusText}`)

      } catch (error) {
        lastError = error as Error

        // Don't retry on abort (timeout) or network errors on final attempt
        if (attempt === maxRetries - 1) {
          break
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))

        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay`)
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }

  const handleRefineQuestion = async () => {
    if (!chatMessage.trim()) {
      toast.error('Please enter a refinement request')
      return
    }

    // Prevent multiple simultaneous requests
    if (isRefining) {
      toast.warning('Refinement already in progress')
      return
    }

    setIsRefining(true)

    try {
      const prompt = `
Please modify the following question based on this request: "${chatMessage}"

Current Question:
${JSON.stringify(question, null, 2)}

Return the modified question in the same JSON format.
`

      // Use the same model that generated the original question, or default to Gemini
      const originalModel = question?.metadata?.generated_by?.model || 'gemini-2.0-flash-exp'

      const response = await fetchWithRetry('/api/tools/wsi-question-generator/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wsi: {
            diagnosis: 'Question Refinement',
            category: 'Admin',
            subcategory: 'Refinement',
            stain_type: 'H&E'
          },
          context: null,
          modelId: originalModel
        })
      })

      const data = await response.json()

      if (response.ok) {
        // WSI question generator API returns structured response
        if (!data.success) {
          throw new Error(data.error || 'Question refinement failed')
        }

        // Extract the refined question data
        const refinedQuestion = data.question
        if (!refinedQuestion) {
          throw new Error('No question data received from API')
        }

        try {
          onQuestionUpdated({
            ...refinedQuestion,
            metadata: {
              ...question.metadata,
              refined_at: new Date().toISOString(),
              refinement_request: chatMessage,
              refined_by: {
                provider: 'wsi-generator',
                model: originalModel
              }
            }
          })

          setChatMessage('')
          toast.success(`Question refined successfully using ${originalModel}!`)
        } catch (parseError) {
          console.error('JSON parsing error:', parseError)
          toast.error('Failed to parse refined question')
        }
      } else {
        // Handle different types of API errors
        const errorMessage = data.error?.message || data.error || 'Failed to refine question'
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error refining question:', error)

      // Provide user-friendly error messages based on error type
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          toast.error('Request timed out. Please check your connection and try again.')
        } else if (error.message.includes('Failed to fetch')) {
          toast.error('Network error. Please check your internet connection and try again.')
        } else if (error.message.includes('rate limit')) {
          toast.error('API rate limit exceeded. Please wait a moment and try again.')
        } else if (error.message.includes('Server error: 5')) {
          toast.error('AI service temporarily unavailable. Please try again in a few moments.')
        } else {
          toast.error(`Refinement failed: ${error.message}`)
        }
      } else {
        toast.error('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsRefining(false)
    }
  }

  const currentQuestion = isEditing ? editedQuestion! : question
  const correctAnswer = currentQuestion?.answer_options?.find(opt => opt.is_correct)

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Badge variant={currentQuestion.difficulty === 'easy' ? 'secondary' :
                         currentQuestion.difficulty === 'medium' ? 'default' : 'destructive'}>
            {currentQuestion.difficulty?.toUpperCase() || 'MEDIUM'}
          </Badge>
          <Badge variant="outline">{currentQuestion.status || 'draft'}</Badge>
        </div>
        
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={cancelEditing}>
                Cancel
              </Button>
              <Button onClick={saveChanges}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={startEditing}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Question
            </Button>
          )}
        </div>
      </div>

      {/* Question Content */}
      <Card>
        <CardHeader>
          <CardTitle>Question Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label>Title</Label>
            {isEditing ? (
              <Input
                value={editedQuestion?.title || ''}
                onChange={(e) => setEditedQuestion(prev => prev ? {...prev, title: e.target.value} : null)}
              />
            ) : (
              <p className="font-medium">{currentQuestion.title || 'Untitled Question'}</p>
            )}
          </div>

          {/* Question Stem */}
          <div className="space-y-2">
            <Label>Question</Label>
            {isEditing ? (
              <Textarea
                value={editedQuestion?.stem || ''}
                onChange={(e) => setEditedQuestion(prev => prev ? {...prev, stem: e.target.value} : null)}
                className="min-h-[100px]"
              />
            ) : (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="whitespace-pre-wrap">{currentQuestion.stem || 'No question stem provided'}</p>
              </div>
            )}
          </div>

          {/* Answer Options */}
          <div className="space-y-2">
            <Label>Answer Options</Label>
            <div className="space-y-3">
              {isEditing ? (
                editedQuestion?.answer_options?.length ? (
                  editedQuestion.answer_options.map((option, index) => (
                  <div key={index} className="space-y-2 p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={option.is_correct}
                        onChange={() => {
                          if (editedQuestion?.answer_options) {
                            const newOptions = editedQuestion.answer_options.map((opt, i) => ({
                              ...opt,
                              is_correct: i === index
                            }))
                            setEditedQuestion({...editedQuestion, answer_options: newOptions})
                          }
                        }}
                      />
                      <Label>Option {index + 1}</Label>
                    </div>
                    <Textarea
                      value={option.text}
                      onChange={(e) => {
                        if (editedQuestion?.answer_options) {
                          const newOptions = [...editedQuestion.answer_options]
                          newOptions[index] = {...option, text: e.target.value}
                          setEditedQuestion({...editedQuestion, answer_options: newOptions})
                        }
                      }}
                      className="min-h-[60px]"
                    />
                    <Textarea
                      value={option.explanation}
                      onChange={(e) => {
                        if (editedQuestion?.answer_options) {
                          const newOptions = [...editedQuestion.answer_options]
                          newOptions[index] = {...option, explanation: e.target.value}
                          setEditedQuestion({...editedQuestion, answer_options: newOptions})
                        }
                      }}
                      placeholder="Explanation for this option..."
                      className="min-h-[60px]"
                    />
                  </div>
                  ))
                ) : (
                  <div className="p-4 border rounded-lg border-dashed">
                    <p className="text-muted-foreground text-center">No answer options available for editing</p>
                  </div>
                )
              ) : (
                <RadioGroup value={correctAnswer?.text} className="space-y-3">
                  {currentQuestion?.answer_options?.length ? (
                    currentQuestion.answer_options.map((option, index) => (
                      <div key={index} className={`p-4 border rounded-lg ${option.is_correct ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}`}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value={option.text} id={`option-${index}`} />
                          <Label htmlFor={`option-${index}`} className="font-medium">
                            {option.text}
                          </Label>
                        </div>
                        {option.explanation && (
                          <p className="mt-2 text-sm text-muted-foreground pl-6">
                            <strong>Explanation:</strong> {option.explanation}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 border rounded-lg border-dashed">
                      <p className="text-muted-foreground text-center">No answer options available</p>
                    </div>
                  )}
                </RadioGroup>
              )}
            </div>
          </div>

          <Separator />

          {/* Teaching Point */}
          <div className="space-y-2">
            <Label>Teaching Point</Label>
            {isEditing ? (
              <Textarea
                value={editedQuestion?.teaching_point || ''}
                onChange={(e) => setEditedQuestion(prev => prev ? {...prev, teaching_point: e.target.value} : null)}
                className="min-h-[80px]"
              />
            ) : (
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                <p className="whitespace-pre-wrap">{currentQuestion.teaching_point || 'No teaching point provided'}</p>
              </div>
            )}
          </div>

          {/* References */}
          <div className="space-y-2">
            <Label>References</Label>
            {isEditing ? (
              <Textarea
                value={editedQuestion?.question_references || ''}
                onChange={(e) => setEditedQuestion(prev => prev ? {...prev, question_references: e.target.value} : null)}
                className="min-h-[60px]"
              />
            ) : (
              <p className="text-sm text-muted-foreground">{currentQuestion.question_references || 'No references provided'}</p>
            )}
          </div>

          {/* Difficulty */}
          {isEditing && (
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select 
                value={editedQuestion?.difficulty} 
                onValueChange={(value: 'easy' | 'medium' | 'hard') => 
                  setEditedQuestion(prev => prev ? {...prev, difficulty: value} : null)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Refinement Chat */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Refine Question
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Request Changes</Label>
            <Textarea
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Ask AI to modify specific parts of the question (e.g., 'Make the question more challenging', 'Add more clinical context', 'Improve the distractors')"
              className="min-h-[80px]"
            />
          </div>
          <Button 
            onClick={handleRefineQuestion}
            disabled={!chatMessage.trim() || isRefining}
          >
            {isRefining ? (
              <>
                <Brain className="mr-2 h-4 w-4 animate-pulse" />
                Refining...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Refine Question
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
