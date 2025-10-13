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

// Manually curated beautiful colors that are distinct and professional
export const generateCategoryColors = () => {
  // Strong colors for AP subspecialties - vibrant but sophisticated
  const strongColors: ColorOption[] = [
    { value: 'hsl(186 66% 40%)' },   // Cyan (reserved for AP parent)
    { value: 'hsl(220 85% 55%)' },   // Royal Blue
    { value: 'hsl(262 75% 55%)' },   // Purple
    { value: 'hsl(340 75% 50%)' },   // Rose Red
    { value: 'hsl(32 90% 55%)' },    // Orange
    { value: 'hsl(142 70% 45%)' },   // Forest Green
    { value: 'hsl(290 70% 58%)' },   // Magenta
    { value: 'hsl(200 80% 50%)' },   // Sky Blue
    { value: 'hsl(15 85% 55%)' },    // Coral
    { value: 'hsl(160 65% 45%)' },   // Teal
    { value: 'hsl(45 85% 50%)' },    // Golden
    { value: 'hsl(280 80% 60%)' },   // Violet
    { value: 'hsl(120 60% 45%)' },   // Green
    { value: 'hsl(240 70% 58%)' },   // Indigo
    { value: 'hsl(5 80% 55%)' },     // Crimson
  ]

  // Light colors for CP subspecialties - softer but still vibrant
  const lightColors: ColorOption[] = [
    { value: 'hsl(186 66% 70%)' },   // Light Cyan (reserved for CP parent)
    { value: 'hsl(220 65% 70%)' },   // Light Royal Blue
    { value: 'hsl(262 55% 70%)' },   // Light Purple
    { value: 'hsl(340 55% 72%)' },   // Light Rose
    { value: 'hsl(32 70% 70%)' },    // Light Orange
    { value: 'hsl(142 50% 65%)' },   // Light Forest Green
    { value: 'hsl(290 50% 73%)' },   // Light Magenta
    { value: 'hsl(200 60% 70%)' },   // Light Sky Blue
    { value: 'hsl(15 65% 72%)' },    // Light Coral
    { value: 'hsl(160 45% 65%)' },   // Light Teal
    { value: 'hsl(45 65% 70%)' },    // Light Golden
    { value: 'hsl(280 60% 75%)' },   // Light Violet
    { value: 'hsl(120 40% 65%)' },   // Light Green
    { value: 'hsl(240 50% 73%)' },   // Light Indigo
    { value: 'hsl(5 60% 72%)' },     // Light Crimson
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
  if (shortForm === 'AP') return strongColors[0].value // First strong color (cyan)
  if (shortForm === 'CP') return lightColors[0].value  // First light color (light cyan)
  
  // Determine if this is an AP or CP subspecialty
  const isAPSubspecialty = parentShortForm === 'AP'
  const isCPSubspecialty = parentShortForm === 'CP'
  
  // Use appropriate color palette based on parent
  const colorPalette = isAPSubspecialty ? strongColors.slice(1) : // Skip first color (reserved for AP)
                      isCPSubspecialty ? lightColors.slice(1) :   // Skip first color (reserved for CP) 
                      strongColors.slice(1) // Default to dark colors for non-parent categories
  
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

// Helper function to get colors by type
export const getColorsByType = (type: 'strong' | 'light'): ColorOption[] => {
  return type === 'strong' ? strongColors : lightColors
}