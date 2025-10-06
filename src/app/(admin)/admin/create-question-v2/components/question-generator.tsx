'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Textarea } from '@/shared/components/ui/textarea'
import { Badge } from '@/shared/components/ui/badge'
import { Loader2, Sparkles, RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { EducationalContent, GeneratedQuestion } from '../create-question-v2-client'

interface QuestionGeneratorProps {
  selectedContent: EducationalContent | null
  selectedModel: string
  isGenerating: boolean
  onGeneratingChange: (generating: boolean) => void
  onQuestionGenerated: (question: GeneratedQuestion) => void
}

export function QuestionGenerator({
  selectedContent,
  selectedModel,
  isGenerating,
  onGeneratingChange,
  onQuestionGenerated
}: QuestionGeneratorProps) {
  const [instructions, setInstructions] = useState(
    'Create a multiple-choice question with 4 options. Focus on key concepts and include detailed explanations for each option. The question should test understanding of the topic and include clinical correlation where appropriate.'
  )
  const [generationAttempts, setGenerationAttempts] = useState(0)

  const generateQuestion = async () => {
    if (!selectedContent || !selectedModel) {
      toast.error('Content and model selection required')
      return
    }

    onGeneratingChange(true)
    setGenerationAttempts(prev => prev + 1)

    try {
      const response = await fetch('/api/admin/question-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          context: selectedContent,
          instructions: instructions
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Question generation failed')
      }

      onQuestionGenerated(data.question)
      toast.success(`Question generated successfully! (${data.metadata.response_time}ms)`)

    } catch (error) {
      console.error('Question generation error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate question')
    } finally {
      onGeneratingChange(false)
    }
  }

  const handleRegenerateQuestion = () => {
    generateQuestion()
  }

  if (!selectedContent || !selectedModel) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Please select educational content and AI model first</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Context Summary */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-blue-800 text-sm">Generation Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline" className="bg-white">
              {selectedContent.category} → {selectedContent.subject}
            </Badge>
            <Badge variant="outline" className="bg-white">
              {selectedContent.lesson} → {selectedContent.topic}
            </Badge>
            <Badge variant="outline" className="bg-white">
              Model: {selectedModel}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-2 block">
            Generation Instructions
          </label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Provide specific instructions for question generation..."
            className="min-h-[100px]"
            disabled={isGenerating}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Customize how the AI should generate your question. Be specific about format, difficulty, focus areas, or clinical scenarios.
        </p>
      </div>

      {/* Content Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Educational Content Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Title:</span> {selectedContent.content.title}
            </div>
            <div>
              <span className="font-medium">Description:</span> {selectedContent.content.description}
            </div>
            {selectedContent.content.keyPoints && (
              <div>
                <span className="font-medium">Key Points:</span>
                <ul className="list-disc list-inside ml-4 mt-1">
                  {selectedContent.content.keyPoints.map((point: string, index: number) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generation Controls */}
      <div className="flex gap-3">
        <Button
          onClick={generateQuestion}
          disabled={isGenerating}
          className="flex-1"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Question...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Question
            </>
          )}
        </Button>

        {generationAttempts > 0 && (
          <Button
            onClick={handleRegenerateQuestion}
            disabled={isGenerating}
            variant="outline"
            size="lg"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
        )}
      </div>

      {generationAttempts > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Generation attempts: {generationAttempts}
        </div>
      )}

      {/* Tips */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4">
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-2">💡 Generation Tips:</p>
            <ul className="space-y-1 text-xs">
              <li>• Be specific in your instructions for better results</li>
              <li>• Different models have different strengths - try regenerating if needed</li>
              <li>• The AI will use the educational content as context for the question</li>
              <li>• Generated questions will have 4 options with detailed explanations</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
