// Category color utilities for consistent color management
// This replaces the duplicated color logic across components

export interface ColorOption {
  value: string
}

export interface CategoryColorData {
  color?: string
  short_form?: string
  parent_short_form?: string
}

// Curated color palette with top and bottom rows (darker and lighter versions)
export const generateCategoryColors = () => {
  // Top row - stronger/darker colors
  const strongColors: ColorOption[] = [
    { value: 'hsl(186 66% 40%)' },   // Teal
    { value: 'hsl(220 85% 55%)' },   // Blue  
    { value: 'hsl(262 75% 55%)' },   // Purple
    { value: 'hsl(340 75% 50%)' },   // Pink
    { value: 'hsl(32 90% 55%)' },    // Orange
    { value: 'hsl(142 70% 45%)' },   // Green
    { value: 'hsl(15 85% 55%)' },    // Red-Orange
    { value: 'hsl(45 85% 50%)' },    // Yellow
    // Removed: { value: 'hsl(280 80% 60%)' },   // Magenta (color 9)
    // Removed: { value: 'hsl(120 60% 35%)' },   // Dark Green (color 10)
    { value: 'hsl(200 80% 50%)' },   // Sky Blue
    { value: 'hsl(5 80% 55%)' },     // Red
    // Removed: { value: 'hsl(300 60% 45%)' },   // Deep Purple (color 12)
    // Removed: { value: 'hsl(25 85% 45%)' },    // Brown-Orange (color 13)
    { value: 'hsl(160 65% 45%)' },   // Emerald
    { value: 'hsl(240 70% 58%)' },   // Indigo
    { value: 'hsl(60 70% 50%)' },    // Lime
    { value: 'hsl(320 70% 55%)' },   // Hot Pink
    { value: 'hsl(180 60% 40%)' },   // Cyan
    // Removed: { value: 'hsl(0 70% 50%)' },     // Crimson (color 20)
  ]

  // Bottom row - lighter versions of the same colors
  const lightColors: ColorOption[] = [
    { value: 'hsl(186 66% 65%)' },   // Light Teal
    { value: 'hsl(220 85% 75%)' },   // Light Blue  
    { value: 'hsl(262 75% 75%)' },   // Light Purple
    { value: 'hsl(340 75% 70%)' },   // Light Pink
    { value: 'hsl(32 90% 75%)' },    // Light Orange
    { value: 'hsl(142 70% 65%)' },   // Light Green
    { value: 'hsl(15 85% 75%)' },    // Light Red-Orange
    { value: 'hsl(45 85% 70%)' },    // Light Yellow
    { value: 'hsl(200 80% 70%)' },   // Light Sky Blue
    { value: 'hsl(5 80% 75%)' },     // Light Red
    { value: 'hsl(160 65% 65%)' },   // Light Emerald
    { value: 'hsl(240 70% 78%)' },   // Light Indigo
    { value: 'hsl(60 70% 70%)' },    // Light Lime
    { value: 'hsl(320 70% 75%)' },   // Light Hot Pink
    { value: 'hsl(180 60% 60%)' },   // Light Cyan
  ]

  return { strongColors, lightColors }
}

// Get all colors once
const { strongColors, lightColors } = generateCategoryColors()

// Export the color arrays for use in components
export { strongColors, lightColors }

// Enhanced color assignment function that prioritizes manually set colors
export const getCategoryColor = (category: CategoryColorData): string => {
  // First priority: use the manually set color from database
  if (category.color) {
    return category.color
  }
  
  // Fallback: auto-generate color based on short form
  const shortForm = category.short_form
  const parentShortForm = category.parent_short_form
  
  if (!shortForm) {
    return strongColors[0].value // Default color if no short form
  }
  
  // Main parent categories get their specific colors
  if (shortForm === 'AP') return strongColors[0].value // First color (teal)
  if (shortForm === 'CP') return lightColors[0].value // Light teal for CP
  
  // Determine if this is an AP or CP subspecialty
  const isAPSubspecialty = parentShortForm === 'AP'
  const isCPSubspecialty = parentShortForm === 'CP'
  
  // Use appropriate color palette based on parent
  const colorPalette = isAPSubspecialty ? strongColors.slice(1) : // Skip first color (reserved for AP)
                      isCPSubspecialty ? lightColors.slice(1) :   // Skip first color (reserved for CP) 
                      strongColors.slice(1) // Default to strong colors for non-parent categories
  
  // Hash the short form to get consistent color assignment
  let hash = 0
  for (let i = 0; i < shortForm.length; i++) {
    hash = shortForm.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colorIndex = Math.abs(hash) % colorPalette.length
  
  return colorPalette[colorIndex].value
}

// Helper function to get all available colors for selection
export const getAllColors = (): ColorOption[] => {
  return [...strongColors, ...lightColors]
}