#!/usr/bin/env tsx
/**
 * Complete Egress Optimization Script
 *
 * Runs the complete egress optimization process:
 * 1. Migrates static assets to Cloudflare R2
 * 2. Updates all asset references in the codebase
 * 3. Verifies the optimization implementation
 * 4. Generates a comprehensive report
 */

import { config } from 'dotenv'
import { migrateStaticAssets, type MigrationSummary } from './migrate-static-assets'
import { updateAssetReferences, type UpdateSummary } from './update-asset-references'
import fs from 'fs/promises'
import path from 'path'

// Load environment variables from .env.local
config({ path: '.env.local' })

interface OptimizationReport {
  timestamp: string
  migration: MigrationSummary
  updates: UpdateSummary
  verification: {
    r2ConnectionWorking: boolean
    egressOptimizationWorking: boolean
    assetMigrationComplete: boolean
    referenceUpdatesComplete: boolean
  }
  recommendations: string[]
  totalSavingsEstimate: {
    storageGB: number
    egressGB: number
    monthlyCostSavings: number
  }
}

/**
 * Test R2 connection and basic functionality
 */
async function testR2Connection(): Promise<boolean> {
  try {
    const { getR2FileInfo } = await import('../shared/services/r2-storage')
    
    // Test with a known file or create a test file
    const testResult = await getR2FileInfo('test-connection')
    return true // If no error thrown, connection is working
  } catch (error) {
    console.error('R2 connection test failed:', error)
    return false
  }
}

/**
 * Test egress optimization functionality
 */
async function testEgressOptimization(): Promise<boolean> {
  try {
    // Test the debug endpoint to verify optimization features
    const response = await fetch('http://localhost:3000/api/debug/egress-optimization?test=all')
    
    if (response.ok) {
      const result = await response.json()
      return result.allTestsResult?.success || false
    }
    
    return false
  } catch (error) {
    console.warn('Egress optimization test failed (this is expected if server is not running):', error)
    return false
  }
}

/**
 * Calculate estimated cost savings
 */
function calculateSavings(migration: MigrationSummary): {
  storageGB: number
  egressGB: number
  monthlyCostSavings: number
} {
  const totalSizeGB = migration.totalSizeMB / 1024
  
  // Estimate monthly egress based on typical usage patterns
  // Assume each asset is accessed 100 times per month on average
  const estimatedMonthlyEgressGB = totalSizeGB * 100
  
  // Supabase pricing: ~$0.09/GB for egress
  // Cloudflare R2: $0 for egress
  const monthlyCostSavings = estimatedMonthlyEgressGB * 0.09
  
  return {
    storageGB: totalSizeGB,
    egressGB: estimatedMonthlyEgressGB,
    monthlyCostSavings
  }
}

/**
 * Generate optimization recommendations
 */
function generateRecommendations(
  migration: MigrationSummary,
  updates: UpdateSummary,
  verification: OptimizationReport['verification']
): string[] {
  const recommendations: string[] = []
  
  if (migration.failed > 0) {
    recommendations.push(`Review and retry ${migration.failed} failed asset migrations`)
  }
  
  if (updates.totalReferences === 0) {
    recommendations.push('No asset references were found to update - verify migration mapping is correct')
  }
  
  if (!verification.r2ConnectionWorking) {
    recommendations.push('Configure Cloudflare R2 environment variables and test connection')
  }
  
  if (!verification.egressOptimizationWorking) {
    recommendations.push('Start the development server and test egress optimization endpoints')
  }
  
  if (migration.successful > 0) {
    recommendations.push('Consider removing original static assets from public/ directory after verification')
  }
  
  recommendations.push('Monitor Supabase egress usage to verify cost reduction')
  recommendations.push('Set up Cloudflare R2 custom domain for better performance')
  recommendations.push('Configure CDN caching rules for optimal asset delivery')
  
  return recommendations
}

/**
 * Save optimization report
 */
