#!/usr/bin/env node

/**
 * Systematic API Reorganization Script
 * 
 * Implements the 5-directory structure reorganization in phases:
 * 1. content/ - Quiz, questions, learning operations
 * 2. public/ - Unauthenticated public access (consolidate and clean)
 * 3. media/ - Images and R2 storage operations
 * 4. admin/ - Keep existing (no changes)
 * 5. user/ - Keep existing (no changes)
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

class SystematicAPIReorganizer {
  constructor() {
    this.apiDir = path.join(process.cwd(), 'src/app/api')
    this.moves = []
    this.frontendUpdates = []
    this.errors = []
  }

  // Phase 1: Create CONTENT directory structure
  async phase1_CreateContentStructure() {
    console.log('🚀 Phase 1: Creating CONTENT directory structure...\n')
    
    const contentMoves = [
      // Move quiz endpoints to content/quiz/
      { from: 'quiz/sessions', to: 'content/quiz/sessions' },
      { from: 'quiz/attempts', to: 'content/quiz/attempts' },
      { from: 'quiz/options', to: 'content/quiz/options' },
      { from: 'quiz/questions', to: 'content/quiz/questions' },
      
      // Move learning endpoints to content/learning/
      { from: 'learning', to: 'content/learning/modules' },
      { from: 'learning-modules', to: 'content/learning/modules' },
      { from: 'learning-paths', to: 'content/learning/paths' }
      
      // Note: content/questions already exists in correct location
    ]
    
    return this.executeMoves(contentMoves, 'CONTENT')
  }

  // Phase 2: Consolidate PUBLIC directory structure
  async phase2_ConsolidatePublicStructure() {
    console.log('🚀 Phase 2: Consolidating PUBLIC directory structure...\n')
    
    const publicMoves = [
      // Move tools to public/tools/
      { from: 'tools', to: 'public/tools' },
      
      // Move auth to public/auth/ (since it's unauthenticated)
      { from: 'auth', to: 'public/auth' },
      
      // Move other public endpoints
      { from: 'subscribe', to: 'public/subscribe' },
      { from: 'maintenance-notifications', to: 'public/maintenance' },
      { from: 'security', to: 'public/security' }
    ]
    
    // Also consolidate health endpoints (remove duplicates)
    const healthConsolidation = [
      { action: 'REMOVE', path: 'health' }, // Remove duplicate
      { action: 'REMOVE', path: 'public/health' } // Keep only one version
    ]
    
    // Consolidate data endpoints (remove public-data duplicates)
    const dataConsolidation = [
      { action: 'REMOVE', path: 'public-data' } // Remove duplicate, keep public/data
    ]
    
    // Remove CSRF token duplicates
    const csrfConsolidation = [
      { action: 'REMOVE', path: 'csrf-token' }, // Remove duplicate
      { action: 'REMOVE', path: 'public/csrf-token' } // Move to public/auth/csrf-token
    ]
    
    return this.executeMoves(publicMoves, 'PUBLIC')
  }

  // Phase 3: Create MEDIA directory structure
  async phase3_CreateMediaStructure() {
    console.log('🚀 Phase 3: Creating MEDIA directory structure...\n')
    
    const mediaMoves = [
      { from: 'images', to: 'media/images' },
      { from: 'r2', to: 'media/r2' }
    ]
    
    return this.executeMoves(mediaMoves, 'MEDIA')
  }

  // Execute a set of moves for a phase
  async executeMoves(moves, phaseName) {
    console.log(`📦 ${phaseName} Phase Moves:`)
    
    for (const move of moves) {
      const fromPath = path.join(this.apiDir, move.from)
      const toPath = path.join(this.apiDir, move.to)
      
      console.log(`  ${move.from} → ${move.to}`)
      
      // Check if source exists
      if (!fs.existsSync(fromPath)) {
        console.log(`    ⚠️  Source does not exist: ${fromPath}`)
        continue
      }
      
      // Create destination directory
      const toDir = path.dirname(toPath)
      if (!fs.existsSync(toDir)) {
        fs.mkdirSync(toDir, { recursive: true })
        console.log(`    📁 Created directory: ${toDir}`)
      }
      
      // Check if destination already exists
      if (fs.existsSync(toPath)) {
        console.log(`    ⚠️  Destination already exists: ${toPath}`)
        continue
      }
      
      try {
        // Move the directory
        fs.renameSync(fromPath, toPath)
        console.log(`    ✅ Moved successfully`)
        
        this.moves.push({
          from: move.from,
          to: move.to,
          apiFrom: `/api/${move.from}`,
          apiTo: `/api/${move.to}`
        })
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`)
        this.errors.push({ move, error: error.message })
      }
    }
    
    console.log('')
  }

  // Update frontend references for completed moves
  async updateFrontendReferences() {
    console.log('🔄 Updating frontend references...\n')
    
    for (const move of this.moves) {
      console.log(`Updating references: ${move.apiFrom} → ${move.apiTo}`)
      
      try {
        // Find all files that reference the old API path
        const searchDirs = ['src/app', 'src/features', 'src/shared', 'src/components']
        const grepCommand = `grep -r "${move.apiFrom}" ${searchDirs.join(' ')} --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -l || true`
        const output = execSync(grepCommand, { encoding: 'utf8' })
        
        if (output.trim()) {
          const files = output.trim().split('\n').filter(f => f.trim())
          console.log(`  📎 Found ${files.length} files to update`)
          
          // Update each file
          for (const file of files) {
            try {
              let content = fs.readFileSync(file, 'utf8')
              const originalContent = content
              
              // Replace the API path
              content = content.replace(new RegExp(move.apiFrom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), move.apiTo)
              
              if (content !== originalContent) {
                fs.writeFileSync(file, content)
                console.log(`    ✅ Updated: ${file}`)
                this.frontendUpdates.push(file)
              }
            } catch (error) {
              console.log(`    ❌ Error updating ${file}: ${error.message}`)
              this.errors.push({ file, error: error.message })
            }
          }
        } else {
          console.log(`  📎 No references found`)
        }
      } catch (error) {
        console.log(`  ❌ Error searching for references: ${error.message}`)
      }
    }
    
    console.log('')
  }

  // Remove duplicate and redirect endpoints
  async removeDuplicates() {
    console.log('🗑️  Removing duplicate and redirect endpoints...\n')
    
    const toRemove = [
      'health', // Keep public/health only
      'csrf-token', // Move functionality to public/auth
      'public-data', // Keep public/data only
      'educational' // Move to content if needed
    ]
    
    for (const endpoint of toRemove) {
      const endpointPath = path.join(this.apiDir, endpoint)
      
      if (fs.existsSync(endpointPath)) {
        try {
          // Check if it's a redirect endpoint
          const routeFile = path.join(endpointPath, 'route.ts')
          if (fs.existsSync(routeFile)) {
            const content = fs.readFileSync(routeFile, 'utf8')
            if (content.includes('NextResponse.redirect')) {
              console.log(`  🔄 Removing redirect endpoint: ${endpoint}`)
              fs.rmSync(endpointPath, { recursive: true, force: true })
              console.log(`    ✅ Removed successfully`)
            } else {
              console.log(`  ⚠️  ${endpoint} is not a redirect endpoint, skipping`)
            }
          }
        } catch (error) {
          console.log(`  ❌ Error removing ${endpoint}: ${error.message}`)
          this.errors.push({ endpoint, error: error.message })
        }
      } else {
        console.log(`  📎 ${endpoint} does not exist`)
      }
    }
    
    console.log('')
  }

  // Consolidate health endpoints
  async consolidateHealthEndpoints() {
    console.log('🏥 Consolidating health endpoints...\n')
    
    const publicHealthPath = path.join(this.apiDir, 'public/health')
    const healthPath = path.join(this.apiDir, 'health')
    
    // If both exist, remove the root health endpoint
    if (fs.existsSync(healthPath) && fs.existsSync(publicHealthPath)) {
      console.log('  Removing duplicate health endpoint...')
      fs.rmSync(healthPath, { recursive: true, force: true })
      console.log('  ✅ Removed /api/health (keeping /api/public/health)')
      
      // Update references
      this.moves.push({
        from: 'health',
        to: 'public/health',
        apiFrom: '/api/health',
        apiTo: '/api/public/health'
      })
    }
    
    console.log('')
  }

  // Generate final report
  generateReport() {
    console.log('📊 REORGANIZATION COMPLETE!\n')
    console.log('='.repeat(60))
    
    console.log('\n✅ SUCCESSFUL MOVES:')
    this.moves.forEach(move => {
      console.log(`  ${move.from} → ${move.to}`)
    })
    
    console.log(`\n🔄 FRONTEND FILES UPDATED: ${this.frontendUpdates.length}`)
    if (this.frontendUpdates.length > 0) {
      this.frontendUpdates.slice(0, 10).forEach(file => {
        console.log(`  - ${file}`)
      })
      if (this.frontendUpdates.length > 10) {
        console.log(`  ... and ${this.frontendUpdates.length - 10} more`)
      }
    }
    
    if (this.errors.length > 0) {
      console.log(`\n❌ ERRORS ENCOUNTERED: ${this.errors.length}`)
      this.errors.forEach(error => {
        console.log(`  - ${JSON.stringify(error)}`)
      })
    }
    
    console.log('\n🎯 FINAL API STRUCTURE:')
    console.log('src/app/api/')
    console.log('├── content/')
    console.log('│   ├── quiz/          # Quiz sessions, attempts, options, questions')
    console.log('│   ├── questions/     # Question CRUD, reviews, exports, flags')
    console.log('│   └── learning/      # Learning modules, paths, progress')
    console.log('├── admin/             # Administrative operations (unchanged)')
    console.log('├── user/              # Authenticated user operations (unchanged)')
    console.log('├── public/')
    console.log('│   ├── health/        # Health checks')
    console.log('│   ├── data/          # Public data endpoints')
    console.log('│   ├── tools/         # Public tools')
    console.log('│   ├── auth/          # Authentication endpoints')
    console.log('│   └── ...            # Other public endpoints')
    console.log('└── media/')
    console.log('    ├── images/        # Image operations')
    console.log('    └── r2/            # R2 storage operations')
    
    console.log('\n📋 NEXT STEPS:')
    console.log('1. Test all functionality to ensure nothing is broken')
    console.log('2. Update any remaining hardcoded API paths')
    console.log('3. Update API documentation')
    console.log('4. Run linting and build checks')
  }

  // Main execution function
  async execute() {
    console.log('🚀 Starting Systematic API Reorganization...\n')
    
    try {
      // Execute phases in order
      await this.phase1_CreateContentStructure()
      await this.phase2_ConsolidatePublicStructure()
      await this.phase3_CreateMediaStructure()
      
      // Clean up duplicates
      await this.consolidateHealthEndpoints()
      await this.removeDuplicates()
      
      // Update frontend references
      await this.updateFrontendReferences()
      
      // Generate final report
      this.generateReport()
      
    } catch (error) {
      console.error('❌ Fatal error during reorganization:', error)
      process.exit(1)
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help')) {
    console.log('Systematic API Reorganization Script')
    console.log('')
    console.log('Usage:')
    console.log('  node systematic-api-reorganization.js [options]')
    console.log('')
    console.log('Options:')
    console.log('  --help     Show this help message')
    console.log('  --dry-run  Show what would be done without making changes')
    console.log('')
    return
  }
  
  if (args.includes('--dry-run')) {
    console.log('🔍 DRY RUN MODE - No actual changes will be made')
    console.log('This feature is not yet implemented. Remove --dry-run to execute.')
    return
  }
  
  const reorganizer = new SystematicAPIReorganizer()
  await reorganizer.execute()
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { SystematicAPIReorganizer }
