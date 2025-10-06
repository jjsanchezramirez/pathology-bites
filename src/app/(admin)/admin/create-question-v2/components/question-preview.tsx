'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Badge } from '@/shared/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Edit3, Save, ArrowRight, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { GeneratedQuestion } from '../create-question-v2-client'

interface QuestionPreviewProps {
  question: GeneratedQuestion | null
  onQuestionUpdated: (question: GeneratedQuestion) => void
  onProceedToImages: () => void
}

export function QuestionPreview({ question, onQuestionUpdated, onProceedToImages }: QuestionPreviewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedQuestion, setEditedQuestion] = useState<GeneratedQuestion | null>(null)

  if (!question) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No question generated yet</p>
      </div>
    )
  }

  const startEditing = () => {
    setEditedQuestion({ ...question })
    setIsEditing(true)
  }

  const saveChanges = () => {
    if (!editedQuestion) return
    
    onQuestionUpdated(editedQuestion)
    setIsEditing(false)
    toast.success('Question updated successfully')
  }

  const cancelEditing = () => {
    setEditedQuestion(null)
    setIsEditing(false)
  }

  const updateField = (field: string, value: any) => {
    if (!editedQuestion) return
    
    setEditedQuestion({
      ...editedQuestion,
      [field]: value
    })
  }

  const updateOption = (index: number, field: string, value: any) => {
    if (!editedQuestion) return
    
    const updatedOptions = [...editedQuestion.answer_options]
    updatedOptions[index] = {
      ...updatedOptions[index],
      [field]: value
    }
    
    setEditedQuestion({
      ...editedQuestion,
      answer_options: updatedOptions
    })
  }

  const displayQuestion = isEditing ? editedQuestion : question

  if (!displayQuestion) return null

  return (
    <div className="space-y-6">
      {/* Question Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Generated Question</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{displayQuestion.difficulty}</Badge>
            <Badge variant="outline">{displayQuestion.status}</Badge>
            <Badge variant="outline">
              {displayQuestion.metadata?.generated_by?.model}
            </Badge>
          </div>
        </div>
        
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button onClick={saveChanges} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
              <Button onClick={cancelEditing} variant="outline" size="sm">
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={startEditing} variant="outline" size="sm">
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Question
            </Button>
          )}
        </div>
      </div>

      {/* Question Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Question Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            {isEditing ? (
              <Input
                value={displayQuestion.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Question title"
              />
            ) : (
              <p className="text-sm bg-muted p-3 rounded">{displayQuestion.title}</p>
            )}
          </div>

          {/* Stem */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Question Stem</label>
            {isEditing ? (
              <Textarea
                value={displayQuestion.stem}
                onChange={(e) => updateField('stem', e.target.value)}
                placeholder="Question stem"
                className="min-h-[100px]"
              />
            ) : (
              <p className="text-sm bg-muted p-3 rounded whitespace-pre-wrap">
                {displayQuestion.stem}
              </p>
            )}
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Difficulty</label>
            {isEditing ? (
              <Select
                value={displayQuestion.difficulty}
                onValueChange={(value) => updateField('difficulty', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="capitalize">
                {displayQuestion.difficulty}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Answer Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Answer Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {displayQuestion.answer_options.map((option, index) => (
            <Card key={index} className={`${option.is_correct ? 'border-green-200 bg-green-50' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    {option.is_correct ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    {/* Option Text */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Option Text
                      </label>
                      {isEditing ? (
                        <Textarea
                          value={option.text}
                          onChange={(e) => updateOption(index, 'text', e.target.value)}
                          placeholder="Option text"
                          className="min-h-[60px]"
                        />
                      ) : (
                        <p className="text-sm">{option.text}</p>
                      )}
                    </div>

                    {/* Explanation */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Explanation
                      </label>
                      {isEditing ? (
                        <Textarea
                          value={option.explanation}
                          onChange={(e) => updateOption(index, 'explanation', e.target.value)}
                          placeholder="Explanation for this option"
                          className="min-h-[80px]"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                          {option.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Teaching Point */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Teaching Point</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={displayQuestion.teaching_point}
              onChange={(e) => updateField('teaching_point', e.target.value)}
              placeholder="Key learning objective or clinical pearl"
              className="min-h-[100px]"
            />
          ) : (
            <p className="text-sm bg-muted p-3 rounded whitespace-pre-wrap">
              {displayQuestion.teaching_point}
            </p>
          )}
        </CardContent>
      </Card>

      {/* References */}
      {displayQuestion.question_references && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">References</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={displayQuestion.question_references}
                onChange={(e) => updateField('question_references', e.target.value)}
                placeholder="Relevant medical references"
                className="min-h-[80px]"
              />
            ) : (
              <p className="text-sm bg-muted p-3 rounded whitespace-pre-wrap">
                {displayQuestion.question_references}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Proceed Button */}
      {!isEditing && (
        <div className="flex justify-end">
          <Button onClick={onProceedToImages} size="lg">
            Proceed to Images
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}
