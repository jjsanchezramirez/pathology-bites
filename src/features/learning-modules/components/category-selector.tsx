// src/features/learning-modules/components/category-selector.tsx

'use client'

import React, { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus } from 'lucide-react'
import { LearningModuleIntegrationService } from '../services/integration-service'
import { Button } from '@/shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'

interface Category {
  id: string
  name: string
  description?: string
  level: number
  color?: string
  parent_id?: string
  children?: Category[]
}

interface CategorySelectorProps {
  selectedCategoryId?: string
  onCategoryChange: (categoryId: string) => void
  allowCreate?: boolean
  showHierarchy?: boolean
  className?: string
}

export function CategorySelector({
  selectedCategoryId,
  onCategoryChange,
  allowCreate = false,
  showHierarchy = true,
  className = ''
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryHierarchy, setCategoryHierarchy] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newCategoryData, setNewCategoryData] = useState({
    name: '',
    description: '',
    parentId: '',
    color: ''
  })

  const integrationService = new LearningModuleIntegrationService()

  const loadCategories = async () => {
    try {
      setLoading(true)
      const [flatCategories, hierarchyData] = await Promise.all([
        integrationService.getCategories(),
        integrationService.getCategoryHierarchy()
      ])
      setCategories(flatCategories)
      setCategoryHierarchy(hierarchyData)
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const handleCategoryToggle = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  const handleCreateCategory = async () => {
    try {
      // This would call the existing category creation API
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newCategoryData.name,
          description: newCategoryData.description,
          parentId: newCategoryData.parentId || null,
          color: newCategoryData.color || null
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create category')
      }

      const result = await response.json()
      
      // Reload categories
      await loadCategories()
      
      // Select the new category
      onCategoryChange(result.data.id)
      
      // Reset form and close dialog
      setNewCategoryData({ name: '', description: '', parentId: '', color: '' })
      setShowCreateDialog(false)
    } catch (error) {
      console.error('Error creating category:', error)
      alert('Failed to create category')
    }
  }

  const renderCategoryTree = (categories: Category[], level = 0) => {
    return categories.map((category) => (
      <div key={category.id} className="space-y-1">
        <div
          className={`
            flex items-center gap-2 p-2 rounded cursor-pointer transition-colors
            ${selectedCategoryId === category.id ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-50'}
          `}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => onCategoryChange(category.id)}
        >
          {category.children && category.children.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              onClick={(e) => {
                e.stopPropagation()
                handleCategoryToggle(category.id)
              }}
            >
              {expandedCategories.has(category.id) ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          )}
          
          {category.children && category.children.length > 0 ? (
            expandedCategories.has(category.id) ? (
              <FolderOpen className="h-4 w-4 text-blue-600" />
            ) : (
              <Folder className="h-4 w-4 text-blue-600" />
            )
          ) : (
            <div className="w-4" />
          )}

          <span className="flex-1 text-sm font-medium">{category.name}</span>
          
          {category.color && (
            <div
              className="w-3 h-3 rounded-full border"
              style={{ backgroundColor: category.color }}
            />
          )}
          
          <Badge variant="outline" className="text-xs">
            Level {category.level}
          </Badge>
        </div>

        {category.children && 
         category.children.length > 0 && 
         expandedCategories.has(category.id) && (
          <div>
            {renderCategoryTree(category.children, level + 1)}
          </div>
        )}
      </div>
    ))
  }

  const getSelectedCategoryPath = () => {
    if (!selectedCategoryId) return []
    
    const findPath = (categories: Category[], targetId: string, path: Category[] = []): Category[] | null => {
      for (const category of categories) {
        const currentPath = [...path, category]
        
        if (category.id === targetId) {
          return currentPath
        }
        
        if (category.children) {
          const result = findPath(category.children, targetId, currentPath)
          if (result) return result
        }
      }
      return null
    }

    return findPath(categoryHierarchy, selectedCategoryId) || []
  }

  const selectedCategory = categories.find(c => c.id === selectedCategoryId)
  const categoryPath = getSelectedCategoryPath()

  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Selected Category Display */}
      {selectedCategory && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900">{selectedCategory.name}</h4>
                  {selectedCategory.color && (
                    <div
                      className="w-3 h-3 rounded-full border"
                      style={{ backgroundColor: selectedCategory.color }}
                    />
                  )}
                </div>
                
                {categoryPath.length > 1 && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    {categoryPath.map((cat, index) => (
                      <React.Fragment key={cat.id}>
                        {index > 0 && <ChevronRight className="h-3 w-3" />}
                        <span>{cat.name}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
                
                {selectedCategory.description && (
                  <p className="text-sm text-gray-600 mt-1">{selectedCategory.description}</p>
                )}
              </div>
              
              <Badge variant="outline">
                Level {selectedCategory.level}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Selection */}
      {showHierarchy ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Select Category</CardTitle>
              {allowCreate && (
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-3 w-3 mr-1" />
                      New
                    </Button>
                  </DialogTrigger>
                  
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Category</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="category-name">Category Name *</Label>
                        <Input
                          id="category-name"
                          value={newCategoryData.name}
                          onChange={(e) => setNewCategoryData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter category name..."
                        />
                      </div>

                      <div>
                        <Label htmlFor="category-description">Description</Label>
                        <Textarea
                          id="category-description"
                          value={newCategoryData.description}
                          onChange={(e) => setNewCategoryData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Brief description..."
                          rows={3}
                        />
                      </div>

                      <div>
                        <Label htmlFor="parent-category">Parent Category</Label>
                        <Select
                          value={newCategoryData.parentId}
                          onValueChange={(value) => setNewCategoryData(prev => ({ ...prev, parentId: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select parent category (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No parent (root category)</SelectItem>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {'  '.repeat(category.level - 1)}{category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="category-color">Color (optional)</Label>
                        <Input
                          id="category-color"
                          type="color"
                          value={newCategoryData.color}
                          onChange={(e) => setNewCategoryData(prev => ({ ...prev, color: e.target.value }))}
                          className="h-10"
                        />
                      </div>

                      <Button 
                        onClick={handleCreateCategory}
                        disabled={!newCategoryData.name.trim()}
                        className="w-full"
                      >
                        Create Category
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-64 overflow-y-auto border rounded p-2">
              {categoryHierarchy.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No categories available
                </div>
              ) : (
                renderCategoryTree(categoryHierarchy)
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div>
          <Label>Category</Label>
          <Select value={selectedCategoryId || ''} onValueChange={onCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {'  '.repeat(category.level - 1)}{category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
