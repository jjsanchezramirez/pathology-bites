#!/usr/bin/env tsx

/**
 * Cloudflare Images Migration Script
 *
 * Migrates images from Supabase Storage to Cloudflare Images to eliminate egress charges.
 *
 * Cloudflare Images Benefits:
 * - NO egress charges (unlimited bandwidth)
 * - 100k images free tier
 * - Automatic optimization (WebP/AVIF)
 * - Global CDN performance
 * - On-demand resizing via URL parameters
 *
 * Current Usage: 85 images, ~548MB/month egress → $0 egress with Cloudflare
 *
 * Usage: npx tsx scripts/migrate-images-to-cdn.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import { promises as fs } from 'fs'
import path from 'path'

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const CLOUDFLARE_IMAGES_DOMAIN = process.env.CLOUDFLARE_IMAGES_DOMAIN // Optional custom domain

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

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

interface CloudflareUploadResult {
  originalSize: number
  newUrl: string
  cloudflareId: string
  variants: string[]
}

interface MigrationStats {
  totalImages: number
  processedImages: number
  failedImages: number
  originalSizeBytes: number
  estimatedMonthlySavings: number
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

async function uploadToCloudflareImages(imageBuffer: Buffer, imageId: string, category: string): Promise<CloudflareUploadResult> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare configuration missing. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN')
  }

  const formData = new FormData()
  formData.append('file', new Blob([imageBuffer]))
  formData.append('id', `pathology-${category}-${imageId}`)
  formData.append('metadata', JSON.stringify({
    category,
    originalId: imageId,
    source: 'pathology-bites'
  }))

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: formData,
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Cloudflare upload failed: ${response.status} ${error}`)
  }

  const result = await response.json() as any

  if (!result.success) {
    throw new Error(`Cloudflare upload failed: ${result.errors?.[0]?.message || 'Unknown error'}`)
  }

  const baseUrl = CLOUDFLARE_IMAGES_DOMAIN
    ? `https://${CLOUDFLARE_IMAGES_DOMAIN}`
    : `https://imagedelivery.net/${CLOUDFLARE_ACCOUNT_ID}`

  return {
    originalSize: imageBuffer.length,
    newUrl: `${baseUrl}/${result.result.id}/public`,
    cloudflareId: result.result.id,
    variants: result.result.variants || []
  }
}

async function migrateImage(image: ImageRecord): Promise<CloudflareUploadResult> {
  console.log(`🔄 Processing: ${image.url}`)

  // Download original image
  const originalBuffer = await downloadImage(image.url)

  // Upload to Cloudflare Images (no optimization needed - Cloudflare handles it)
  const result = await uploadToCloudflareImages(originalBuffer, image.id, image.category)

  console.log(`✅ Migrated: ${(result.originalSize / 1024).toFixed(1)}KB → Cloudflare Images`)

  return result
}

async function updateImageUrl(imageId: string, newUrl: string, cloudflareId: string): Promise<boolean> {
  const { error } = await supabase
    .from('images')
    .update({
      url: newUrl,
      // Store Cloudflare metadata for future reference
      storage_path: `cloudflare:${cloudflareId}`
    })
    .eq('id', imageId)

  if (error) {
    console.error(`❌ Failed to update image URL: ${imageId} - ${error.message}`)
    return false
  }

  return true
}

async function migrateImagesToCloudflare(dryRun: boolean = true): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalImages: 0,
    processedImages: 0,
    failedImages: 0,
    originalSizeBytes: 0,
    estimatedMonthlySavings: 0,
    errors: []
  }

  try {
    // Validate Cloudflare configuration
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      throw new Error('Cloudflare configuration missing. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN')
    }

    // Get active images (only those used in questions)
    const images = await getActiveImages()
    stats.totalImages = images.length
    stats.originalSizeBytes = images.reduce((sum, img) => sum + (img.file_size_bytes || 0), 0)

    // Calculate estimated monthly egress savings (based on quiz activity)
    const { data: monthlyAttempts } = await supabase
      .from('quiz_attempts')
      .select('id')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    const attemptCount = monthlyAttempts?.length || 0
    stats.estimatedMonthlySavings = stats.originalSizeBytes * attemptCount

    console.log(`\n📊 Cloudflare Images Migration Plan:`)
    console.log(`Images to migrate: ${stats.totalImages}`)
    console.log(`Total size: ${(stats.originalSizeBytes / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Monthly quiz attempts: ${attemptCount}`)
    console.log(`Estimated monthly egress savings: ${(stats.estimatedMonthlySavings / 1024 / 1024).toFixed(2)} MB`)
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

    // Migrate images to Cloudflare
    console.log('\n🚀 Starting Cloudflare Images migration...')
    for (const image of images) {
      try {
        const result = await migrateImage(image)

        // Update database with new Cloudflare URL
        const updated = await updateImageUrl(image.id, result.newUrl, result.cloudflareId)

        if (updated) {
          stats.processedImages++
          console.log(`✅ Migrated: ${image.id} → ${result.newUrl}`)
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

    console.log('\n🎉 Cloudflare Images Migration Complete!')
    console.log(`Processed: ${stats.processedImages}/${stats.totalImages}`)
    console.log(`Failed: ${stats.failedImages}`)
    console.log(`Monthly egress eliminated: ${(stats.estimatedMonthlySavings / 1024 / 1024).toFixed(2)} MB`)
    console.log(`💰 Cost savings: ~$0 (Cloudflare Images free tier + no egress charges)`)

  } catch (error) {
    console.error('❌ Migration failed:', error)
    stats.errors.push(`Migration failed: ${error}`)
  }

  return stats
}

// CLI handling
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  console.log('☁️  Cloudflare Images Migration Tool')
  console.log('====================================')
  console.log('🎯 Goal: Eliminate Supabase egress charges by migrating to Cloudflare Images')
  console.log('💰 Cloudflare Images: 100k images free + unlimited bandwidth (no egress charges)')

  const stats = await migrateImagesToCloudflare(dryRun)

  // Save stats
  const statsFile = path.join(process.cwd(), 'cloudflare-migration-stats.json')
  await fs.writeFile(statsFile, JSON.stringify(stats, null, 2))
  console.log(`📊 Stats saved to: ${statsFile}`)
}

if (require.main === module) {
  main().catch(console.error)
}

export { migrateImagesToCloudflare, getActiveImages }
