// src/features/learning-modules/components/image-selector.tsx

'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { Search, Upload, X, Check, Grid, List, Filter } from 'lucide-react'
import { LearningModuleIntegrationService } from '../services/integration-service'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Checkbox } from '@/shared/components/ui/checkbox'

interface ImageData {
  id: string
  url: string
  description?: string
  alt_text?: string
  category?: string
  file_type: string
  width: number
  height: number
  created_at: string
}

interface SelectedImage extends ImageData {
  usage_type: 'header' | 'content' | 'diagram' | 'example' | 'thumbnail'
  sort_order: number
  caption?: string
  content_section?: string
}

interface ImageSelectorProps {
  selectedImages: SelectedImage[]
  onImagesChange: (images: SelectedImage[]) => void
  maxImages?: number
  allowedUsageTypes?: ('header' | 'content' | 'diagram' | 'example' | 'thumbnail')[]
  className?: string
}

export function ImageSelector({
  selectedImages,
  onImagesChange,
  maxImages = 10,
  allowedUsageTypes = ['header', 'content', 'diagram', 'example', 'thumbnail'],
  className = ''
}: ImageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [images, setImages] = useState<ImageData[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedForAdd, setSelectedForAdd] = useState<ImageData[]>([])

  const integrationService = new LearningModuleIntegrationService()

  const loadImages = async () => {
    try {
      setLoading(true)
      const imageData = await integrationService.getImages({
        category: categoryFilter || undefined,
        search: searchTerm || undefined,
        limit: 50
      })
      setImages(imageData)
    } catch (error) {
      console.error('Error loading images:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadImages()
    }
  }, [isOpen, searchTerm, categoryFilter])

  const handleImageSelect = (image: ImageData, selected: boolean) => {
    if (selected) {
      setSelectedForAdd([...selectedForAdd, image])
    } else {
      setSelectedForAdd(selectedForAdd.filter(img => img.id !== image.id))
    }
  }

  const handleAddImages = () => {
    const newImages: SelectedImage[] = selectedForAdd.map((image, index) => ({
      ...image,
      usage_type: 'content' as const,
      sort_order: selectedImages.length + index,
      caption: image.description || '',
      content_section: ''
    }))

    onImagesChange([...selectedImages, ...newImages])
    setSelectedForAdd([])
    setIsOpen(false)
  }

  const handleRemoveImage = (imageId: string) => {
    const updatedImages = selectedImages.filter(img => img.id !== imageId)
    // Reorder remaining images
    const reorderedImages = updatedImages.map((img, index) => ({
      ...img,
      sort_order: index
    }))
    onImagesChange(reorderedImages)
  }

  const handleImageUpdate = (imageId: string, updates: Partial<SelectedImage>) => {
    const updatedImages = selectedImages.map(img =>
      img.id === imageId ? { ...img, ...updates } : img
    )
    onImagesChange(updatedImages)
  }

  const handleReorder = (imageId: string, direction: 'up' | 'down') => {
    const currentIndex = selectedImages.findIndex(img => img.id === imageId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= selectedImages.length) return

    const reorderedImages = [...selectedImages]
    const [movedImage] = reorderedImages.splice(currentIndex, 1)
    reorderedImages.splice(newIndex, 0, movedImage)

    // Update sort_order for all images
    const updatedImages = reorderedImages.map((img, index) => ({
      ...img,
      sort_order: index
    }))

    onImagesChange(updatedImages)
  }

  const isImageSelected = (imageId: string) => {
    return selectedImages.some(img => img.id === imageId) || 
           selectedForAdd.some(img => img.id === imageId)
  }

  const canAddMoreImages = selectedImages.length + selectedForAdd.length < maxImages

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Selected Images */}
        {selectedImages.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Selected Images ({selectedImages.length})</Label>
            <div className="space-y-3">
              {selectedImages
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((image, index) => (
                  <Card key={image.id} className="p-3">
                    <div className="flex gap-3">
                      <div className="relative w-16 h-16 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                        <Image
                          src={image.url}
                          alt={image.alt_text || ''}
                          fill
                          className="object-cover"
                          unoptimized={true}
                        />
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900 line-clamp-1">
                              {image.description || 'Untitled Image'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {image.width} × {image.height} • {image.file_type}
                            </p>
                          </div>
                          
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReorder(image.id, 'up')}
                              disabled={index === 0}
                            >
                              ↑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReorder(image.id, 'down')}
                              disabled={index === selectedImages.length - 1}
                            >
                              ↓
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveImage(image.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Usage Type</Label>
                            <Select
                              value={image.usage_type}
                              onValueChange={(value) => handleImageUpdate(image.id, { usage_type: value as any })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {allowedUsageTypes.map(type => (
                                  <SelectItem key={type} value={type}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs">Section</Label>
                            <Input
                              value={image.content_section || ''}
                              onChange={(e) => handleImageUpdate(image.id, { content_section: e.target.value })}
                              placeholder="e.g., Introduction"
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Caption</Label>
                          <Textarea
                            value={image.caption || ''}
                            onChange={(e) => handleImageUpdate(image.id, { caption: e.target.value })}
                            placeholder="Image caption..."
                            rows={2}
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        )}

        {/* Add Images Button */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              disabled={!canAddMoreImages}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Add Images ({selectedImages.length}/{maxImages})
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Select Images</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search images..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    <SelectItem value="pathology">Pathology</SelectItem>
                    <SelectItem value="anatomy">Anatomy</SelectItem>
                    <SelectItem value="histology">Histology</SelectItem>
                    <SelectItem value="radiology">Radiology</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                >
                  {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
                </Button>
              </div>

              {/* Selected Count */}
              {selectedForAdd.length > 0 && (
                <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                  <span className="text-sm text-blue-800">
                    {selectedForAdd.length} image{selectedForAdd.length !== 1 ? 's' : ''} selected
                  </span>
                  <Button size="sm" onClick={handleAddImages}>
                    Add Selected
                  </Button>
                </div>
              )}

              {/* Images Grid/List */}
              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 mt-2">Loading images...</p>
                  </div>
                ) : images.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No images found
                  </div>
                ) : (
                  <div className={
                    viewMode === 'grid' 
                      ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3'
                      : 'space-y-2'
                  }>
                    {images.map((image) => {
                      const selected = isImageSelected(image.id)
                      const alreadySelected = selectedImages.some(img => img.id === image.id)
                      
                      return (
                        <div
                          key={image.id}
                          className={`
                            relative cursor-pointer rounded-lg border-2 transition-all
                            ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                            ${alreadySelected ? 'opacity-50' : ''}
                          `}
                          onClick={() => !alreadySelected && handleImageSelect(image, !selectedForAdd.some(img => img.id === image.id))}
                        >
                          {viewMode === 'grid' ? (
                            <div className="aspect-square">
                              <Image
                                src={image.url}
                                alt={image.alt_text || ''}
                                fill
                                className="object-cover rounded-lg"
                                unoptimized={true}
                              />
                              {selected && !alreadySelected && (
                                <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-1">
                                  <Check className="h-3 w-3" />
                                </div>
                              )}
                              {alreadySelected && (
                                <div className="absolute inset-0 bg-gray-900 bg-opacity-50 rounded-lg flex items-center justify-center">
                                  <Badge variant="secondary">Already Selected</Badge>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 p-2">
                              <div className="relative w-12 h-12 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                                <Image
                                  src={image.url}
                                  alt={image.alt_text || ''}
                                  fill
                                  className="object-cover"
                                  unoptimized={true}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {image.description || 'Untitled Image'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {image.width} × {image.height} • {image.category}
                                </p>
                              </div>
                              <div className="flex-shrink-0">
                                {selected && !alreadySelected && (
                                  <Check className="h-4 w-4 text-blue-600" />
                                )}
                                {alreadySelected && (
                                  <Badge variant="secondary" className="text-xs">Selected</Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
