#!/usr/bin/env tsx

/**
 * Image CDN Migration Script
 * 
 * This script optimizes images and migrates them to an external CDN
 * to reduce Supabase egress usage by ~95%.
 * 
 * Supported CDNs:
 * - Cloudinary (25GB free, 25GB bandwidth)
 * - ImageKit (20GB free, 20GB bandwidth)
 * - Uploadcare (3GB free, unlimited bandwidth)
 * 
 * Usage: npx tsx scripts/migrate-images-to-cdn.ts [--provider=cloudinary] [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'
import sharp from 'sharp'
import fetch from 'node-fetch'
import { promises as fs } from 'fs'
import path from 'path'

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Configure Cloudinary
if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  })
}

interface ImageRecord {
  id: string
  url: string
  storage_path: string
  file_size_bytes: number
  file_type: string
  category: string
  width?: number
  height?: number
}

interface OptimizationResult {
  originalSize: number
  optimizedSize: number
  compressionRatio: number
  newUrl: string
  provider: string
}

interface MigrationStats {
  totalImages: number
  processedImages: number
  failedImages: number
  originalSizeBytes: number
  optimizedSizeBytes: number
  compressionRatio: number
  errors: string[]
}

async function getActiveImages(): Promise<ImageRecord[]> {
  console.log('🔍 Fetching active images...')

  // First get the image IDs that are actually used
  const { data: usedImageIds, error: idsError } = await supabase
    .from('question_images')
    .select('image_id')

  if (idsError) {
    throw new Error(`Failed to fetch used image IDs: ${idsError.message}`)
  }

  const imageIds = usedImageIds?.map(item => item.image_id) || []

  if (imageIds.length === 0) {
    console.log('No active images found')
    return []
  }

  // Then get the image details for those IDs
  const { data: images, error } = await supabase
    .from('images')
    .select(`
      id,
      url,
      storage_path,
      file_size_bytes,
      file_type,
      category,
      width,
      height
    `)
    .in('id', imageIds)

  if (error) {
    throw new Error(`Failed to fetch active images: ${error.message}`)
  }

  return images || []
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function optimizeImage(imageBuffer: Buffer, category: string): Promise<Buffer> {
  let pipeline = sharp(imageBuffer)
  
  // Get image metadata
  const metadata = await pipeline.metadata()
  const { width = 0, height = 0, format } = metadata
  
  // Resize based on category and current size
  const maxWidth = getMaxWidthForCategory(category)
  if (width > maxWidth) {
    pipeline = pipeline.resize(maxWidth, null, {
      withoutEnlargement: true,
      fit: 'inside'
    })
  }
  
  // Optimize format and quality
  if (format === 'png') {
    // Convert PNG to JPEG for photos, keep PNG for diagrams/tables
    if (category === 'microscopic') {
      pipeline = pipeline.jpeg({ quality: 85, progressive: true })
    } else {
      pipeline = pipeline.png({ compressionLevel: 9, progressive: true })
    }
  } else if (format === 'jpeg' || format === 'jpg') {
    pipeline = pipeline.jpeg({ quality: 85, progressive: true })
  }
  
  return pipeline.toBuffer()
}

function getMaxWidthForCategory(category: string): number {
  switch (category) {
    case 'microscopic':
      return 1200 // High detail needed for pathology
    case 'figure':
    case 'table':
      return 1000 // Readable text/diagrams
    default:
      return 800 // General images
  }
}

async function uploadToCloudinary(imageBuffer: Buffer, imageId: string, category: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: `pathology-bites/${category}/${imageId}`,
        folder: 'pathology-bites',
        resource_type: 'image',
        format: 'auto',
        quality: 'auto:good',
        fetch_format: 'auto',
        flags: 'progressive',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`))
        } else {
          resolve(result!.secure_url)
        }
      }
    )
    
    uploadStream.end(imageBuffer)
  })
}

async function updateImageUrl(imageId: string, newUrl: string): Promise<boolean> {
  const { error } = await supabase
    .from('images')
    .update({ 
      url: newUrl,
      // Add migration metadata
      storage_path: `cdn:${newUrl}` 
    })
    .eq('id', imageId)

  if (error) {
    console.error(`❌ Failed to update image URL: ${imageId} - ${error.message}`)
    return false
  }

  return true
}

async function migrateImage(image: ImageRecord, provider: string = 'cloudinary'): Promise<OptimizationResult> {
  console.log(`🔄 Processing: ${image.url}`)
  
  // Download original image
  const originalBuffer = await downloadImage(image.url)
  const originalSize = originalBuffer.length
  
  // Optimize image
  const optimizedBuffer = await optimizeImage(originalBuffer, image.category)
  const optimizedSize = optimizedBuffer.length
  
  // Upload to CDN
  let newUrl: string
  switch (provider) {
    case 'cloudinary':
      newUrl = await uploadToCloudinary(optimizedBuffer, image.id, image.category)
      break
    default:
      throw new Error(`Unsupported CDN provider: ${provider}`)
  }
  
  const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100
  
  console.log(`✅ Optimized: ${(originalSize / 1024).toFixed(1)}KB → ${(optimizedSize / 1024).toFixed(1)}KB (${compressionRatio.toFixed(1)}% reduction)`)
  
  return {
    originalSize,
    optimizedSize,
    compressionRatio,
    newUrl,
    provider
  }
}

async function migrateImagesToCDN(provider: string = 'cloudinary', dryRun: boolean = true): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalImages: 0,
    processedImages: 0,
    failedImages: 0,
    originalSizeBytes: 0,
    optimizedSizeBytes: 0,
    compressionRatio: 0,
    errors: []
  }

  try {
    // Validate CDN configuration
    if (provider === 'cloudinary' && (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET)) {
      throw new Error('Cloudinary configuration missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET')
    }

    // Get active images
    const images = await getActiveImages()
    stats.totalImages = images.length
    stats.originalSizeBytes = images.reduce((sum, img) => sum + (img.file_size_bytes || 0), 0)

    console.log(`\n📊 Migration Plan:`)
    console.log(`Images to migrate: ${stats.totalImages}`)
    console.log(`Total size: ${(stats.originalSizeBytes / 1024 / 1024).toFixed(2)} MB`)
    console.log(`CDN Provider: ${provider}`)
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)

    if (dryRun) {
      console.log('\n🔍 DRY RUN - No images will be migrated')
      console.log('Remove --dry-run flag to perform actual migration')
      return stats
    }

    // Create backup
    const backupDir = path.join(process.cwd(), 'backups')
    await fs.mkdir(backupDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = path.join(backupDir, `image-urls-${timestamp}.json`)
    await fs.writeFile(backupFile, JSON.stringify(images.map(img => ({ id: img.id, url: img.url })), null, 2))
    console.log(`💾 URL backup created: ${backupFile}`)

    // Migrate images
    console.log('\n🚀 Starting migration...')
    for (const image of images) {
      try {
        const result = await migrateImage(image, provider)
        
        // Update database with new URL
        const updated = await updateImageUrl(image.id, result.newUrl)
        
        if (updated) {
          stats.processedImages++
          stats.optimizedSizeBytes += result.optimizedSize
          console.log(`✅ Migrated: ${image.id}`)
        } else {
          stats.failedImages++
          stats.errors.push(`Failed to update database for ${image.id}`)
        }
        
      } catch (error) {
        stats.failedImages++
        const errorMsg = `Failed to migrate ${image.id}: ${error}`
        stats.errors.push(errorMsg)
        console.error(`❌ ${errorMsg}`)
      }
    }

    stats.compressionRatio = ((stats.originalSizeBytes - stats.optimizedSizeBytes) / stats.originalSizeBytes) * 100

    console.log('\n🎉 Migration Complete!')
    console.log(`Processed: ${stats.processedImages}/${stats.totalImages}`)
    console.log(`Failed: ${stats.failedImages}`)
    console.log(`Size reduction: ${(stats.originalSizeBytes / 1024 / 1024).toFixed(2)} MB → ${(stats.optimizedSizeBytes / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Compression: ${stats.compressionRatio.toFixed(1)}%`)

  } catch (error) {
    console.error('❌ Migration failed:', error)
    stats.errors.push(`Migration failed: ${error}`)
  }

  return stats
}

// CLI handling
async function main() {
  const args = process.argv.slice(2)
  const providerArg = args.find(arg => arg.startsWith('--provider='))
  const provider = providerArg ? providerArg.split('=')[1] : 'cloudinary'
  const dryRun = args.includes('--dry-run')

  console.log('🌐 Image CDN Migration Tool')
  console.log('===========================')

  const stats = await migrateImagesToCDN(provider, dryRun)
  
  // Save stats
  const statsFile = path.join(process.cwd(), 'migration-stats.json')
  await fs.writeFile(statsFile, JSON.stringify(stats, null, 2))
  console.log(`📊 Stats saved to: ${statsFile}`)
}

if (require.main === module) {
  main().catch(console.error)
}

export { migrateImagesToCDN, getActiveImages }
