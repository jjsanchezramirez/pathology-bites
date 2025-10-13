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

// Curated color palette with maximum visual distinction
export const generateCategoryColors = () => {
  // Carefully selected colors with high contrast and distinction
  const colorPalette: ColorOption[] = [
    { value: 'hsl(186 66% 40%)' },   // Teal
    { value: 'hsl(220 85% 55%)' },   // Blue  
    { value: 'hsl(262 75% 55%)' },   // Purple
    { value: 'hsl(340 75% 50%)' },   // Pink
    { value: 'hsl(32 90% 55%)' },    // Orange
    { value: 'hsl(142 70% 45%)' },   // Green
    { value: 'hsl(15 85% 55%)' },    // Red-Orange
    { value: 'hsl(45 85% 50%)' },    // Yellow
    { value: 'hsl(280 80% 60%)' },   // Magenta
    { value: 'hsl(120 60% 35%)' },   // Dark Green
    { value: 'hsl(200 80% 50%)' },   // Sky Blue
    { value: 'hsl(5 80% 55%)' },     // Red
    { value: 'hsl(300 60% 45%)' },   // Deep Purple
    { value: 'hsl(25 85% 45%)' },    // Brown-Orange
    { value: 'hsl(160 65% 45%)' },   // Emerald
    { value: 'hsl(240 70% 58%)' },   // Indigo
    { value: 'hsl(60 70% 50%)' },    // Lime
    { value: 'hsl(320 70% 55%)' },   // Hot Pink
    { value: 'hsl(180 60% 40%)' },   // Cyan
    { value: 'hsl(0 70% 50%)' },     // Crimson
  ]

  return { colorPalette }
}

// Get all colors once
const { colorPalette } = generateCategoryColors()

// Export the color array for use in components
export { colorPalette }

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
    return colorPalette[0].value // Default color if no short form
  }
  
  // Main parent categories get their specific colors
  if (shortForm === 'AP') return colorPalette[0].value // First color (teal)
  if (shortForm === 'CP') return colorPalette[1].value // Second color (blue)
  
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
  return colorPalette
}