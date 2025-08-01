#!/usr/bin/env tsx

/**
 * Orphaned Images Cleanup Script
 * 
 * This script identifies and removes orphaned images from Supabase storage
 * that are not referenced by any questions. This can reduce egress by ~67%.
 * 
 * Usage: npx tsx scripts/cleanup-orphaned-images.ts [--dry-run] [--force]
 */

import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'fs'
import path from 'path'

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface OrphanedImage {
  id: string
  url: string
  storage_path: string
  file_size_bytes: number
  file_type: string
  category: string
  created_at: string
}

interface CleanupStats {
  totalImages: number
  orphanedImages: number
  totalSizeBytes: number
  orphanedSizeBytes: number
  deletedImages: number
  deletedSizeBytes: number
  errors: string[]
}

async function identifyOrphanedImages(): Promise<OrphanedImage[]> {
  console.log('🔍 Identifying orphaned images...')

  // First get the image IDs that are actually used
  const { data: usedImageIds, error: idsError } = await supabase
    .from('question_images')
    .select('image_id')

  if (idsError) {
    throw new Error(`Failed to fetch used image IDs: ${idsError.message}`)
  }

  const imageIds = usedImageIds?.map(item => item.image_id) || []

  // Then get all images that are NOT in the used list
  let query = supabase
    .from('images')
    .select(`
      id,
      url,
      storage_path,
      file_size_bytes,
      file_type,
      category,
      created_at
    `)

  if (imageIds.length > 0) {
    query = query.not('id', 'in', `(${imageIds.map(id => `'${id}'`).join(',')})`)
  }

  const { data: orphanedImages, error } = await query

  if (error) {
    throw new Error(`Failed to identify orphaned images: ${error.message}`)
  }

  return orphanedImages || []
}

async function getStorageStats(): Promise<{ totalImages: number, totalSizeBytes: number }> {
  const { data, error } = await supabase
    .from('images')
    .select('file_size_bytes')

  if (error) {
    throw new Error(`Failed to get storage stats: ${error.message}`)
  }

  const totalImages = data?.length || 0
  const totalSizeBytes = data?.reduce((sum, img) => sum + (img.file_size_bytes || 0), 0) || 0

  return { totalImages, totalSizeBytes }
}

async function deleteImageFromStorage(storagePath: string): Promise<boolean> {
  if (!storagePath) return true // Skip if no storage path

  const { error } = await supabase.storage
    .from('images')
    .remove([storagePath])

  if (error) {
    console.warn(`⚠️  Failed to delete from storage: ${storagePath} - ${error.message}`)
    return false
  }

  return true
}

async function deleteImageFromDatabase(imageId: string): Promise<boolean> {
  const { error } = await supabase
    .from('images')
    .delete()
    .eq('id', imageId)

  if (error) {
    console.error(`❌ Failed to delete from database: ${imageId} - ${error.message}`)
    return false
  }

  return true
}

async function createBackup(orphanedImages: OrphanedImage[]): Promise<string> {
  const backupDir = path.join(process.cwd(), 'backups')
  await fs.mkdir(backupDir, { recursive: true })
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFile = path.join(backupDir, `orphaned-images-${timestamp}.json`)
  
  await fs.writeFile(backupFile, JSON.stringify(orphanedImages, null, 2))
  console.log(`💾 Backup created: ${backupFile}`)
  
  return backupFile
}

async function cleanupOrphanedImages(dryRun: boolean = true, force: boolean = false): Promise<CleanupStats> {
  const stats: CleanupStats = {
    totalImages: 0,
    orphanedImages: 0,
    totalSizeBytes: 0,
    orphanedSizeBytes: 0,
    deletedImages: 0,
    deletedSizeBytes: 0,
    errors: []
  }

  try {
    // Get overall stats
    const { totalImages, totalSizeBytes } = await getStorageStats()
    stats.totalImages = totalImages
    stats.totalSizeBytes = totalSizeBytes

    // Identify orphaned images
    const orphanedImages = await identifyOrphanedImages()
    stats.orphanedImages = orphanedImages.length
    stats.orphanedSizeBytes = orphanedImages.reduce((sum, img) => sum + (img.file_size_bytes || 0), 0)

    console.log('\n📊 Storage Analysis:')
    console.log(`Total Images: ${stats.totalImages}`)
    console.log(`Total Size: ${(stats.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Orphaned Images: ${stats.orphanedImages} (${((stats.orphanedImages / stats.totalImages) * 100).toFixed(1)}%)`)
    console.log(`Orphaned Size: ${(stats.orphanedSizeBytes / 1024 / 1024).toFixed(2)} MB (${((stats.orphanedSizeBytes / stats.totalSizeBytes) * 100).toFixed(1)}%)`)

    if (orphanedImages.length === 0) {
      console.log('✅ No orphaned images found!')
      return stats
    }

    // Show orphaned images
    console.log('\n🗑️  Orphaned Images:')
    orphanedImages.forEach((img, index) => {
      const sizeKB = (img.file_size_bytes || 0) / 1024
      console.log(`${index + 1}. ${img.url} (${sizeKB.toFixed(1)} KB, ${img.category})`)
    })

    if (dryRun) {
      console.log('\n🔍 DRY RUN - No images will be deleted')
      console.log('Run with --force to actually delete orphaned images')
      return stats
    }

    if (!force) {
      console.log('\n⚠️  This will permanently delete orphaned images!')
      console.log('Add --force flag to confirm deletion')
      return stats
    }

    // Create backup before deletion
    await createBackup(orphanedImages)

    // Delete orphaned images
    console.log('\n🗑️  Deleting orphaned images...')
    for (const img of orphanedImages) {
      try {
        // Delete from storage first
        const storageDeleted = await deleteImageFromStorage(img.storage_path)
        
        // Delete from database
        const dbDeleted = await deleteImageFromDatabase(img.id)
        
        if (dbDeleted) {
          stats.deletedImages++
          stats.deletedSizeBytes += img.file_size_bytes || 0
          console.log(`✅ Deleted: ${img.url}`)
        }
      } catch (error) {
        const errorMsg = `Failed to delete ${img.id}: ${error}`
        stats.errors.push(errorMsg)
        console.error(`❌ ${errorMsg}`)
      }
    }

    console.log('\n🎉 Cleanup Complete!')
    console.log(`Deleted: ${stats.deletedImages} images (${(stats.deletedSizeBytes / 1024 / 1024).toFixed(2)} MB)`)
    console.log(`Errors: ${stats.errors.length}`)
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:')
      stats.errors.forEach(error => console.log(`  - ${error}`))
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    stats.errors.push(`Cleanup failed: ${error}`)
  }

  return stats
}

// CLI handling
async function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--force')
  const force = args.includes('--force')

  console.log('🧹 Orphaned Images Cleanup Tool')
  console.log('================================')

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode')
  } else {
    console.log('⚠️  LIVE MODE - Images will be deleted!')
  }

  const stats = await cleanupOrphanedImages(dryRun, force)
  
  // Save stats
  const statsFile = path.join(process.cwd(), 'cleanup-stats.json')
  await fs.writeFile(statsFile, JSON.stringify(stats, null, 2))
  console.log(`📊 Stats saved to: ${statsFile}`)
}

if (require.main === module) {
  main().catch(console.error)
}

export { cleanupOrphanedImages, identifyOrphanedImages }
