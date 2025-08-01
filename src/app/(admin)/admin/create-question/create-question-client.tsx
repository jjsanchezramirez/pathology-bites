'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { ContentSelector } from './components/content-selector'
import { QuestionForm } from './components/question-form'
import { ImageAttachmentsTab } from './components/image-attachments-tab'
import { QuestionPreview } from './components/question-preview'
import { QuestionFinalization } from './components/question-finalization'
import { ErrorBoundary } from './components/error-boundary'

import { FileText, Brain, Image as ImageIcon, Eye, Upload, ChevronLeft } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { SessionStatusIndicator } from '@/shared/components/auth/session-status-indicator'

interface PathPrimerContent {
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

export function CreateQuestionClient() {
  const [activeTab, setActiveTab] = useState('content')
  const [selectedContent, setSelectedContent] = useState<PathPrimerContent | null>(null)
  const [generatedQuestion, setGeneratedQuestion] = useState<GeneratedQuestion | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)




  // Handle previous tab navigation
  const handlePreviousTab = (targetTab: string) => {
    setActiveTab(targetTab)
  }

  // Simple initialization - no complex state restoration
  useEffect(() => {
    // Component is ready
  }, [])



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

  const handleContentSelect = (content: PathPrimerContent) => {
    setSelectedContent(content)
    setActiveTab('generate')
    setHasUnsavedChanges(true)
  }

  const handleQuestionGenerated = (question: GeneratedQuestion) => {
    setGeneratedQuestion(question)
    setActiveTab('preview')
    setHasUnsavedChanges(true)
  }

  const handleQuestionUpdated = (question: GeneratedQuestion) => {
    setGeneratedQuestion(question)
    setHasUnsavedChanges(true)
  }

  const handleFilesUploaded = (files: File[]) => {
    setUploadedFiles(files)
    setHasUnsavedChanges(true)
  }

  const handleAttachedImagesChange = (images: ImageAttachment[]) => {
    setAttachedImages(images)
    setHasUnsavedChanges(true)
  }





  const canProceedToGenerate = selectedContent !== null
  const canProceedToImages = generatedQuestion !== null
  const canProceedToPreview = generatedQuestion !== null
  const canProceedToFinalize = generatedQuestion !== null



  return (
    <div className="space-y-6" data-unsaved-changes={hasUnsavedChanges ? "true" : "false"}>
      {/* Session status monitoring for silent refresh notifications */}
      <SessionStatusIndicator showNotifications={true} position="top-right" />



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
              <CardTitle>Select PathPrimer Content</CardTitle>
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
              // Clear saved state
              localStorage.removeItem(STORAGE_KEY)
            }}
          />
        </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
