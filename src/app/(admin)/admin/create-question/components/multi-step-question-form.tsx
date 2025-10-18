'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Progress } from '@/shared/components/ui/progress'
import { ChevronLeft, ChevronRight, Check, Loader2, Brain } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/shared/services/client'

// Import step components (to be created)
import { StepSourceConfig } from './steps/step-source-config'
import { StepContentEdit } from './steps/step-content-edit'
import { StepImageSelection } from './steps/step-image-selection'
import { StepMetadata } from './steps/step-metadata'
import { AIQuickActionsSidebar } from './ai-quick-actions-sidebar'

// Import types
import { QuestionFormData, QuestionWithDetails } from '@/features/questions/types/questions'

interface MultiStepQuestionFormProps {
  mode?: 'create' | 'edit'
  initialData?: QuestionWithDetails & {
    question_set?: {
      id: string
      name: string
      source_type: string
      source_details?: {
        model?: string
        model_name?: string
        provider?: string
      }
      short_form?: string
    }
  }
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
  version: string
}

export function MultiStepQuestionForm({
  mode = 'create',
  initialData,
  onSubmit,
  onCancel
}: MultiStepQuestionFormProps) {
  // Extract AI model from question set if available
  const questionSetAIModel = initialData?.question_set?.source_details?.model || null

  // Step configuration - skip source step in edit mode
  const steps = mode === 'edit'
    ? [
        { id: 1, name: 'Content', description: 'Edit question details' },
        { id: 2, name: 'Images', description: 'Manage visual content' },
        { id: 3, name: 'Metadata', description: 'Update categorization' }
      ]
    : [
        { id: 1, name: 'Source', description: 'Import JSON or select AI content' },
        { id: 2, name: 'Content', description: 'Edit question details' },
        { id: 3, name: 'Images', description: 'Add visual content' },
        { id: 4, name: 'Metadata', description: 'Categorize & finalize' }
      ]

  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [autoProgressEnabled, setAutoProgressEnabled] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showAISidebar, setShowAISidebar] = useState(true)

  // Data for AI Assistant
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [questionSets, setQuestionSets] = useState<Array<{ id: string; name: string }>>([])
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([])

  // Fetch data for AI Assistant
  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        // Fetch categories
        const { data: categoriesData } = await supabase
          .from('categories')
          .select('id, name')
          .order('name')

        // Fetch question sets
        const { data: questionSetsData } = await supabase
          .from('question_sets')
          .select('id, name')
          .order('name')

        // Fetch tags
        const { data: tagsData } = await supabase
          .from('tags')
          .select('id, name')
          .order('name')

        if (categoriesData) setCategories(categoriesData)
        if (questionSetsData) setQuestionSets(questionSetsData)
        if (tagsData) setTags(tagsData)
      } catch (error) {
        console.error('Error fetching data for AI Assistant:', error)
      }
    }

    fetchData()
  }, [])

  // Initialize form state with defaults or initialData
  const getInitialFormState = (): FormState => {
    if (mode === 'edit' && initialData) {
      return {
        jsonData: '',
        selectedAIModel: null,
        selectedContent: null,
        title: initialData.title || '',
        stem: initialData.stem || '',
        answerOptions: initialData.question_options?.map((opt, idx) => ({
          text: opt.text,
          is_correct: opt.is_correct,
          explanation: opt.explanation || '',
          order_index: idx,
        })) || [],
        teaching_point: initialData.teaching_point || '',
        question_references: initialData.question_references || '',
        questionImages: initialData.question_images?.map((img, idx) => ({
          image_id: img.image_id,
          question_section: img.question_section,
          order_index: idx,
        })) || [],
        category_id: initialData.category_id || '',
        question_set_id: initialData.question_set_id || '',
        tag_ids: initialData.question_tags?.map(qt => qt.tag.id) || [],
        difficulty: initialData.difficulty || 'medium',
        status: initialData.status || 'draft',
        version: initialData.version || '1.0.0'
      }
    }

    return {
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
      status: 'draft',
      version: '1.0.0'
    }
  }

  const [formState, setFormState] = useState<FormState>(getInitialFormState())

  // Update form state helper
  const updateFormState = (updates: Partial<FormState>) => {
    setFormState(prev => ({ ...prev, ...updates }))
  }

  // Calculate progress percentage
  const progressPercentage = (currentStep / steps.length) * 100

  // Navigation handlers with smooth transitions
  const goToNextStep = () => {
    if (currentStep < steps.length && !isTransitioning) {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentStep(prev => prev + 1)
        setTimeout(() => setIsTransitioning(false), 150)
      }, 150)
    }
  }

  const goToPreviousStep = () => {
    if (currentStep > 1 && !isTransitioning) {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentStep(prev => prev - 1)
        setTimeout(() => setIsTransitioning(false), 150)
      }, 150)
    }
  }

  // Direct step navigation (for edit mode)
  const goToStep = (stepId: number) => {
    if (mode === 'edit' && stepId !== currentStep && !isTransitioning) {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentStep(stepId)
        setTimeout(() => setIsTransitioning(false), 150)
      }, 150)
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
    if (mode === 'edit') {
      // Edit mode: skip source step
      switch (currentStep) {
        case 1:
          return (
            <StepContentEdit
              formState={formState}
              updateFormState={updateFormState}
              questionSetAIModel={questionSetAIModel}
            />
          )
        case 2:
          return (
            <StepImageSelection
              formState={formState}
              updateFormState={updateFormState}
            />
          )
        case 3:
          return (
            <StepMetadata
              formState={formState}
              updateFormState={updateFormState}
              initialQuestionSetId={initialData?.question_set?.id}
            />
          )
        default:
          return null
      }
    }

    // Create mode: include all steps
    switch (currentStep) {
      case 1:
        return (
          <StepSourceConfig
            formState={formState}
            updateFormState={updateFormState}
            onNext={goToNextStep}
          />
        )
      case 2:
        return (
          <StepContentEdit
            formState={formState}
            updateFormState={updateFormState}
            questionSetAIModel={questionSetAIModel}
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
            initialQuestionSetId={initialData?.question_set?.id}
          />
        )
      default:
        return null
    }
  }

  // Validation for each step
  const canProceedToNextStep = () => {
    if (mode === 'edit') {
      // Edit mode validation
      switch (currentStep) {
        case 1:
          // Step 1 (Content): Must have title, stem, and at least one correct answer
          return (
            formState.title.trim() !== '' &&
            formState.stem.trim() !== '' &&
            formState.answerOptions.some(opt => opt.is_correct && opt.text.trim() !== '')
          )
        case 2:
          // Step 2 (Images): Images are optional, always can proceed
          return true
        case 3:
          // Step 3 (Metadata): Must have category and question set
          return formState.category_id !== '' && formState.question_set_id !== ''
        default:
          return false
      }
    }

    // Create mode validation
    switch (currentStep) {
      case 1:
        // Step 1: Must have either JSON data or (AI model + selected content)
        return formState.jsonData.trim() !== '' ||
               (formState.selectedAIModel !== null && formState.selectedContent !== null)
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
    <div className="space-y-8">
      {/* Main Content Area with Sidebar */}
      <div className="flex flex-col xl:flex-row gap-8">
        {/* Main Content Area */}
        <div className="flex-1 space-y-8 min-w-0">
          {/* AI Assistant Toggle */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAISidebar(!showAISidebar)}
              className="flex items-center gap-2"
            >
              <Brain className="h-4 w-4" />
              {showAISidebar ? 'Hide AI Assistant' : 'Show AI Assistant'}
            </Button>
          </div>

          {/* Step Navigation - Centered within main content area */}
          <div className="flex justify-center">
            <div className="relative" style={{ width: '600px' }}>
              {/* Connecting Lines Layer - Behind circles */}
              <div className="absolute top-4 left-0 right-0 flex items-center">
                <div className="flex items-center w-full">
                  {/* Calculate positions for lines between circles */}
                  {steps.map((step, index) => {
                    if (index === steps.length - 1) return null // No line after last step

                    const isLineCompleted = step.id < currentStep

                    return (
                      <div key={`line-${step.id}`} className="flex items-center flex-1">
                        {/* Spacer for current circle */}
                        <div className="w-4" />

                        {/* Connecting line */}
                        <div className="flex-1 h-0.5 bg-border relative">
                          <div
                            className={`absolute top-0 left-0 h-full transition-all duration-500 ease-in-out ${
                              isLineCompleted ? 'w-full bg-primary' : 'w-0 bg-primary'
                            }`}
                          />
                        </div>

                        {/* Spacer for next circle */}
                        <div className="w-4" />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Steps Layer - Above lines */}
              <div className="relative flex items-start justify-between">
                {steps.map((step) => {
                  const isCompleted = step.id < currentStep
                  const isCurrent = step.id === currentStep

                  return (
                    <div key={step.id} className="flex flex-col items-center">
                      {/* Circle */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative z-10 ${
                          isCompleted
                            ? 'bg-primary border-primary text-primary-foreground'
                            : isCurrent
                            ? 'bg-background border-primary text-primary'
                            : 'bg-background border-border text-muted-foreground'
                        } ${
                          mode === 'edit' ? 'cursor-pointer hover:scale-105 hover:shadow-md' : ''
                        }`}
                        onClick={() => goToStep(step.id)}
                      >
                        {isCompleted ? (
                          <Check className="h-3 w-3 stroke-[3]" />
                        ) : (
                          <span className="text-sm font-semibold">{step.id}</span>
                        )}
                      </div>

                      {/* Label */}
                      <div className="mt-3 text-center">
                        <p className={`text-sm font-semibold transition-colors duration-300 ${
                          isCurrent ? 'text-foreground' : isCompleted ? 'text-primary' : 'text-muted-foreground'
                        }`}>
                          {step.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-[120px]">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

        {/* Step Content with Smooth Transitions */}
        <div className="min-h-[500px] relative overflow-hidden">
          <div
            className={`transition-all duration-300 ease-in-out ${
              isTransitioning
                ? 'opacity-0 transform translate-x-4'
                : 'opacity-100 transform translate-x-0'
            }`}
          >
            {renderStep()}
          </div>
        </div>

        {/* Navigation Buttons - Streamlined Layout */}
        <div className="flex justify-between items-center pt-6 border-t">
          <div>
            {currentStep > 1 ? (
              <Button
                variant="outline"
                onClick={goToPreviousStep}
                disabled={isSubmitting || isTransitioning}
                size="lg"
                className="min-w-[120px]"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            ) : (
              onCancel && (
                <Button
                  variant="ghost"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  size="lg"
                >
                  Cancel
                </Button>
              )
            )}
          </div>

          <div>
            {currentStep < steps.length ? (
              <Button
                onClick={goToNextStep}
                disabled={!canProceedToNextStep() || isSubmitting || isTransitioning}
                size="lg"
                className="min-w-[120px]"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleFinalSubmit}
                disabled={!canProceedToNextStep() || isSubmitting || isTransitioning}
                size="lg"
                className="min-w-[160px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    {mode === 'edit' ? 'Save Changes' : 'Create Question'}
                    <Check className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        </div>

        {/* AI Assistant Sidebar - Responsive: Side on XL+, Bottom on smaller screens */}
        {showAISidebar && (
          <div className="w-full xl:w-96 shrink-0">
            <AIQuickActionsSidebar
              formState={formState}
              updateFormState={updateFormState}
              modelName={questionSetAIModel || formState.selectedAIModel || 'Llama-3.3-8B-Instruct'}
              categories={categories}
              questionSets={questionSets}
              tags={tags}
            />
          </div>
        )}
      </div>
    </div>
  )
}

