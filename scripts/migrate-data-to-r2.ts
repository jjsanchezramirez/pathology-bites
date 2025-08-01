#!/usr/bin/env tsx

/**
 * Migrate JSON data files from local /data directory to Cloudflare R2
 * 
 * This script:
 * 1. Uploads all JSON files from /data directory to R2 under /data/ prefix
 * 2. Updates any code references to use R2 URLs instead of local files
 * 3. Creates backup of original files
 * 4. Provides rollback capability
 */

import fs from 'fs/promises'
import path from 'path'
import { uploadToR2, generateDataStoragePath, getR2PublicUrl } from '../src/shared/services/r2-storage'

interface DataFile {
  localPath: string
  fileName: string
  size: number
  r2Key: string
  r2Url: string
}

interface MigrationResult {
  success: boolean
  migratedFiles: DataFile[]
  errors: string[]
  totalSize: number
  backupPath?: string
}

const DATA_DIR = path.join(process.cwd(), 'data')
const BACKUP_DIR = path.join(process.cwd(), '.legacy/data-backup')

/**
 * Get all JSON files from data directory
 */
async function getDataFiles(): Promise<{ path: string; name: string; size: number }[]> {
  try {
    const files = await fs.readdir(DATA_DIR)
    const jsonFiles = files.filter(file => file.endsWith('.json'))
    
    const fileDetails = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = path.join(DATA_DIR, file)
        const stats = await fs.stat(filePath)
        return {
          path: filePath,
          name: file,
          size: stats.size
        }
      })
    )
    
    return fileDetails
  } catch (error) {
    console.error('Error reading data directory:', error)
    return []
  }
}

/**
 * Create backup of data files
 */
async function createBackup(files: { path: string; name: string }[]): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(BACKUP_DIR, `data-backup-${timestamp}`)
  
  await fs.mkdir(backupPath, { recursive: true })
  
  for (const file of files) {
    const backupFilePath = path.join(backupPath, file.name)
    await fs.copyFile(file.path, backupFilePath)
  }
  
  console.log(`📦 Created backup at: ${backupPath}`)
  return backupPath
}

/**
 * Upload data file to R2
 */
async function uploadDataFile(filePath: string, fileName: string): Promise<DataFile> {
  const fileBuffer = await fs.readFile(filePath)
  const r2Key = generateDataStoragePath(fileName)
  
  const uploadResult = await uploadToR2(fileBuffer, r2Key, {
    contentType: 'application/json',
    metadata: {
      originalPath: filePath,
      migratedAt: new Date().toISOString(),
      purpose: 'application-data'
    }
  })
  
  return {
    localPath: filePath,
    fileName,
    size: fileBuffer.length,
    r2Key,
    r2Url: uploadResult.url
  }
}

/**
 * Update code references to use R2 URLs
 */
async function updateCodeReferences(migratedFiles: DataFile[]): Promise<void> {
  const filesToUpdate = [
    'src/app/(public)/tools/abpath/page.tsx',
    'src/shared/hooks/use-cached-data.ts',
    // Add other files that reference data files
  ]
  
  for (const file of filesToUpdate) {
    try {
      const filePath = path.join(process.cwd(), file)
      let content = await fs.readFile(filePath, 'utf-8')
      let updated = false
      
      for (const dataFile of migratedFiles) {
        // Replace local file references with R2 URLs
        const localRef = `/data/${dataFile.fileName}`
        const publicRef = `/${dataFile.fileName}`
        
        if (content.includes(localRef)) {
          content = content.replace(new RegExp(localRef, 'g'), dataFile.r2Url)
          updated = true
        }
        
        if (content.includes(publicRef) && !content.includes(dataFile.r2Url)) {
          content = content.replace(new RegExp(publicRef, 'g'), dataFile.r2Url)
          updated = true
        }
      }
      
      if (updated) {
        await fs.writeFile(filePath, content, 'utf-8')
        console.log(`✅ Updated references in: ${file}`)
      }
    } catch (error) {
      console.warn(`⚠️  Could not update ${file}:`, error)
    }
  }
}

/**
 * Main migration function
 */
async function migrateDataToR2(dryRun = false): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedFiles: [],
    errors: [],
    totalSize: 0
  }
  
  try {
    console.log('🚀 Starting data migration to Cloudflare R2...')
    
    // Get all data files
    const dataFiles = await getDataFiles()
    if (dataFiles.length === 0) {
      console.log('📁 No JSON files found in data directory')
      result.success = true
      return result
    }
    
    console.log(`📊 Found ${dataFiles.length} data files:`)
    dataFiles.forEach(file => {
      console.log(`   - ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)
    })
    
    if (dryRun) {
      console.log('🔍 DRY RUN - No files will be uploaded')
      result.success = true
      return result
    }
    
    // Create backup
    result.backupPath = await createBackup(dataFiles)
    
    // Upload files to R2
    console.log('☁️  Uploading files to R2...')
    for (const file of dataFiles) {
      try {
        const migratedFile = await uploadDataFile(file.path, file.name)
        result.migratedFiles.push(migratedFile)
        result.totalSize += migratedFile.size
        
        console.log(`✅ Uploaded: ${file.name} -> ${migratedFile.r2Url}`)
      } catch (error) {
        const errorMsg = `Failed to upload ${file.name}: ${error}`
        result.errors.push(errorMsg)
        console.error(`❌ ${errorMsg}`)
      }
    }
    
    // Update code references
    if (result.migratedFiles.length > 0) {
      console.log('🔄 Updating code references...')
      await updateCodeReferences(result.migratedFiles)
    }
    
    result.success = result.errors.length === 0
    
    console.log('\n📋 Migration Summary:')
    console.log(`   ✅ Successfully migrated: ${result.migratedFiles.length} files`)
    console.log(`   ❌ Failed: ${result.errors.length} files`)
    console.log(`   📦 Total size: ${(result.totalSize / 1024).toFixed(2)} KB`)
    
    if (result.success) {
      console.log('\n🎉 Data migration completed successfully!')
      console.log('💡 You can now delete the local /data directory if desired')
    } else {
      console.log('\n⚠️  Migration completed with errors')
    }
    
  } catch (error) {
    result.errors.push(`Migration failed: ${error}`)
    console.error('💥 Migration failed:', error)
  }
  
  return result
}

// CLI handling
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  
  console.log('📁 Cloudflare R2 Data Migration Tool')
  console.log('====================================')
  console.log('🎯 Goal: Migrate JSON data files from /data to R2 storage')
  
  const result = await migrateDataToR2(dryRun)
  
  // Save migration report
  const reportFile = path.join(process.cwd(), 'r2-data-migration-report.json')
  await fs.writeFile(reportFile, JSON.stringify(result, null, 2))
  console.log(`📊 Migration report saved to: ${reportFile}`)
  
  process.exit(result.success ? 0 : 1)
}

if (require.main === module) {
  main().catch(console.error)
}

export { migrateDataToR2 }
