#!/usr/bin/env node

/**
 * API Reorganization Implementation Plan
 * 
 * Systematically reorganizes the API structure into 5 top-level directories:
 * - content/ (quiz, questions, learning)
 * - admin/ (keep existing)
 * - user/ (keep existing)
 * - public/ (health, data, tools)
 * - media/ (images, r2)
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

class APIReorganizer {
  constructor() {
    this.moves = []
    this.frontendUpdates = []
    this.errors = []
    this.dryRun = true
  }

  // Define the complete reorganization mapping
  getReorganizationPlan() {
    return {
      // CONTENT directory - All content-related operations
      'content/quiz/sessions': ['quiz/sessions'],
      'content/quiz/attempts': ['quiz/attempts'],
      'content/quiz/options': ['quiz/options'],
      'content/quiz/questions': ['quiz/questions'],
      'content/questions': ['content/questions'], // Keep existing content/questions
      'content/learning': ['learning', 'learning-modules', 'learning-paths'],

      // ADMIN directory - Keep existing structure (no changes needed)
      
      // USER directory - Keep existing structure (no changes needed)

      // PUBLIC directory - All unauthenticated public access
      'public/health': ['health', 'public/health'], // Consolidate health endpoints
      'public/data': ['public/data', 'public-data'], // Consolidate data endpoints
      'public/tools': ['tools'],
      'public/auth': ['auth'], // Move auth to public since it's unauthenticated
      'public/contact': ['contact'],
      'public/subscribe': ['subscribe'],
      'public/maintenance': ['maintenance-notifications'],
      'public/security': ['security'],

      // MEDIA directory - All media and file operations
      'media/images': ['images'],
      'media/r2': ['r2'],

      // REMOVE - Eliminate duplicates and redirects
      'REMOVE': [
        'csrf-token', // Remove duplicate, keep only public/csrf-token
        'educational', // Move to content if needed, or remove
        'public/csrf-token' // Remove duplicate, consolidate to public/auth
      ]
    }
  }

  async analyzeCurrentStructure() {
    console.log('🔍 Analyzing current API structure...\n')
    
    const apiDir = path.join(process.cwd(), 'src/app/api')
    const currentStructure = this.scanDirectory(apiDir)
    
    console.log('📊 Current API Structure:')
    currentStructure.forEach(item => {
      console.log(`  ${item.path} (${item.type})`)
    })
    
    return currentStructure
  }

  scanDirectory(dir, basePath = '') {
    const items = []
    const dirItems = fs.readdirSync(dir)
    
    for (const item of dirItems) {
      if (item.startsWith('.') || item === 'README.md') continue
      
      const fullPath = path.join(dir, item)
      const relativePath = path.join(basePath, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        items.push({
          path: relativePath,
          type: 'directory',
          fullPath
        })
        // Recursively scan subdirectories
        items.push(...this.scanDirectory(fullPath, relativePath))
      } else if (item === 'route.ts') {
        items.push({
          path: relativePath.replace('/route.ts', ''),
          type: 'endpoint',
          fullPath
        })
      }
    }
    
    return items
  }

  async findAllFrontendReferences() {
    console.log('🔍 Finding all frontend API references...\n')
    
    const searchDirs = ['src/app', 'src/features', 'src/shared', 'src/components']
    const references = new Map()
    
    // Get all current API paths
    const apiDir = path.join(process.cwd(), 'src/app/api')
    const structure = this.scanDirectory(apiDir)
    const apiPaths = structure
      .filter(item => item.type === 'endpoint')
      .map(item => `/api/${item.path}`)
    
    // Search for each API path in frontend code
    for (const apiPath of apiPaths) {
      try {
        const searchPattern = apiPath.replace(/\[.*?\]/g, '') // Remove dynamic segments
        const grepCommand = `grep -r "${searchPattern}" ${searchDirs.join(' ')} --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -l || true`
        const output = execSync(grepCommand, { encoding: 'utf8' })
        
        if (output.trim()) {
          const files = output.trim().split('\n').filter(f => f.trim())
          references.set(apiPath, files)
        }
      } catch (error) {
        console.warn(`Warning: Could not search for ${apiPath}`)
      }
    }
    
    return references
  }

  generateMoveCommands() {
    const plan = this.getReorganizationPlan()
    const commands = []
    
    console.log('📋 Generating move commands...\n')
    
    Object.entries(plan).forEach(([newPath, oldPaths]) => {
      if (newPath === 'REMOVE') {
        oldPaths.forEach(oldPath => {
          commands.push({
            type: 'REMOVE',
            oldPath: `src/app/api/${oldPath}`,
            reason: 'Duplicate or redirect endpoint'
          })
        })
      } else {
        oldPaths.forEach(oldPath => {
          commands.push({
            type: 'MOVE',
            oldPath: `src/app/api/${oldPath}`,
            newPath: `src/app/api/${newPath}`,
            apiOldPath: `/api/${oldPath}`,
            apiNewPath: `/api/${newPath}`
          })
        })
      }
    })
    
    return commands
  }

  async executeReorganization(dryRun = true) {
    this.dryRun = dryRun
    
    console.log(`🚀 ${dryRun ? 'DRY RUN:' : 'EXECUTING:'} API Reorganization...\n`)
    
    const commands = this.generateMoveCommands()
    const references = await this.findAllFrontendReferences()
    
    // Group commands by type for better organization
    const moveCommands = commands.filter(cmd => cmd.type === 'MOVE')
    const removeCommands = commands.filter(cmd => cmd.type === 'REMOVE')
    
    console.log('📦 MOVE OPERATIONS:')
    moveCommands.forEach(cmd => {
      console.log(`  ${cmd.oldPath} → ${cmd.newPath}`)
      
      // Check for frontend references
      const refs = references.get(cmd.apiOldPath) || []
      if (refs.length > 0) {
        console.log(`    📎 Frontend references (${refs.length}):`)
        refs.slice(0, 3).forEach(ref => console.log(`      - ${ref}`))
        if (refs.length > 3) console.log(`      ... and ${refs.length - 3} more`)
      }
    })
    
    console.log('\n🗑️  REMOVE OPERATIONS:')
    removeCommands.forEach(cmd => {
      console.log(`  ${cmd.oldPath} (${cmd.reason})`)
    })
    
    if (!dryRun) {
      console.log('\n⚠️  This would make actual file system changes!')
      console.log('⚠️  Make sure to backup your code before proceeding!')
    }
    
    return {
      moveCommands,
      removeCommands,
      references
    }
  }

  async generateUpdateScript(commands, references) {
    console.log('\n📝 Generating frontend update script...\n')
    
    let updateScript = `#!/bin/bash
# Frontend API Reference Update Script
# Generated automatically - review before executing

echo "🔄 Updating frontend API references..."

`
    
    commands.moveCommands.forEach(cmd => {
      const refs = references.get(cmd.apiOldPath) || []
      if (refs.length > 0) {
        updateScript += `
# Update references for ${cmd.apiOldPath} → ${cmd.apiNewPath}
echo "Updating ${refs.length} references for ${cmd.apiOldPath}..."
`
        refs.forEach(file => {
          updateScript += `sed -i '' 's|${cmd.apiOldPath}|${cmd.apiNewPath}|g' "${file}"\n`
        })
      }
    })
    
    updateScript += `
echo "✅ Frontend references updated!"
echo "🧪 Please test your application thoroughly after these changes."
`
    
    fs.writeFileSync('scripts/update-frontend-references.sh', updateScript)
    execSync('chmod +x scripts/update-frontend-references.sh')
    
    console.log('✅ Created scripts/update-frontend-references.sh')
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2)
  const reorganizer = new APIReorganizer()
  
  if (args.includes('--analyze')) {
    await reorganizer.analyzeCurrentStructure()
    return
  }
  
  if (args.includes('--references')) {
    const references = await reorganizer.findAllFrontendReferences()
    console.log('\n📎 Frontend API References:')
    references.forEach((files, apiPath) => {
      console.log(`\n${apiPath} (${files.length} references):`)
      files.forEach(file => console.log(`  - ${file}`))
    })
    return
  }
  
  const dryRun = !args.includes('--execute')
  const result = await reorganizer.executeReorganization(dryRun)
  
  if (dryRun) {
    await reorganizer.generateUpdateScript(result, result.references)
    console.log('\n📋 Next Steps:')
    console.log('1. Review the reorganization plan above')
    console.log('2. Run with --execute to perform actual moves')
    console.log('3. Use scripts/update-frontend-references.sh to update references')
    console.log('4. Test thoroughly after changes')
  }
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { APIReorganizer }