async function saveOptimizationReport(report: OptimizationReport): Promise<void> {
  const reportsDir = path.resolve(__dirname, '../data/reports')
  
  try {
    await fs.mkdir(reportsDir, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
  
  const reportPath = path.join(reportsDir, `egress-optimization-${Date.now()}.json`)
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
  
  console.log(`\n📊 Optimization report saved to: ${reportPath}`)
}

/**
 * Main optimization function
 */
async function completeEgressOptimization(): Promise<OptimizationReport> {
  console.log('🚀 Starting complete egress optimization process...\n')
  
  const startTime = Date.now()
  
  // Step 1: Migrate static assets to R2
  console.log('📦 Step 1: Migrating static assets to Cloudflare R2...')
  const migration = await migrateStaticAssets()
  
  // Step 2: Update asset references in codebase
  console.log('\n🔄 Step 2: Updating asset references in codebase...')
  const updates = await updateAssetReferences()
  
  // Step 3: Verify implementation
  console.log('\n✅ Step 3: Verifying optimization implementation...')
  const verification = {
    r2ConnectionWorking: await testR2Connection(),
    egressOptimizationWorking: await testEgressOptimization(),
    assetMigrationComplete: migration.failed === 0,
    referenceUpdatesComplete: updates.totalReferences > 0 || migration.successful === 0
  }
  
  // Step 4: Generate recommendations and savings estimate
  const recommendations = generateRecommendations(migration, updates, verification)
  const totalSavingsEstimate = calculateSavings(migration)
  
  const totalTime = Date.now() - startTime
  
  const report: OptimizationReport = {
    timestamp: new Date().toISOString(),
    migration,
    updates,
    verification,
    recommendations,
    totalSavingsEstimate
  }
  
  // Save report
  await saveOptimizationReport(report)
  
  console.log(`\n⏱️  Total optimization time: ${Math.round(totalTime / 1000)}s`)
  
  return report
}

/**
 * Generate final summary
 */
function generateFinalSummary(report: OptimizationReport): void {
  console.log('\n' + '='.repeat(60))
  console.log('🎉 EGRESS OPTIMIZATION COMPLETE')
  console.log('='.repeat(60))
  
  console.log('\n📊 Migration Summary:')
  console.log(`  • Assets migrated: ${report.migration.successful}/${report.migration.totalFiles}`)
  console.log(`  • Total size: ${report.migration.totalSizeMB} MB`)
  console.log(`  • Failed migrations: ${report.migration.failed}`)
  
  console.log('\n🔄 Updates Summary:')
  console.log(`  • Files updated: ${report.updates.filesChanged}`)
  console.log(`  • References updated: ${report.updates.totalReferences}`)
  
  console.log('\n✅ Verification:')
  console.log(`  • R2 connection: ${report.verification.r2ConnectionWorking ? '✅' : '❌'}`)
  console.log(`  • Egress optimization: ${report.verification.egressOptimizationWorking ? '✅' : '❌'}`)
  console.log(`  • Asset migration: ${report.verification.assetMigrationComplete ? '✅' : '❌'}`)
  console.log(`  • Reference updates: ${report.verification.referenceUpdatesComplete ? '✅' : '❌'}`)
  
  console.log('\n💰 Estimated Monthly Savings:')
  console.log(`  • Storage: ${report.totalSavingsEstimate.storageGB.toFixed(2)} GB`)
  console.log(`  • Egress: ${report.totalSavingsEstimate.egressGB.toFixed(2)} GB`)
  console.log(`  • Cost savings: $${report.totalSavingsEstimate.monthlyCostSavings.toFixed(2)}/month`)
  
  if (report.recommendations.length > 0) {
    console.log('\n📝 Recommendations:')
    report.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`)
    })
  }
  
  const allVerified = Object.values(report.verification).every(v => v)
  
  if (allVerified && report.migration.failed === 0) {
    console.log('\n🎉 Optimization completed successfully!')
    console.log('Your application is now optimized for minimal Supabase egress costs.')
  } else {
    console.log('\n⚠️  Optimization completed with issues.')
    console.log('Please review the recommendations above and address any failed items.')
  }
}

// Run optimization if called directly
if (require.main === module) {
  completeEgressOptimization()
    .then((report) => {
      generateFinalSummary(report)
      
      const hasIssues = report.migration.failed > 0 || 
                       !Object.values(report.verification).every(v => v)
      
      process.exit(hasIssues ? 1 : 0)
    })
    .catch((error) => {
      console.error('💥 Egress optimization failed:', error)
      process.exit(1)
    })
}

export { completeEgressOptimization, type OptimizationReport }
