import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { compressImage } from '@/features/images/services/image-upload'

export interface ReuploadResult {
  success: boolean
  message?: string
  error?: string
  metadata?: {
    oldFileType: string
    newFileType: string
    oldSize: number
    newSize: number
    oldDimensions: string
    newDimensions: string
  }
}

export interface UseImageReuploadOptions {
  onSuccess?: (result: ReuploadResult) => void
  onError?: (error: string) => void
  maxSizeBytes?: number // Maximum file size before compression
}

export function useImageReupload({
  onSuccess,
  onError,
  maxSizeBytes = 1024 * 1024 // 1MB default, same as upload
}: UseImageReuploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false)

  const reuploadImage = useCallback(async (
    imageId: string, 
    file: File, 
    updateMetadata: boolean = false
  ) => {
    if (!file) {
      const error = 'No file selected'
      onError?.(error)
      toast.error(error)
      return null
    }

    if (!file.type.startsWith('image/')) {
      const error = 'Please select a valid image file'
      onError?.(error)
      toast.error(error)
      return null
    }

    setIsUploading(true)

    try {
      console.log('🔄 Starting image reupload...', {
        imageId,
        fileName: file.name,
        originalFileSize: file.size,
        updateMetadata
      })

      // Compress image if needed (same logic as upload)
      let fileToUpload = file
      if (file.size > maxSizeBytes) {
        console.log('🗜️ Compressing image...', {
          originalSize: file.size,
          maxSize: maxSizeBytes
        })

        try {
          fileToUpload = await compressImage(file, maxSizeBytes)
          console.log('✅ Image compressed:', {
            originalSize: file.size,
            compressedSize: fileToUpload.size,
            compressionRatio: Math.round((1 - fileToUpload.size / file.size) * 100)
          })

          if (fileToUpload.size > maxSizeBytes) {
            const error = 'Image is still too large after compression. Please try a smaller image.'
            console.error('❌ Compression insufficient:', error)
            onError?.(error)
            toast.error(error)
            return null
          }
        } catch (compressionError) {
          console.error('❌ Compression failed, proceeding with original file:', compressionError)
          // Fallback: proceed with original file if compression fails
          fileToUpload = file
          toast.warning('Image compression failed, uploading original file. This may take longer.')
        }
      } else {
        console.log('✅ Image size OK, no compression needed')
      }

      const formData = new FormData()
      formData.append('file', fileToUpload)
      formData.append('imageId', imageId)
      formData.append('updateMetadata', updateMetadata.toString())

      console.log('📤 Sending request to /api/images/replace...')
      const response = await fetch('/api/images/replace', {
        method: 'POST',
        body: formData
      })

      console.log('📥 Response received:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      })

      let result: ReuploadResult
      try {
        result = await response.json()
        console.log('📋 Response parsed:', result)
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError)
        throw new Error(`Failed to parse API response: ${response.statusText}`)
      }

      if (!response.ok) {
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          result
        })
        throw new Error(result.error || result.message || `HTTP ${response.status}: Failed to replace image`)
      }

      // Show success message with details
      const metadata = result.metadata
      if (metadata) {
        const sizeChange = metadata.newSize > metadata.oldSize ? 'larger' :
                          metadata.newSize < metadata.oldSize ? 'smaller' : 'same size'
        const dimensionsChanged = metadata.oldDimensions !== metadata.newDimensions

        let details = `New file is ${sizeChange}`
        if (dimensionsChanged) {
          details += ` and ${metadata.newDimensions} (was ${metadata.oldDimensions})`
        }

        // Add compression info if file was compressed
        if (fileToUpload.size < file.size) {
          const compressionRatio = Math.round((1 - fileToUpload.size / file.size) * 100)
          details += ` (compressed ${compressionRatio}%)`
        }

        toast.success(`Image replaced successfully! ${details}`)
      } else {
        toast.success(result.message || 'Image replaced successfully')
      }

      onSuccess?.(result)
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to replace image'
      console.error('Image reupload error:', error)
      onError?.(errorMessage)
      toast.error(errorMessage)
      return null
    } finally {
      setIsUploading(false)
    }
  }, [onSuccess, onError])

  return {
    reuploadImage,
    isUploading
  }
}