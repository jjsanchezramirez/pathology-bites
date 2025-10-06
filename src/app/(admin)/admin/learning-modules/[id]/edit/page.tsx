// src/app/(admin)/admin/learning-modules/[id]/edit/page.tsx

'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Eye, Trash2 } from 'lucide-react'
import { useLearningModule } from '@/features/learning-modules/hooks'
import { LearningModuleFormData } from '@/features/learning-modules/types/learning-modules'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'

interface EditLearningModulePageProps {
  params: Promise<{ id: string }>
}

export default function EditLearningModulePage({ params }: EditLearningModulePageProps) {
  const router = useRouter()
  const [moduleId, setModuleId] = useState<string>('')
  const { module, loading: moduleLoading, error } = useLearningModule(moduleId)

  // Resolve params
  useEffect(() => {
    params.then(resolvedParams => {
      setModuleId(resolvedParams.id)
    })
  }, [params])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<LearningModuleFormData | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Initialize form data when module loads
  useEffect(() => {
    if (module) {
      setFormData({
        title: module.title,
        description: module.description || '',
        content: module.content || '',
        learning_objectives: module.learning_objectives || [],
        difficulty_level: module.difficulty_level,
        estimated_duration_minutes: module.estimated_duration_minutes,
        content_type: module.content_type,
        external_content_url: module.external_content_url || '',
        category_id: module.category_id,
        parent_module_id: module.parent_module_id || undefined,
        is_featured: module.is_featured,
        image_ids: [],
        prerequisite_module_ids: []
      })
    }
  }, [module])

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/categories')
        if (response.ok) {
          const data = await response.json()
          setCategories(data.data || [])
        }
      } catch (error) {
        console.error('Error loading categories:', error)
      }
    }

    loadCategories()
  }, [])

  // Track unsaved changes
  useEffect(() => {
    if (module && formData) {
      const hasChanges = (
        formData.title !== module.title ||
        formData.description !== (module.description || '') ||
        formData.content !== (module.content || '') ||
        JSON.stringify(formData.learning_objectives) !== JSON.stringify(module.learning_objectives || []) ||
        formData.difficulty_level !== module.difficulty_level ||
        formData.estimated_duration_minutes !== module.estimated_duration_minutes ||
        formData.content_type !== module.content_type ||
        formData.external_content_url !== (module.external_content_url || '') ||
        formData.category_id !== module.category_id ||
        formData.parent_module_id !== module.parent_module_id ||
        formData.is_featured !== module.is_featured
      )
      setHasUnsavedChanges(hasChanges)
    }
  }, [module, formData])

  const handleInputChange = (field: keyof LearningModuleFormData, value: any) => {
    if (!formData) return
    
    setFormData(prev => ({
      ...prev!,
      [field]: value
    }))
  }

  const handleSubmit = async (status?: string) => {
    if (!formData || !module) return

    try {
      setLoading(true)

      const submitData = {
        ...formData,
        ...(status && { status })
      }

      const response = await fetch(`/api/content/learning/modules-modules/${moduleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update module')
      }

      setHasUnsavedChanges(false)
      router.push(`/admin/learning-modules/${moduleId}`)
    } catch (error) {
      console.error('Error updating module:', error)
      alert('Failed to update module. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this module? This action cannot be undone.')) {
      return
    }

    try {
      setLoading(true)

      const response = await fetch(`/api/content/learning/modules-modules/${moduleId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete module')
      }

      router.push('/admin/learning-modules')
    } catch (error) {
      console.error('Error deleting module:', error)
      alert('Failed to delete module. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (moduleLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !module || !formData) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>
            {error || 'Module not found'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Learning Module</h1>
            <p className="text-gray-600">{module.title}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" disabled={loading}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleSubmit()}
            disabled={!hasUnsavedChanges || loading}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
          <Button 
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {hasUnsavedChanges && (
        <Alert>
          <AlertDescription>
            You have unsaved changes. Don't forget to save your work.
          </AlertDescription>
        </Alert>
      )}

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
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="difficulty">Difficulty Level</Label>
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
                  <Label htmlFor="duration">Duration (minutes)</Label>
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
                  <Label htmlFor="content-type">Content Type</Label>
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
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => handleInputChange('category_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.content_type === 'video' && (
                <div>
                  <Label htmlFor="external-url">External Content URL</Label>
                  <Input
                    id="external-url"
                    value={formData.external_content_url}
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
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Current Status:</span>
                  <Badge variant="secondary" className={
                    module.status === 'published' ? 'bg-green-100 text-green-800' :
                    module.status === 'review' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }>
                    {module.status}
                  </Badge>
                </div>

                {module.status !== 'published' && (
                  <Button 
                    className="w-full" 
                    onClick={() => handleSubmit('published')}
                    disabled={loading}
                  >
                    Publish Module
                  </Button>
                )}

                {module.status === 'published' && (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => handleSubmit('archived')}
                    disabled={loading}
                  >
                    Archive Module
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

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
            </CardContent>
          </Card>

          {/* Module Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Views:</span>
                <span className="font-medium">{module.view_count}</span>
              </div>
              {module.average_rating && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Rating:</span>
                  <span className="font-medium">{module.average_rating.toFixed(1)}/5</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Created:</span>
                <span className="font-medium">
                  {new Date(module.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Updated:</span>
                <span className="font-medium">
                  {new Date(module.updated_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
