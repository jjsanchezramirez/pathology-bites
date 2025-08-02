#!/usr/bin/env tsx
/**
 * Static Assets Migration Script
 *
 * Migrates static assets from public/images/ and public/logos/ to Cloudflare R2
 * and updates all references throughout the codebase.
 */

import { config } from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import { uploadToR2, getR2PublicUrl } from '../shared/services/r2-storage'

// Load environment variables from .env.local
config({ path: '.env.local' })

interface MigrationResult {
  success: boolean
  originalPath: string
  r2Key: string
  r2Url: string
  size: number
  error?: string
}

interface MigrationSummary {
  totalFiles: number
  successful: number
  failed: number
  results: MigrationResult[]
  totalSizeMB: number
}

/**
 * Files that must remain in public folder for Next.js functionality
 */
const EXCLUDED_FILES = new Set([
  'og-image.png',           // Open Graph meta tags
  'screenshot-mobile.png',  // App store/marketing
  'twitter-image.png'       // Twitter Card meta tags
])

/**
 * Get all files recursively from a directory, excluding specified files
 */
async function getAllFiles(dirPath: string, basePath: string = '', excludeFiles: boolean = false): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const relativePath = path.join(basePath, entry.name)

      if (entry.isDirectory()) {
        const subFiles = await getAllFiles(fullPath, relativePath, excludeFiles)
        files.push(...subFiles)
      } else {
        // Skip excluded files if this is the images directory
        if (excludeFiles && EXCLUDED_FILES.has(entry.name)) {
          console.log(`  ⏭️  Skipping excluded file: ${entry.name}`)
          continue
        }

        // Skip .DS_Store files
        if (entry.name === '.DS_Store') {
          console.log(`  ⏭️  Skipping system file: ${entry.name}`)
          continue
        }

        files.push(relativePath)
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dirPath}:`, error)
  }

  return files
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon'
  }
  
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Migrate a single file to R2
 */
async function migrateFile(
  sourceDir: string,
  relativePath: string,
  targetPrefix: string
): Promise<MigrationResult> {
  const fullSourcePath = path.join(sourceDir, relativePath)
  const r2Key = `${targetPrefix}/${relativePath.replace(/\\/g, '/')}`
  
  try {
    // Read the file
    const fileBuffer = await fs.readFile(fullSourcePath)
    const mimeType = getMimeType(relativePath)
    
    // Upload to R2
    const uploadResult = await uploadToR2(fileBuffer, r2Key, {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000', // 1 year cache for static assets
      metadata: {
        originalPath: relativePath,
        migratedAt: new Date().toISOString(),
        source: 'static-asset-migration'
      }
    })
    
    return {
      success: true,
      originalPath: relativePath,
      r2Key,
      r2Url: uploadResult.url,
      size: fileBuffer.length
    }
  } catch (error) {
    return {
      success: false,
      originalPath: relativePath,
      r2Key,
      r2Url: getR2PublicUrl(r2Key),
      size: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Migrate all files from a directory
 */
async function migrateDirectory(
  sourceDir: string,
  targetPrefix: string,
  description: string,
  excludeFiles: boolean = false
): Promise<MigrationResult[]> {
  console.log(`\n🔄 Migrating ${description}...`)

  const files = await getAllFiles(sourceDir, '', excludeFiles)
  console.log(`Found ${files.length} files to migrate`)

  if (files.length === 0) {
    console.log(`  ℹ️  No files to migrate in ${description}`)
    return []
  }

  const results: MigrationResult[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    console.log(`[${i + 1}/${files.length}] Migrating: ${file}`)

    const result = await migrateFile(sourceDir, file, targetPrefix)
    results.push(result)

    if (result.success) {
      console.log(`  ✅ Success: ${result.r2Url}`)
    } else {
      console.log(`  ❌ Failed: ${result.error}`)
    }

    // Add small delay to avoid overwhelming R2
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return results
}

/**
 * Main migration function
 */
async function migrateStaticAssets(): Promise<MigrationSummary> {
  console.log('🚀 Starting static assets migration to Cloudflare R2...')
  
  const projectRoot = path.resolve(__dirname, '../..')
  const publicDir = path.join(projectRoot, 'public')
  
  const allResults: MigrationResult[] = []
  
  // Migrate images directory (excluding SEO/meta files)
  const imagesDir = path.join(publicDir, 'images')
  try {
    await fs.access(imagesDir)
    console.log(`\n📋 Excluded files that will remain in public/images/:`)
    EXCLUDED_FILES.forEach(file => console.log(`  - ${file}`))

    const imageResults = await migrateDirectory(imagesDir, 'static/images', 'images directory', true)
    allResults.push(...imageResults)
  } catch (error) {
    console.log('⚠️  Images directory not found, skipping...')
  }

  // Migrate logos directory (no exclusions)
  const logosDir = path.join(publicDir, 'logos')
  try {
    await fs.access(logosDir)
    const logoResults = await migrateDirectory(logosDir, 'static/logos', 'logos directory', false)
    allResults.push(...logoResults)
  } catch (error) {
    console.log('⚠️  Logos directory not found, skipping...')
  }
  
  // Calculate summary
  const successful = allResults.filter(r => r.success).length
  const failed = allResults.filter(r => !r.success).length
  const totalSizeMB = allResults.reduce((sum, r) => sum + r.size, 0) / (1024 * 1024)
  
  const summary: MigrationSummary = {
    totalFiles: allResults.length,
    successful,
    failed,
    results: allResults,
    totalSizeMB: Math.round(totalSizeMB * 100) / 100
  }
  
  return summary
}

/**
 * Generate migration report
 */
function generateReport(summary: MigrationSummary): void {
  console.log('\n📊 Migration Summary:')
  console.log(`Total files: ${summary.totalFiles}`)
  console.log(`Successful: ${summary.successful}`)
  console.log(`Failed: ${summary.failed}`)
  console.log(`Total size: ${summary.totalSizeMB} MB`)
  
  if (summary.failed > 0) {
    console.log('\n❌ Failed migrations:')
    summary.results
      .filter(r => !r.success)
      .forEach(r => console.log(`  - ${r.originalPath}: ${r.error}`))
  }
  
  console.log('\n✅ Successful migrations:')
  summary.results
    .filter(r => r.success)
    .slice(0, 10) // Show first 10
    .forEach(r => console.log(`  - ${r.originalPath} → ${r.r2Url}`))
  
  if (summary.successful > 10) {
    console.log(`  ... and ${summary.successful - 10} more`)
  }
}

/**
 * Save migration mapping for reference updates
 */
async function saveMigrationMapping(summary: MigrationSummary): Promise<void> {
  const mapping = summary.results
    .filter(r => r.success)
    .reduce((acc, r) => {
      // Create mapping from original public path to R2 URL
      const publicPath = `/images/${r.originalPath}`.replace(/\\/g, '/')
      const logosPath = `/logos/${r.originalPath}`.replace(/\\/g, '/')
      
      if (r.r2Key.startsWith('static/images/')) {
        acc[publicPath] = r.r2Url
      } else if (r.r2Key.startsWith('static/logos/')) {
        acc[logosPath] = r.r2Url
      }
      
      return acc
    }, {} as Record<string, string>)
  
  const mappingPath = path.resolve(__dirname, '../data/asset-migration-mapping.json')
  await fs.writeFile(mappingPath, JSON.stringify(mapping, null, 2))
  console.log(`\n💾 Migration mapping saved to: ${mappingPath}`)
}

// Run migration if called directly
if (require.main === module) {
  migrateStaticAssets()
    .then(async (summary) => {
      generateReport(summary)
      await saveMigrationMapping(summary)
      
      if (summary.failed === 0) {
        console.log('\n🎉 Migration completed successfully!')
        process.exit(0)
      } else {
        console.log('\n⚠️  Migration completed with errors.')
        process.exit(1)
      }
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error)
      process.exit(1)
    })
}

export { migrateStaticAssets, type MigrationSummary, type MigrationResult }
