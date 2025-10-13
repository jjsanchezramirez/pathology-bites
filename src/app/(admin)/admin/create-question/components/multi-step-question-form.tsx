'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Progress } from '@/shared/components/ui/progress'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { toast } from 'sonner'

// Import step components (to be created)
import { StepSourceConfig } from './steps/step-source-config'
import { StepContentEdit } from './steps/step-content-edit'
import { StepImageSelection } from './steps/step-image-selection'
import { StepMetadata } from './steps/step-metadata'

// Import types
import { QuestionFormData } from '@/features/questions/types/questions'

interface MultiStepQuestionFormProps {
  onSubmit: (data: QuestionFormData) => Promise<void>
  onCancel?: () => void
}

// Form state that persists across all steps
export interface FormState {
  // Step 1: Source & AI Config
  jsonData: string
  selectedAIModel: string | null
  selectedContent: any | null
  
  // Step 2: Content
  title: string
  stem: string
  answerOptions: Array<{
    text: string
    is_correct: boolean
    explanation: string
    order_index: number
  }>
  teaching_point: string
  question_references: string
  
  // Step 3: Images
  questionImages: Array<{
    image_id: string
    question_section: 'stem' | 'explanation'
    order_index: number
  }>
  
  // Step 4: Metadata
  category_id: string
  question_set_id: string
  tag_ids: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  status: string
}

// Step configuration
const steps = [
  { id: 1, name: 'Source', description: 'Import JSON or select AI content' },
  { id: 2, name: 'Content', description: 'Edit question details' },
  { id: 3, name: 'Images', description: 'Add visual content' },
  { id: 4, name: 'Metadata', description: 'Categorize & finalize' }
]

export function MultiStepQuestionForm({ onSubmit, onCancel }: MultiStepQuestionFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [autoProgressEnabled, setAutoProgressEnabled] = useState(false)

  // Initialize form state with defaults
  const [formState, setFormState] = useState<FormState>({
    jsonData: '',
    selectedAIModel: null,
    selectedContent: null,
    title: '',
    stem: '',
    answerOptions: [
      { text: '', is_correct: true, explanation: '', order_index: 0 },
      { text: '', is_correct: false, explanation: '', order_index: 1 },
      { text: '', is_correct: false, explanation: '', order_index: 2 },
      { text: '', is_correct: false, explanation: '', order_index: 3 },
      { text: '', is_correct: false, explanation: '', order_index: 4 },
    ],
    teaching_point: '',
    question_references: '',
    questionImages: [],
    category_id: '',
    question_set_id: '',
    tag_ids: [],
    difficulty: 'medium',
    status: 'draft'
  })

  // Update form state helper
  const updateFormState = (updates: Partial<FormState>) => {
    setFormState(prev => ({ ...prev, ...updates }))
  }

  // Calculate progress percentage
  const progressPercentage = (currentStep / steps.length) * 100

  // Navigation handlers
  const goToNextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  // Handle final submission
  const handleFinalSubmit = async () => {
    setIsSubmitting(true)
    try {
      // Convert form state to QuestionFormData format
      const questionData: QuestionFormData = {
        title: formState.title,
        stem: formState.stem,
        answer_options: formState.answerOptions,
        teaching_point: formState.teaching_point,
        question_references: formState.question_references,
        question_images: formState.questionImages,
        category_id: formState.category_id,
        question_set_id: formState.question_set_id,
        tag_ids: formState.tag_ids,
        difficulty: formState.difficulty,
        status: formState.status
      }

      await onSubmit(questionData)
    } catch (error) {
      console.error('Submission error:', error)
      toast.error('Failed to create question')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepSourceConfig
            formState={formState}
            updateFormState={updateFormState}
          />
        )
      case 2:
        return (
          <StepContentEdit
            formState={formState}
            updateFormState={updateFormState}
          />
        )
      case 3:
        return (
          <StepImageSelection
            formState={formState}
            updateFormState={updateFormState}
          />
        )
      case 4:
        return (
          <StepMetadata
            formState={formState}
            updateFormState={updateFormState}
          />
        )
      default:
        return null
    }
  }

  // Validation for each step
  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        // Step 1: Must have either JSON data or AI-generated content
        return formState.jsonData.trim() !== '' || formState.selectedContent !== null
      case 2:
        // Step 2: Must have title, stem, and at least one correct answer
        return (
          formState.title.trim() !== '' &&
          formState.stem.trim() !== '' &&
          formState.answerOptions.some(opt => opt.is_correct && opt.text.trim() !== '')
        )
      case 3:
        // Step 3: Images are optional, always can proceed
        return true
      case 4:
        // Step 4: Must have category and question set
        return formState.category_id !== '' && formState.question_set_id !== ''
      default:
        return false
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium">
            Step {currentStep} of {steps.length}: {steps[currentStep - 1].name}
          </h3>
          <span className="text-sm text-muted-foreground">
            {Math.round(progressPercentage)}% Complete
          </span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex flex-col items-center flex-1 ${
              step.id < currentStep
                ? 'text-primary'
                : step.id === currentStep
                ? 'text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                step.id < currentStep
                  ? 'bg-primary border-primary text-primary-foreground'
                  : step.id === currentStep
                  ? 'border-primary bg-background'
                  : 'border-muted bg-background'
              }`}
            >
              {step.id < currentStep ? (
                <Check className="h-5 w-5" />
              ) : (
                <span className="text-sm font-semibold">{step.id}</span>
              )}
            </div>
            <div className="mt-2 text-center">
              <p className="text-xs font-medium">{step.name}</p>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={goToPreviousStep}
              disabled={isSubmitting}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
          )}
          {onCancel && (
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {currentStep < steps.length ? (
            <Button
              onClick={goToNextStep}
              disabled={!canProceedToNextStep() || isSubmitting}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleFinalSubmit}
              disabled={!canProceedToNextStep() || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Question'}
              <Check className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

