'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Upload, X, ArrowRight, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ImageAttachment as ImageAttachmentType } from '../create-question-v2-client'

interface ImageAttachmentProps {
  attachedImages: ImageAttachmentType[]
  onImagesAttached: (images: ImageAttachmentType[]) => void
  onProceedToFinalize: () => void
}

export function ImageAttachment({ attachedImages, onImagesAttached, onProceedToFinalize }: ImageAttachmentProps) {
  const [dragOver, setDragOver] = useState(false)

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return

    const newImages: ImageAttachmentType[] = []
    
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const id = Math.random().toString(36).substr(2, 9)
        const preview = URL.createObjectURL(file)
        
        newImages.push({
          id,
          file,
          preview,
          section: 'stem',
          alt_text: '',
          caption: ''
        })
      }
    })

    if (newImages.length > 0) {
      onImagesAttached([...attachedImages, ...newImages])
      toast.success(`${newImages.length} image(s) added`)
    }
  }

  const removeImage = (id: string) => {
    const updatedImages = attachedImages.filter(img => img.id !== id)
    onImagesAttached(updatedImages)
    toast.success('Image removed')
  }

  const updateImage = (id: string, field: string, value: string) => {
    const updatedImages = attachedImages.map(img => 
      img.id === id ? { ...img, [field]: value } : img
    )
    onImagesAttached(updatedImages)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileUpload(e.dataTransfer.files)
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card 
        className={`border-2 border-dashed transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-8 text-center">
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <div className="space-y-2">
            <p className="text-lg font-medium">Upload Images</p>
            <p className="text-sm text-muted-foreground">
              Drag and drop images here, or click to browse
            </p>
          </div>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
            id="image-upload"
          />
          <Button 
            onClick={() => document.getElementById('image-upload')?.click()}
            className="mt-4"
            variant="outline"
          >
            Browse Files
          </Button>
        </CardContent>
      </Card>

      {/* Attached Images */}
      {attachedImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Attached Images</h3>
            <Badge variant="secondary">{attachedImages.length}</Badge>
          </div>

          <div className="grid gap-4">
            {attachedImages.map((image) => (
              <Card key={image.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Image Preview */}
                    <div className="flex-shrink-0">
                      <img
                        src={image.preview}
                        alt={image.alt_text || 'Uploaded image'}
                        className="w-24 h-24 object-cover rounded border"
                      />
                    </div>

                    {/* Image Details */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">
                          {image.file.name}
                        </p>
                        <Button
                          onClick={() => removeImage(image.id)}
                          variant="ghost"
                          size="sm"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Section</label>
                          <Select
                            value={image.section}
                            onValueChange={(value) => updateImage(image.id, 'section', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="stem">Question Stem</SelectItem>
                              <SelectItem value="explanation">Explanation</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium">Alt Text</label>
                          <Input
                            value={image.alt_text}
                            onChange={(e) => updateImage(image.id, 'alt_text', e.target.value)}
                            placeholder="Describe the image"
                            className="text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium">Caption</label>
                          <Input
                            value={image.caption}
                            onChange={(e) => updateImage(image.id, 'caption', e.target.value)}
                            placeholder="Image caption"
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Skip/Proceed */}
      <div className="flex justify-between">
        <Button onClick={onProceedToFinalize} variant="outline">
          Skip Images
        </Button>
        <Button onClick={onProceedToFinalize}>
          Proceed to Finalize
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
