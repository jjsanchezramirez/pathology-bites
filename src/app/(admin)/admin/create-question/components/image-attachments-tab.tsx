'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'

import { Input } from '@/shared/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogPortal } from '@/shared/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Search, X, Plus, Image as ImageIcon } from 'lucide-react'
import { fetchImages } from '@/features/images/services/images'
import { ImageData } from '@/features/images/types/images'
import Image from 'next/image'

interface ImageAttachment {
  image_id: string
  question_section: 'stem' | 'explanation'
  order_index: number
}

interface ImageAttachmentsTabProps {
  attachedImages: ImageAttachment[]
  onAttachedImagesChange: (images: ImageAttachment[]) => void
}

interface MediaSectionProps {
  images: ImageAttachment[]
  section: 'stem' | 'explanation'
  maxImages: number
  onImagesChange: (images: ImageAttachment[]) => void
}

function MediaSection({ images, section, maxImages, onImagesChange }: MediaSectionProps) {
  const [availableImages, setAvailableImages] = useState<ImageData[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])

  const loadImages = async () => {
    setLoading(true)
    try {
      const result = await fetchImages({
        page: 0,
        pageSize: 20,
        searchTerm: searchTerm || undefined,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        showUnusedOnly: false
      })

      if (result.error) {
        throw new Error(result.error)
      }

      setAvailableImages(result.data)
    } catch (error) {
      console.error('Failed to load images:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (showImagePicker) {
      loadImages()
    }
  }, [showImagePicker, searchTerm, categoryFilter])

  const getImageInfo = (imageId: string): ImageData | null => {
    return availableImages.find(img => img.id === imageId) || null
  }

  const handleRemoveImage = (imageId: string, index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    // Reorder remaining images
    const reorderedImages = newImages.map((img, idx) => ({
      ...img,
      order_index: idx + 1
    }))
    onImagesChange(reorderedImages)
  }

  const handleImageToggle = (imageId: string) => {
    // Check if image is already added to this section
    const imageAlreadyExists = images.some(img => img.image_id === imageId)
    if (imageAlreadyExists) {
      return // Don't allow selecting already added images
    }

    setSelectedImageIds(prev => {
      if (prev.includes(imageId)) {
        return prev.filter(id => id !== imageId)
      } else {
        // Check if we would exceed the limit
        const remainingSlots = maxImages - images.length
        if (prev.length >= remainingSlots) {
          return prev // Don't add more if it would exceed limit
        }
        return [...prev, imageId]
      }
    })
  }

  const handleSelectImages = () => {
    const newImages = selectedImageIds.map((imageId, index) => ({
      image_id: imageId,
      question_section: section,
      order_index: images.length + index + 1,
    }))

    onImagesChange([...images, ...newImages])
    setSelectedImageIds([])
    setShowImagePicker(false)
  }

  const handleCancelSelection = () => {
    setSelectedImageIds([])
    setShowImagePicker(false)
    setSearchTerm('')
  }

  return (
    <div>
      <div className="grid grid-cols-5 gap-4">
        {/* Existing Images */}
        {images.map((imageItem, index) => {
          const uniqueKey = `${imageItem.image_id}-${index}`
          const imageInfo = getImageInfo(imageItem.image_id)

          return (
            <div key={uniqueKey} className="relative group">
              <div className="aspect-square bg-muted rounded border overflow-hidden relative">
                {imageInfo ? (
                  <Image
                    src={imageInfo.url}
                    alt={imageInfo.alt_text || ''}
                    fill
                    className="object-cover"
                    sizes="150px"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveImage(imageItem.image_id, index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )
        })}

        {/* Add Image Button */}
        {images.length < maxImages && (
          <Dialog open={showImagePicker} onOpenChange={setShowImagePicker} modal={false}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="aspect-square h-auto flex-col gap-2 border-dashed"
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs">Add Image</span>
              </Button>
            </DialogTrigger>
            <DialogPortal>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Select Images for {section === 'stem' ? 'Question Body' : 'Explanation'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Search Controls */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search images..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="gross">Gross</SelectItem>
                        <SelectItem value="microscopic">Microscopic</SelectItem>
                        <SelectItem value="figure">Figure</SelectItem>
                        <SelectItem value="question">Question</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={loadImages} disabled={loading}>
                      {loading ? 'Loading...' : 'Search'}
                    </Button>
                  </div>

                  {/* Image Grid */}
                  <div className="grid grid-cols-6 gap-3 max-h-96 overflow-y-auto">
                    {availableImages.map((image) => {
                      const isSelected = selectedImageIds.includes(image.id)
                      const isAlreadyAdded = images.some(img => img.image_id === image.id)
                      const canSelect = !isAlreadyAdded && (selectedImageIds.length < maxImages - images.length || isSelected)

                      return (
                        <div
                          key={image.id}
                          className={`relative cursor-pointer rounded border-2 transition-all ${
                            isAlreadyAdded
                              ? 'border-muted bg-muted/50 opacity-50 cursor-not-allowed'
                              : isSelected
                                ? 'border-primary bg-primary/10'
                                : canSelect
                                  ? 'border-border hover:border-primary/50'
                                  : 'border-muted opacity-50 cursor-not-allowed'
                          }`}
                          onClick={() => canSelect && handleImageToggle(image.id)}
                          title={isAlreadyAdded ? 'Already added to this section' : image.alt_text || ''}
                        >
                          <div className="aspect-square overflow-hidden rounded relative">
                            <Image
                              src={image.url}
                              alt={image.alt_text || ''}
                              fill
                              className="object-cover"
                              sizes="120px"
                              unoptimized
                            />
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                              ✓
                            </div>
                          )}
                          {isAlreadyAdded && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
                              <span className="text-white text-xs font-medium">Added</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={handleCancelSelection}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSelectImages}
                      disabled={selectedImageIds.length === 0}
                    >
                      Add {selectedImageIds.length} Image{selectedImageIds.length !== 1 ? 's' : ''}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </DialogPortal>
          </Dialog>
        )}
      </div>
    </div>
  )
}

export function ImageAttachmentsTab({ attachedImages, onAttachedImagesChange }: ImageAttachmentsTabProps) {
  const handleImagesChange = (newImages: ImageAttachment[]) => {
    onAttachedImagesChange(newImages)
  }

  const stemImages = attachedImages.filter(img => img.question_section === 'stem')
  const explanationImages = attachedImages.filter(img => img.question_section === 'explanation')

  return (
    <div className="space-y-8">
      {/* Question Body Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Question Body Images
            </span>
            <Badge variant="outline">
              {stemImages.length}/3 images
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MediaSection
            images={stemImages}
            section="stem"
            maxImages={3}
            onImagesChange={(newImages) => {
              const explanationImages = attachedImages.filter(img => img.question_section === 'explanation')
              handleImagesChange([...newImages, ...explanationImages])
            }}
          />
        </CardContent>
      </Card>

      {/* Explanation Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Explanation Images
            </span>
            <Badge variant="outline">
              {explanationImages.length}/1 image
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MediaSection
            images={explanationImages}
            section="explanation"
            maxImages={1}
            onImagesChange={(newImages) => {
              const stemImages = attachedImages.filter(img => img.question_section === 'stem')
              handleImagesChange([...stemImages, ...newImages])
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
