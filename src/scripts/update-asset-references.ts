#!/usr/bin/env tsx
/**
 * Asset References Update Script
 *
 * Updates all references to migrated static assets throughout the codebase
 * to use the new Cloudflare R2 URLs instead of local paths.
 */

import { config } from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'

// Load environment variables from .env.local
config({ path: '.env.local' })

interface UpdateResult {
  file: string
  originalReferences: string[]
  updatedReferences: string[]
  changeCount: number
}

interface UpdateSummary {
  totalFiles: number
  filesChanged: number
  totalReferences: number
  results: UpdateResult[]
}

/**
 * Load migration mapping from the migration script output
 */
async function loadMigrationMapping(): Promise<Record<string, string>> {
  try {
    const mappingPath = path.resolve(__dirname, '../data/asset-migration-mapping.json')
    const mappingContent = await fs.readFile(mappingPath, 'utf-8')
    return JSON.parse(mappingContent)
  } catch (error) {
    console.error('❌ Could not load migration mapping. Run migrate-static-assets.ts first.')
    throw error
  }
}

/**
 * Get all files that might contain asset references
 */
async function getFilesToUpdate(): Promise<string[]> {
  const projectRoot = path.resolve(__dirname, '../..')
  
  const patterns = [
    'src/**/*.{ts,tsx,js,jsx}',
    'src/**/*.{css,scss}',
    'src/**/*.md',
    '*.{ts,tsx,js,jsx}', // Root config files
    'public/**/*.{html,json}' // Manifest files, etc.
  ]
  
  const allFiles: string[] = []
  
  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      absolute: true,
      ignore: [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**'
      ]
    })
    allFiles.push(...files)
  }
  
  // Remove duplicates
  return [...new Set(allFiles)]
}

/**
 * Update asset references in a single file
 */
async function updateFileReferences(
  filePath: string,
  mapping: Record<string, string>
): Promise<UpdateResult> {
  const originalContent = await fs.readFile(filePath, 'utf-8')
  let updatedContent = originalContent
  
  const originalReferences: string[] = []
  const updatedReferences: string[] = []
  
  // Create regex patterns for different reference types
  const patterns = [
    // Direct string references: "/images/..." or "/logos/..."
    /(['"`])\/(?:images|logos)\/[^'"`\s]+\1/g,
    // Import statements: import ... from "/images/..."
    /import\s+[^'"`]*['"`]\/(?:images|logos)\/[^'"`]+['"`]/g,
    // CSS url() references: url("/images/...")
    /url\(['"`]?\/(?:images|logos)\/[^'"`\)]+['"`]?\)/g,
    // HTML src attributes: src="/images/..."
    /src=['"`]\/(?:images|logos)\/[^'"`\s]+['"`]/g,
    // Next.js Image src: <Image src="/images/..."
    /<Image[^>]*src=['"`]\/(?:images|logos)\/[^'"`\s]+['"`]/g
  ]
  
  for (const pattern of patterns) {
    const matches = originalContent.match(pattern) || []
    
    for (const match of matches) {
      // Extract the path from the match
      const pathMatch = match.match(/\/(?:images|logos)\/[^'"`\s\)]+/)
      if (!pathMatch) continue
      
      const originalPath = pathMatch[0]
      const newUrl = mapping[originalPath]
      
      if (newUrl) {
        originalReferences.push(originalPath)
        updatedReferences.push(newUrl)
        
        // Replace the path in the content
        updatedContent = updatedContent.replace(
          new RegExp(escapeRegExp(originalPath), 'g'),
          newUrl
        )
      }
    }
  }
  
  // Write updated content if changes were made
  if (updatedContent !== originalContent) {
    await fs.writeFile(filePath, updatedContent, 'utf-8')
  }
  
  return {
    file: path.relative(process.cwd(), filePath),
    originalReferences: [...new Set(originalReferences)],
    updatedReferences: [...new Set(updatedReferences)],
    changeCount: originalReferences.length
  }
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Update all asset references in the codebase
 */
async function updateAssetReferences(): Promise<UpdateSummary> {
  console.log('🔄 Loading migration mapping...')
  const mapping = await loadMigrationMapping()
  
  console.log(`📋 Found ${Object.keys(mapping).length} asset mappings`)
  
  console.log('🔍 Finding files to update...')
  const filesToUpdate = await getFilesToUpdate()
  
  console.log(`📁 Found ${filesToUpdate.length} files to check`)
  
  const results: UpdateResult[] = []
  let processedCount = 0
  
  for (const filePath of filesToUpdate) {
    processedCount++
    
    if (processedCount % 50 === 0) {
      console.log(`Progress: ${processedCount}/${filesToUpdate.length} files processed`)
    }
    
    try {
      const result = await updateFileReferences(filePath, mapping)
      results.push(result)
      
      if (result.changeCount > 0) {
        console.log(`✅ Updated ${result.changeCount} references in: ${result.file}`)
      }
    } catch (error) {
      console.warn(`⚠️  Could not process file ${filePath}:`, error)
    }
  }
  
  const filesChanged = results.filter(r => r.changeCount > 0).length
  const totalReferences = results.reduce((sum, r) => sum + r.changeCount, 0)
  
  return {
    totalFiles: filesToUpdate.length,
    filesChanged,
    totalReferences,
    results: results.filter(r => r.changeCount > 0) // Only include files with changes
  }
}

/**
 * Generate update report
 */
function generateUpdateReport(summary: UpdateSummary): void {
  console.log('\n📊 Asset References Update Summary:')
  console.log(`Files checked: ${summary.totalFiles}`)
  console.log(`Files updated: ${summary.filesChanged}`)
  console.log(`Total references updated: ${summary.totalReferences}`)
  
  if (summary.filesChanged > 0) {
    console.log('\n📝 Updated files:')
    summary.results.forEach(result => {
      console.log(`\n  📄 ${result.file} (${result.changeCount} changes)`)
      result.originalReferences.forEach((original, index) => {
        const updated = result.updatedReferences[index]
        console.log(`    ${original} → ${updated}`)
      })
    })
  }
}

/**
 * Verify that all expected references were updated
 */
async function verifyUpdates(mapping: Record<string, string>): Promise<void> {
  console.log('\n🔍 Verifying updates...')
  
  const filesToCheck = await getFilesToUpdate()
  const remainingReferences: string[] = []
  
  for (const filePath of filesToCheck) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      
      // Check for any remaining old references
      for (const oldPath of Object.keys(mapping)) {
        if (content.includes(oldPath)) {
          remainingReferences.push(`${filePath}: ${oldPath}`)
        }
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }
  
  if (remainingReferences.length > 0) {
    console.log('\n⚠️  Found remaining old references:')
    remainingReferences.forEach(ref => console.log(`  - ${ref}`))
  } else {
    console.log('✅ All references successfully updated!')
  }
}

// Run update if called directly
if (require.main === module) {
  updateAssetReferences()
    .then(async (summary) => {
      generateUpdateReport(summary)
      
      // Verify updates
      const mapping = await loadMigrationMapping()
      await verifyUpdates(mapping)
      
      if (summary.totalReferences > 0) {
        console.log('\n🎉 Asset references update completed successfully!')
      } else {
        console.log('\n📝 No asset references found to update.')
      }
      
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Asset references update failed:', error)
      process.exit(1)
    })
}

export { updateAssetReferences, type UpdateSummary, type UpdateResult }
