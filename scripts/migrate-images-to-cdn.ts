#!/usr/bin/env tsx

/**
 * Cloudflare R2 Migration Script
 *
 * Migrates images from Supabase Storage to Cloudflare R2 to eliminate egress charges.
 *
 * Cloudflare R2 Benefits:
 * - NO egress charges via Cloudflare CDN (unlimited bandwidth)
 * - 10GB storage free tier (we use ~41MB)
 * - S3-compatible API
 * - Global CDN performance
 * - More flexible than Cloudflare Images
 *
 * Current Usage: 85 images, ~548MB/month egress → $0 egress with R2
 *
 * Usage: npx tsx scripts/migrate-images-to-cdn.ts [--dry-run]
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import fetch from 'node-fetch'
import { promises as fs } from 'fs'
import path from 'path'

// Load environment variables
config({ path: '.env.local' })

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!
const CLOUDFLARE_R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!
const CLOUDFLARE_R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!
const CLOUDFLARE_R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'pathology-bites-images'
const CLOUDFLARE_R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Configure R2 client (S3-compatible)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false, // Try without force path style first
})

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

interface R2UploadResult {
  originalSize: number
  newUrl: string
  r2Key: string
  contentType: string
}

interface MigrationStats {
  totalImages: number
  processedImages: number
  failedImages: number
  originalSizeBytes: number
  estimatedMonthlySavings: number
  errors: string[]
}

async function getAllImages(): Promise<ImageRecord[]> {
  console.log('🔍 Fetching ALL images from Supabase Storage...')

  // Get ALL images from the database (not just active ones)
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
    .not('url', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch all images: ${error.message}`)
  }

  if (!images || images.length === 0) {
    console.log('No images found in database')
    return []
  }

  console.log(`Found ${images.length} total images to migrate`)
  return images || []
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function uploadToR2(imageBuffer: Buffer, imageId: string, category: string): Promise<R2UploadResult> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
    throw new Error('Cloudflare R2 configuration missing. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY')
  }

  // Generate R2 key (path) for the image
  const r2Key = `images/${category}/${imageId}`

  // Determine content type from buffer
  const contentType = getContentType(imageBuffer)

  try {
    const command = new PutObjectCommand({
      Bucket: CLOUDFLARE_R2_BUCKET_NAME,
      Key: r2Key,
      Body: imageBuffer,
      ContentType: contentType,
      Metadata: {
        category,
        originalId: imageId,
        source: 'pathology-bites',
        uploadedAt: new Date().toISOString()
      }
    })

    await r2Client.send(command)

    // Generate public URL
    const publicUrl = CLOUDFLARE_R2_PUBLIC_URL
      ? `${CLOUDFLARE_R2_PUBLIC_URL}/${r2Key}`
      : `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev/${r2Key}`

    return {
      originalSize: imageBuffer.length,
      newUrl: publicUrl,
      r2Key,
      contentType
    }
  } catch (error) {
    throw new Error(`R2 upload failed: ${error}`)
  }
}

function getContentType(buffer: Buffer): string {
  // Simple content type detection based on file signature
  if (buffer.length < 4) return 'application/octet-stream'

  const signature = buffer.subarray(0, 4)

  // PNG signature: 89 50 4E 47
  if (signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47) {
    return 'image/png'
  }

  // JPEG signature: FF D8 FF
  if (signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF) {
    return 'image/jpeg'
  }

  // WebP signature: RIFF ... WEBP
  if (signature.toString('ascii', 0, 4) === 'RIFF') {
    const webpSignature = buffer.subarray(8, 12)
    if (webpSignature.toString('ascii') === 'WEBP') {
      return 'image/webp'
    }
  }

  return 'image/jpeg' // Default fallback
}

async function ensureBucketExists(): Promise<void> {
  try {
    // Try to check if bucket exists
    const headCommand = new HeadBucketCommand({
      Bucket: CLOUDFLARE_R2_BUCKET_NAME,
    })

    await r2Client.send(headCommand)
    console.log(`✅ Bucket '${CLOUDFLARE_R2_BUCKET_NAME}' exists and is accessible`)
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      // Bucket doesn't exist, create it
      console.log(`🔧 Creating bucket '${CLOUDFLARE_R2_BUCKET_NAME}'...`)
      try {
        const createCommand = new CreateBucketCommand({
          Bucket: CLOUDFLARE_R2_BUCKET_NAME,
        })

        await r2Client.send(createCommand)
        console.log(`✅ Bucket '${CLOUDFLARE_R2_BUCKET_NAME}' created successfully`)
      } catch (createError) {
        throw new Error(`Failed to create bucket: ${createError}`)
      }
    } else {
      throw new Error(`Failed to access bucket: ${error}`)
    }
  }
}

async function migrateImage(image: ImageRecord): Promise<R2UploadResult> {
  console.log(`🔄 Processing: ${image.url}`)

  // Download original image
  const originalBuffer = await downloadImage(image.url)

  // Upload to Cloudflare R2
  const result = await uploadToR2(originalBuffer, image.id, image.category)

  console.log(`✅ Migrated: ${(result.originalSize / 1024).toFixed(1)}KB → R2`)

  return result
}

async function updateImageUrl(imageId: string, newUrl: string, r2Key: string): Promise<boolean> {
  const { error } = await supabase
    .from('images')
    .update({
      url: newUrl,
      // Store R2 metadata for future reference
      storage_path: `r2:${r2Key}`
    })
    .eq('id', imageId)

  if (error) {
    console.error(`❌ Failed to update image URL: ${imageId} - ${error.message}`)
    return false
  }

  return true
}

async function migrateImagesToR2(dryRun: boolean = true): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalImages: 0,
    processedImages: 0,
    failedImages: 0,
    originalSizeBytes: 0,
    estimatedMonthlySavings: 0,
    errors: []
  }

  try {
    // Validate R2 configuration
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
      throw new Error('Cloudflare R2 configuration missing. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY')
    }

    // Skip bucket check for now due to SSL issues
    console.log(`⚠️  Skipping bucket check - assuming '${CLOUDFLARE_R2_BUCKET_NAME}' exists`)

    // Get ALL images from Supabase Storage
    const images = await getAllImages()
    stats.totalImages = images.length
    stats.originalSizeBytes = images.reduce((sum: number, img: any) => sum + (img.file_size_bytes || 0), 0)

    // Calculate estimated monthly egress savings (based on quiz activity)
    const { data: monthlyAttempts } = await supabase
      .from('quiz_attempts')
      .select('id')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    const attemptCount = monthlyAttempts?.length || 0
    stats.estimatedMonthlySavings = stats.originalSizeBytes * attemptCount

    console.log(`\n📊 Cloudflare R2 Migration Plan:`)
    console.log(`Images to migrate: ${stats.totalImages}`)
    console.log(`Total size: ${(stats.originalSizeBytes / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Monthly quiz attempts: ${attemptCount}`)
    console.log(`Estimated monthly egress savings: ${(stats.estimatedMonthlySavings / 1024 / 1024).toFixed(2)} MB`)
    console.log(`R2 Bucket: ${CLOUDFLARE_R2_BUCKET_NAME}`)
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
    await fs.writeFile(backupFile, JSON.stringify(images.map((img: any) => ({ id: img.id, url: img.url })), null, 2))
    console.log(`💾 URL backup created: ${backupFile}`)

    // Migrate images to R2
    console.log('\n🚀 Starting Cloudflare R2 migration...')
    for (const image of images) {
      try {
        const result = await migrateImage(image)

        // Update database with new R2 URL
        const updated = await updateImageUrl(image.id, result.newUrl, result.r2Key)

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

    console.log('\n🎉 Cloudflare R2 Migration Complete!')
    console.log(`Processed: ${stats.processedImages}/${stats.totalImages}`)
    console.log(`Failed: ${stats.failedImages}`)
    console.log(`Monthly egress eliminated: ${(stats.estimatedMonthlySavings / 1024 / 1024).toFixed(2)} MB`)
    console.log(`💰 Cost savings: ~$0 (Cloudflare R2 free tier + no egress charges)`)

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

  console.log('☁️  Cloudflare R2 Migration Tool')
  console.log('=================================')
  console.log('🎯 Goal: Eliminate Supabase egress charges by migrating to Cloudflare R2')
  console.log('💰 Cloudflare R2: 10GB storage free + unlimited CDN egress (no egress charges)')

  const stats = await migrateImagesToR2(dryRun)

  // Save stats
  const statsFile = path.join(process.cwd(), 'r2-migration-stats.json')
  await fs.writeFile(statsFile, JSON.stringify(stats, null, 2))
  console.log(`📊 Stats saved to: ${statsFile}`)
}

if (require.main === module) {
  main().catch(console.error)
}

export { migrateImagesToR2, getAllImages }
