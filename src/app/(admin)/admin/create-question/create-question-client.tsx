'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { ContentSelector } from './components/content-selector'
import { QuestionForm } from './components/question-form'
import { ImageAttachmentsTab } from './components/image-attachments-tab'
import { QuestionPreview } from './components/question-preview'
import { QuestionFinalization } from './components/question-finalization'
import { ErrorBoundary } from './components/error-boundary'
import { AutoSaveIndicator } from './components/auto-save-indicator'
import { useAutoSave } from '@/shared/hooks/use-auto-save'
import { toast } from 'sonner'

import { FileText, Brain, Image as ImageIcon, Eye, Upload, ChevronLeft, Save } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { SessionStatusIndicator } from '@/shared/components/auth/session-status-indicator'

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

interface ImageAttachment {
  image_id: string
  question_section: 'stem' | 'explanation'
  order_index: number
}

const STORAGE_KEY = 'create-question-state'

// Define form state for QuestionForm component
interface QuestionFormState {
  instructions: string
  additionalContext: string
  selectedModelIndex: number
  assumeHistologicImages: boolean
}

// Define the complete state structure for persistence
interface CreateQuestionState {
  activeTab: string
  selectedContent: EducationalContent | null
  generatedQuestion: GeneratedQuestion | null
  attachedImages: ImageAttachment[]
  hasUnsavedChanges: boolean
  formState: QuestionFormState
  timestamp: number
}

