#!/usr/bin/env tsx

/**
 * Category Color Assignment Script
 *
 * This script assigns unique, distinct colors to each pathology category:
 * - AP (Anatomic Pathology) categories use stronger/darker colors
 * - CP (Clinical Pathology) categories use lighter colors
 * - Each category gets a unique color with no duplicates
 * - Colors are in HSL format following the project's theming system
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Color assignment mapping based on category IDs from database
const COLOR_ASSIGNMENTS = {
  // Parent Categories
  '67ff6b84-6587-42c2-9874-4d8da0fb1a6d': 'hsl(186 66% 40%)', // Anatomic Pathology (AP) - Teal
  '68ff6c8e-c687-447a-ab0b-2cae8ecdc473': 'hsl(186 66% 65%)', // Clinical Pathology (CP) - Light Teal

  // AP Subcategories (Strong Colors - alphabetical order)
  'fdaf44b9-b8e7-4f33-ad04-0c005aaafe4d': 'hsl(220 85% 55%)', // Bone & Soft Tissue - Blue
  'e9032a40-2d26-43b0-965b-2188e949b76e': 'hsl(262 75% 55%)', // Breast - Purple
  'eb03af9c-fbd2-48a8-bd31-be7cbfc16094': 'hsl(340 75% 50%)', // Cytopathology - Pink
  '620f5a8c-1d48-4477-beb7-3b2d1d47adf0': 'hsl(32 90% 55%)',  // Dermatopathology - Orange
  'c1b13e07-d774-49c3-b224-24221f274ccb': 'hsl(142 70% 45%)', // Endocrine & Neuroendocrine - Green
  '5ce89145-b75b-416e-a838-febe567844a1': 'hsl(15 85% 55%)',  // Forensics & Autopsy - Red-Orange
  '410cb8d0-b12b-4e9a-a1e8-e596f7018346': 'hsl(45 85% 50%)',  // Gastrointestinal - Yellow
  '8f33b1ec-56c2-419e-aa6c-a048c02090f5': 'hsl(200 80% 50%)', // Genitourinary - Sky Blue
  'c28dd904-aa6d-439c-a946-ac0bc0a6a64e': 'hsl(5 80% 55%)',   // Gynecologic - Red
  'fe2aab09-86ed-4c3d-a200-107dd95a9ab8': 'hsl(160 65% 45%)', // Head & Neck - Emerald
  '99be94bf-386e-407e-b96a-4784c9580f0d': 'hsl(240 70% 58%)', // Liver - Indigo
  '9779afa6-3773-49f6-8ca9-f112e4b59a9b': 'hsl(60 70% 50%)',  // Neuropathology - Lime
  '85adf114-3e76-4a4f-af3b-7c64e03576e3': 'hsl(320 70% 55%)', // Pancreatobiliary - Hot Pink
  '37443ebb-d4c0-4789-82be-6d9e02655af5': 'hsl(180 60% 40%)', // Pediatric - Cyan
  '38aa8d52-97bb-4642-9660-36c12a5ced38': 'hsl(280 70% 50%)', // Placental - Violet
  '48d30f10-68ef-49b9-91b0-1be2d231c2e4': 'hsl(120 70% 45%)', // Thoracic - Forest Green

  // CP Subcategories (Light Colors - alphabetical order)
  '2f0c7425-5c0e-4c2d-a373-34d32021a362': 'hsl(220 85% 75%)', // Blood Banking/Transfusion Medicine - Light Blue
  'fc9d881d-f0fb-4f53-91f3-1a2f145d9156': 'hsl(262 75% 75%)', // Clinical Chemistry - Light Purple
  '7c1c342a-3fba-474e-9a07-630d3cd09465': 'hsl(340 75% 70%)', // Coagulation - Light Pink
  'ff6d727c-62b6-47b8-bbda-7f71b3111a3c': 'hsl(32 90% 75%)',  // Hematopathology - Light Orange
  '58d5f402-3344-42da-b63e-610b0d05a7ca': 'hsl(142 70% 65%)', // Immunology - Light Green
  'b1b60d46-72a8-4ce4-854d-2d041763c68d': 'hsl(15 85% 75%)',  // Informatics - Light Red-Orange
  'b9cd1729-189e-4774-b1f3-5b2df86ca687': 'hsl(45 85% 70%)',  // Laboratory Management & Medical Directorship - Light Yellow
  'b4aed7d4-e1ba-4450-addc-c0c8e353a465': 'hsl(200 80% 70%)', // Medical Microbiology - Light Sky Blue
  'd6d64892-2e17-4596-be2e-8ae27a41551e': 'hsl(5 80% 75%)',   // Molecular Pathology & Cytogenetics - Light Red
}

interface Category {
  id: string
  name: string
  short_form: string | null
  parent_id: string | null
  level: number
  color: string | null
}

async function fetchCategories(): Promise<Category[]> {
  console.log('📖 Fetching current categories from database...')
  
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, short_form, parent_id, level, color')
    .order('level, name')

  if (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`)
  }

  return data || []
}

function previewColorAssignments(categories: Category[]) {
  console.log('\n🎨 PROPOSED COLOR ASSIGNMENTS')
  console.log('=' .repeat(80))
  
  // Group by parent category
  const parentCategories = categories.filter(cat => cat.level === 1)
  const subcategories = categories.filter(cat => cat.level === 2)
  
  parentCategories.forEach(parent => {
    const newColor = COLOR_ASSIGNMENTS[parent.id]
    const currentColor = parent.color || 'none'
    
    console.log(`\n📁 ${parent.name} (${parent.short_form})`)
    console.log(`   Current: ${currentColor}`)
    console.log(`   New:     ${newColor}`)
    
    // Show subcategories
    const children = subcategories.filter(sub => sub.parent_id === parent.id)
    children.forEach(child => {
      const childNewColor = COLOR_ASSIGNMENTS[child.id]
      const childCurrentColor = child.color || 'none'
      
      console.log(`   ├─ ${child.name} (${child.short_form})`)
      console.log(`      Current: ${childCurrentColor}`)
      console.log(`      New:     ${childNewColor}`)
    })
  })
  
  console.log('\n' + '=' .repeat(80))
}

async function applyColorAssignments(): Promise<void> {
  console.log('\n🔄 Applying color assignments to database...')
  
  let successCount = 0
  let errorCount = 0
  
  for (const [categoryId, newColor] of Object.entries(COLOR_ASSIGNMENTS)) {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ color: newColor })
        .eq('id', categoryId)
      
      if (error) {
        console.error(`❌ Failed to update category ${categoryId}: ${error.message}`)
        errorCount++
      } else {
        console.log(`✅ Updated category ${categoryId}`)
        successCount++
      }
    } catch (err) {
      console.error(`❌ Error updating category ${categoryId}:`, err)
      errorCount++
    }
  }
  
  console.log(`\n📊 Update Summary:`)
  console.log(`   ✅ Successful: ${successCount}`)
  console.log(`   ❌ Failed: ${errorCount}`)
  console.log(`   📝 Total: ${Object.keys(COLOR_ASSIGNMENTS).length}`)
}

async function main() {
  try {
    console.log('🎨 Category Color Assignment Script')
    console.log('=' .repeat(50))
    
    // Fetch current categories
    const categories = await fetchCategories()
    console.log(`📊 Found ${categories.length} categories`)
    
    // Show preview
    previewColorAssignments(categories)
    
    // Ask for confirmation
    console.log('\n❓ Do you want to apply these color assignments? (y/N)')
    
    // In a real interactive environment, you'd use readline
    // For now, we'll apply automatically after preview
    const shouldApply = process.argv.includes('--apply')
    
    if (shouldApply) {
      await applyColorAssignments()
      console.log('\n🎉 Color assignment complete!')
    } else {
      console.log('\n💡 To apply these changes, run the script with --apply flag:')
      console.log('   npm run tsx scripts/assign-category-colors.ts --apply')
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error)
    process.exit(1)
  }
}

// Run the script
main()
