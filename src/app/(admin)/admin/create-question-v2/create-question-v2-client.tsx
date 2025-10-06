'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Badge } from '@/shared/components/ui/badge'
import { ContentSelector } from './components/content-selector'
import { ModelSelector } from './components/model-selector'
import { QuestionGenerator } from './components/question-generator'
import { QuestionPreview } from './components/question-preview'
import { ImageAttachment } from './components/image-attachment'
import { QuestionFinalization } from './components/question-finalization'

export interface EducationalContent {
  category: string
  subject: string
  lesson: string
  topic: string
  content: any
}

export interface GeneratedQuestion {
  title: string
  stem: string
  difficulty: 'easy' | 'medium' | 'hard'
  teaching_point: string
  question_references?: string
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
  metadata: {
    exported_at: string
    exported_by: string
    source_content: {
      category: string
      subject: string
      lesson: string
      topic: string
    }
    generated_by: {
      provider: string
      model: string
      response_time?: number
      token_usage?: any
    }
  }
}

export interface ImageAttachment {
  id: string
  file: File
  preview: string
  section: 'stem' | 'explanation'
  alt_text: string
  caption: string
}

export function CreateQuestionV2Client() {
  const [activeTab, setActiveTab] = useState('content')
  const [selectedContent, setSelectedContent] = useState<EducationalContent | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [generatedQuestion, setGeneratedQuestion] = useState<GeneratedQuestion | null>(null)
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const handleContentSelected = (content: EducationalContent) => {
    setSelectedContent(content)
    setActiveTab('model')
  }

  const handleModelSelected = (model: string) => {
    setSelectedModel(model)
    setActiveTab('generate')
  }

  const handleQuestionGenerated = (question: GeneratedQuestion) => {
    setGeneratedQuestion(question)
    setActiveTab('preview')
  }

  const handleQuestionUpdated = (question: GeneratedQuestion) => {
    setGeneratedQuestion(question)
  }

  const handleImagesAttached = (images: ImageAttachment[]) => {
    setAttachedImages(images)
  }

  const handleQuestionCreated = () => {
    // Reset form
    setSelectedContent(null)
    setSelectedModel('')
    setGeneratedQuestion(null)
    setAttachedImages([])
    setActiveTab('content')
  }

  const canProceedToModel = selectedContent !== null
  const canProceedToGenerate = selectedContent !== null && selectedModel !== ''
  const canProceedToPreview = generatedQuestion !== null
  const canProceedToImages = generatedQuestion !== null
  const canProceedToFinalize = generatedQuestion !== null

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="content" className="flex items-center gap-2">
            <span className="hidden sm:inline">Content</span>
            <span className="sm:hidden">1</span>
            {selectedContent && <Badge variant="secondary" className="ml-1">✓</Badge>}
          </TabsTrigger>
          <TabsTrigger value="model" disabled={!canProceedToModel} className="flex items-center gap-2">
            <span className="hidden sm:inline">Model</span>
            <span className="sm:hidden">2</span>
            {selectedModel && <Badge variant="secondary" className="ml-1">✓</Badge>}
          </TabsTrigger>
          <TabsTrigger value="generate" disabled={!canProceedToGenerate} className="flex items-center gap-2">
            <span className="hidden sm:inline">Generate</span>
            <span className="sm:hidden">3</span>
            {generatedQuestion && <Badge variant="secondary" className="ml-1">✓</Badge>}
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={!canProceedToPreview} className="flex items-center gap-2">
            <span className="hidden sm:inline">Preview</span>
            <span className="sm:hidden">4</span>
          </TabsTrigger>
          <TabsTrigger value="images" disabled={!canProceedToImages} className="flex items-center gap-2">
            <span className="hidden sm:inline">Images</span>
            <span className="sm:hidden">5</span>
            {attachedImages.length > 0 && <Badge variant="secondary" className="ml-1">{attachedImages.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="finalize" disabled={!canProceedToFinalize} className="flex items-center gap-2">
            <span className="hidden sm:inline">Finalize</span>
            <span className="sm:hidden">6</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Educational Content</CardTitle>
              <CardDescription>
                Choose the educational context that will guide the AI question generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContentSelector
                selectedContent={selectedContent}
                onContentSelected={handleContentSelected}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="model" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select AI Model</CardTitle>
              <CardDescription>
                Choose the AI model that will generate your question. Different models have different strengths.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModelSelector
                selectedModel={selectedModel}
                onModelSelected={handleModelSelected}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Question</CardTitle>
              <CardDescription>
                Configure generation parameters and create your question using AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuestionGenerator
                selectedContent={selectedContent}
                selectedModel={selectedModel}
                isGenerating={isGenerating}
                onGeneratingChange={setIsGenerating}
                onQuestionGenerated={handleQuestionGenerated}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preview & Edit Question</CardTitle>
              <CardDescription>
                Review the generated question and make any necessary adjustments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuestionPreview
                question={generatedQuestion}
                onQuestionUpdated={handleQuestionUpdated}
                onProceedToImages={() => setActiveTab('images')}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attach Images</CardTitle>
              <CardDescription>
                Add images to enhance your question (optional)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageAttachment
                attachedImages={attachedImages}
                onImagesAttached={handleImagesAttached}
                onProceedToFinalize={() => setActiveTab('finalize')}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finalize" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Finalize Question</CardTitle>
              <CardDescription>
                Set question metadata and save to the database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuestionFinalization
                question={generatedQuestion}
                attachedImages={attachedImages}
                onQuestionCreated={handleQuestionCreated}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