export function CreateQuestionClient() {
  const [activeTab, setActiveTab] = useState('content')
  const [selectedContent, setSelectedContent] = useState<EducationalContent | null>(null)
  const [generatedQuestion, setGeneratedQuestion] = useState<GeneratedQuestion | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isStateRestored, setIsStateRestored] = useState(false)
  const [lastSaveTime, setLastSaveTime] = useState<number | undefined>()
  const [formState, setFormState] = useState<QuestionFormState>({
    instructions: '',
    additionalContext: '',
    selectedModelIndex: 0,
    assumeHistologicImages: false
  })

  // Create the state object for auto-save
  const currentState: CreateQuestionState = {
    activeTab,
    selectedContent,
    generatedQuestion,
    attachedImages,
    hasUnsavedChanges,
    formState,
    timestamp: Date.now()
  }

  // Handle previous tab navigation
  const handlePreviousTab = (targetTab: string) => {
    setActiveTab(targetTab)
  }

  // State restoration function
  const restoreState = useCallback((savedState: CreateQuestionState) => {
    try {
      // Check if saved state is recent (within 24 hours)
      const isRecent = Date.now() - savedState.timestamp < 24 * 60 * 60 * 1000

      if (!isRecent) {
        console.log('Saved state is too old, skipping restoration')
        return
      }

      setActiveTab(savedState.activeTab || 'content')
      setSelectedContent(savedState.selectedContent)
      setGeneratedQuestion(savedState.generatedQuestion)
      setAttachedImages(savedState.attachedImages || [])
      setHasUnsavedChanges(savedState.hasUnsavedChanges || false)
      setFormState(savedState.formState || {
        instructions: '',
        additionalContext: '',
        selectedModelIndex: 0,
        assumeHistologicImages: false
      })
      setIsStateRestored(true)

      // Show restoration notification if there was meaningful content
      if (savedState.selectedContent || savedState.generatedQuestion) {
        toast.success('Previous work restored', {
          description: 'Your unsaved progress has been recovered from auto-save.',
          duration: 5000
        })
      }
    } catch (error) {
      console.error('Failed to restore state:', error)
      toast.error('Failed to restore previous work', {
        description: 'Starting with a fresh form.'
      })
    }
  }, [])

  // Initialize auto-save with state restoration
  const autoSave = useAutoSave({
    key: STORAGE_KEY,
    data: currentState,
    enabled: true,
    interval: 10000, // Save every 10 seconds
    onRestore: restoreState,
    onSave: () => {
      // Update last save time for indicator
      setLastSaveTime(Date.now())
      console.log('Auto-saved create-question state')
    },
    onError: (error) => {
      console.error('Auto-save error:', error)
    }
  })

  // Restore state on component mount
  useEffect(() => {
    if (!isStateRestored) {
      const restored = autoSave.restore()
      if (!restored) {
        setIsStateRestored(true)
      }
    }
  }, [autoSave, isStateRestored])



  // Prevent accidental page refresh when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        // Modern browsers ignore custom messages, but still show a generic warning
        const message = 'You have unsaved changes. Are you sure you want to leave?'
        e.returnValue = message
        return message
      }
    }

    // Also prevent accidental navigation via browser back/forward
    const handlePopState = (e: PopStateEvent) => {
      if (hasUnsavedChanges) {
        const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?')
        if (!confirmLeave) {
          // Push the current state back to prevent navigation
          window.history.pushState(null, '', window.location.href)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [hasUnsavedChanges])

  const handleContentSelect = (content: EducationalContent) => {
    setSelectedContent(content)
    setActiveTab('generate')
    setHasUnsavedChanges(true)
    // Trigger immediate save when content is selected
    setTimeout(() => autoSave.save(), 100)
  }

  const handleQuestionGenerated = (question: GeneratedQuestion) => {
    setGeneratedQuestion(question)
    setActiveTab('preview')
    setHasUnsavedChanges(true)
    // Trigger immediate save when question is generated
    setTimeout(() => autoSave.save(), 100)
  }

  const handleQuestionUpdated = (question: GeneratedQuestion) => {
    setGeneratedQuestion(question)
    setHasUnsavedChanges(true)
    // Trigger immediate save when question is updated
    setTimeout(() => autoSave.save(), 100)
  }

  const handleFilesUploaded = (files: File[]) => {
    setUploadedFiles(files)
    setHasUnsavedChanges(true)
    // Note: Files are not persisted in localStorage due to size limitations
    // Only the file names/metadata could be saved if needed
  }

  const handleAttachedImagesChange = (images: ImageAttachment[]) => {
    setAttachedImages(images)
    setHasUnsavedChanges(true)
    // Trigger immediate save when images are attached
    setTimeout(() => autoSave.save(), 100)
  }

  const handleFormStateChange = (newFormState: QuestionFormState) => {
    setFormState(newFormState)
    setHasUnsavedChanges(true)
    // Debounced save for form changes (will be handled by auto-save interval)
  }





  const canProceedToGenerate = selectedContent !== null
  const canProceedToImages = generatedQuestion !== null
  const canProceedToPreview = generatedQuestion !== null
  const canProceedToFinalize = generatedQuestion !== null



  return (
    <div className="space-y-6" data-unsaved-changes={hasUnsavedChanges ? "true" : "false"}>
      {/* Session status monitoring for silent refresh notifications */}
      <SessionStatusIndicator showNotifications={true} position="top-right" />

      {/* Auto-save indicator and manual save */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {isStateRestored && (
            <span className="text-green-600">✓ Previous work restored</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                autoSave.save()
                toast.success('Progress saved manually')
              }}
              className="flex items-center gap-1"
            >
              <Save className="h-3 w-3" />
              Save Now
            </Button>
          )}
          <AutoSaveIndicator
            hasUnsavedChanges={hasUnsavedChanges}
            lastSaveTime={lastSaveTime}
          />
        </div>
      </div>

      <div className="transition-opacity duration-300 ease-in-out opacity-100">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="content" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger
            value="generate"
            disabled={!canProceedToGenerate}
            className="flex items-center gap-2"
          >
            <Brain className="h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            disabled={!canProceedToPreview}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger
            value="images"
            disabled={!canProceedToImages}
            className="flex items-center gap-2"
          >
            <ImageIcon className="h-4 w-4" />
            Images
          </TabsTrigger>
          <TabsTrigger
            value="finalize"
            disabled={!canProceedToFinalize}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Finalize
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Educational Content</CardTitle>
            </CardHeader>
            <CardContent>
              <ErrorBoundary>
                <ContentSelector
                  onContentSelect={handleContentSelect}
                  selectedContent={selectedContent}
                />
              </ErrorBoundary>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => handlePreviousTab('content')}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Content
            </Button>
          </div>
          <QuestionForm
            selectedContent={selectedContent}
            onQuestionGenerated={handleQuestionGenerated}
            onFilesUploaded={handleFilesUploaded}
            formState={formState}
            onFormStateChange={handleFormStateChange}
          />
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => handlePreviousTab('generate')}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Generate
            </Button>
          </div>
          <QuestionPreview
            question={generatedQuestion}
            onQuestionUpdated={handleQuestionUpdated}
          />
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => handlePreviousTab('preview')}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Preview
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Image Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageAttachmentsTab
                attachedImages={attachedImages}
                onAttachedImagesChange={handleAttachedImagesChange}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finalize" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => handlePreviousTab('images')}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Images
            </Button>
          </div>
          <QuestionFinalization
            question={generatedQuestion}
            uploadedFiles={uploadedFiles}
            attachedImages={attachedImages}
            onQuestionCreated={() => {
              // Reset the form after successful creation
              setSelectedContent(null)
              setGeneratedQuestion(null)
              setUploadedFiles([])
              setAttachedImages([])
              setActiveTab('content')
              setHasUnsavedChanges(false)
              setIsStateRestored(false)
              setFormState({
                instructions: '',
                additionalContext: '',
                selectedModelIndex: 0,
                assumeHistologicImages: false
              })
              // Clear saved state using auto-save hook
              autoSave.clear()
              toast.success('Question created successfully!', {
                description: 'Auto-save data has been cleared.'
              })
            }}
          />
        </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
