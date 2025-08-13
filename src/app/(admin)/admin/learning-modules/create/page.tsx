// src/app/(admin)/admin/learning-modules/create/page.tsx

'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Eye, Upload, X } from 'lucide-react'
import { LearningModuleFormData } from '@/features/learning-modules/types/learning-modules'
import { CategorySelector } from '@/features/learning-modules/components/category-selector'
import { ImageSelector } from '@/features/learning-modules/components/image-selector'
import { QuizIntegration } from '@/features/learning-modules/components/quiz-integration'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Separator } from '@/shared/components/ui/separator'

export default function CreateLearningModulePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<LearningModuleFormData>({
    title: '',
    description: '',
    content: '',
    learning_objectives: [],
    difficulty_level: 'beginner',
    estimated_duration_minutes: 15,
    content_type: 'text',
    category_id: '',
    is_featured: false,
    image_ids: [],
    prerequisite_module_ids: []
  })

  const [newObjective, setNewObjective] = useState('')
  const [selectedImages, setSelectedImages] = useState<any[]>([])
  const [linkedQuizId, setLinkedQuizId] = useState<string>('')
  const [parentModules, setParentModules] = useState<any[]>([])

  // Load parent modules on mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        // Load existing modules for parent selection
        const modulesResponse = await fetch('/api/learning-modules?status=published&limit=100')
        if (modulesResponse.ok) {
          const modulesData = await modulesResponse.json()
          setParentModules(modulesData.data || [])
        }
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }

    loadData()
  }, [])

  const handleInputChange = (field: keyof LearningModuleFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const addLearningObjective = () => {
    if (newObjective.trim()) {
      setFormData(prev => ({
        ...prev,
        learning_objectives: [...(prev.learning_objectives || []), newObjective.trim()]
      }))
      setNewObjective('')
    }
  }

  const removeLearningObjective = (index: number) => {
    setFormData(prev => ({
      ...prev,
      learning_objectives: prev.learning_objectives?.filter((_, i) => i !== index) || []
    }))
  }

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleSubmit = async (status: 'draft' | 'review' | 'published' = 'draft') => {
    try {
      setLoading(true)

      const submitData = {
        ...formData,
        slug: generateSlug(formData.title),
        status,
        image_ids: selectedImages.map(img => img.id),
        quiz_id: linkedQuizId || undefined
      }

      const response = await fetch('/api/admin/learning-modules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create module')
      }

      const result = await response.json()
      router.push(`/admin/learning-modules/${result.data.id}`)
    } catch (error) {
      console.error('Error creating module:', error)
      alert('Failed to create module. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = formData.title.trim() && formData.category_id

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Learning Module</h1>
            <p className="text-gray-600">Create a new learning module for your course</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" disabled={!isFormValid || loading}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleSubmit('draft')}
            disabled={!isFormValid || loading}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button 
            onClick={() => handleSubmit('review')}
            disabled={!isFormValid || loading}
          >
            Submit for Review
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter module title..."
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Brief description of the module..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="difficulty">Difficulty Level *</Label>
                  <Select
                    value={formData.difficulty_level}
                    onValueChange={(value) => handleInputChange('difficulty_level', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="duration">Duration (minutes) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={formData.estimated_duration_minutes}
                    onChange={(e) => handleInputChange('estimated_duration_minutes', parseInt(e.target.value) || 15)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="content-type">Content Type *</Label>
                  <Select
                    value={formData.content_type}
                    onValueChange={(value) => handleInputChange('content_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text Content</SelectItem>
                      <SelectItem value="video">Video Content</SelectItem>
                      <SelectItem value="interactive">Interactive Content</SelectItem>
                      <SelectItem value="mixed">Mixed Content</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Category *</Label>
                  <CategorySelector
                    selectedCategoryId={formData.category_id}
                    onCategoryChange={(categoryId) => handleInputChange('category_id', categoryId)}
                    allowCreate={true}
                    showHierarchy={false}
                  />
                </div>
              </div>

              {formData.content_type === 'video' && (
                <div>
                  <Label htmlFor="external-url">External Content URL</Label>
                  <Input
                    id="external-url"
                    value={formData.external_content_url || ''}
                    onChange={(e) => handleInputChange('external_content_url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Content */}
          <Card>
            <CardHeader>
              <CardTitle>Module Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  placeholder="Enter the module content using markdown formatting..."
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can use markdown formatting (# for headers, ** for bold, etc.)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Learning Objectives */}
          <Card>
            <CardHeader>
              <CardTitle>Learning Objectives</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="Add a learning objective..."
                  onKeyPress={(e) => e.key === 'Enter' && addLearningObjective()}
                />
                <Button onClick={addLearningObjective} disabled={!newObjective.trim()}>
                  Add
                </Button>
              </div>

              {formData.learning_objectives && formData.learning_objectives.length > 0 && (
                <div className="space-y-2">
                  {formData.learning_objectives.map((objective, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <span className="flex-1 text-sm">{objective}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLearningObjective(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageSelector
                selectedImages={selectedImages}
                onImagesChange={setSelectedImages}
                maxImages={5}
                allowedUsageTypes={['header', 'content', 'diagram', 'example']}
              />
            </CardContent>
          </Card>

          {/* Quiz Integration */}
          <Card>
            <CardHeader>
              <CardTitle>Assessment Quiz</CardTitle>
            </CardHeader>
            <CardContent>
              <QuizIntegration
                currentQuizId={linkedQuizId}
                onQuizLinked={setLinkedQuizId}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="featured"
                  checked={formData.is_featured}
                  onCheckedChange={(checked) => handleInputChange('is_featured', checked)}
                />
                <Label htmlFor="featured">Featured Module</Label>
              </div>

              <div>
                <Label htmlFor="parent-module">Parent Module (Optional)</Label>
                <Select
                  value={formData.parent_module_id || ''}
                  onValueChange={(value) => handleInputChange('parent_module_id', value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent module..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No parent module</SelectItem>
                    {parentModules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900 line-clamp-2">
                    {formData.title || 'Module Title'}
                  </h3>
                  {formData.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                      {formData.description}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {formData.difficulty_level}
                  </Badge>
                  <Badge variant="outline">
                    {formData.estimated_duration_minutes} min
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {formData.content_type}
                  </Badge>
                </div>

                {formData.learning_objectives && formData.learning_objectives.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Learning Objectives:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {formData.learning_objectives.slice(0, 3).map((objective, index) => (
                        <li key={index} className="flex items-start">
                          <span className="inline-block w-1 h-1 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0" />
                          <span className="line-clamp-1">{objective}</span>
                        </li>
                      ))}
                      {formData.learning_objectives.length > 3 && (
                        <li className="text-gray-400">
                          +{formData.learning_objectives.length - 3} more...
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
