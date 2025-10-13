// src/shared/constants/category-colors.ts
// Category color palette derived from chart colors
// 30 total colors: 15 strong (for AP - reddish) + 15 light (for CP - bluish)
// These are static HSL values that match the chart color scheme

export interface CategoryColor {
  value: string
  name: string
  type: 'strong' | 'light'
  specialty: 'AP' | 'CP'
}

// Strong colors for AP (Anatomic Pathology) - Reddish/warm hues
// Based on chart-5 (red), chart-4 (orange), chart-3 (purple)
export const AP_COLORS: CategoryColor[] = [
  { value: 'hsl(354 70% 70%)', name: 'Rose', type: 'strong', specialty: 'AP' },
  { value: 'hsl(32 85% 70%)', name: 'Coral', type: 'strong', specialty: 'AP' },
  { value: 'hsl(262 70% 70%)', name: 'Purple', type: 'strong', specialty: 'AP' },
  { value: 'hsl(350 65% 68%)', name: 'Pink', type: 'strong', specialty: 'AP' },
  { value: 'hsl(28 82% 69%)', name: 'Peach', type: 'strong', specialty: 'AP' },
  { value: 'hsl(340 68% 68%)', name: 'Magenta', type: 'strong', specialty: 'AP' },
  { value: 'hsl(10 75% 68%)', name: 'Salmon', type: 'strong', specialty: 'AP' },
  { value: 'hsl(280 68% 70%)', name: 'Violet', type: 'strong', specialty: 'AP' },
  { value: 'hsl(0 70% 68%)', name: 'Red', type: 'strong', specialty: 'AP' },
  { value: 'hsl(320 65% 70%)', name: 'Fuchsia', type: 'strong', specialty: 'AP' },
  { value: 'hsl(20 78% 68%)', name: 'Terracotta', type: 'strong', specialty: 'AP' },
  { value: 'hsl(300 68% 70%)', name: 'Orchid', type: 'strong', specialty: 'AP' },
  { value: 'hsl(5 72% 66%)', name: 'Crimson', type: 'strong', specialty: 'AP' },
  { value: 'hsl(330 65% 68%)', name: 'Berry', type: 'strong', specialty: 'AP' },
  { value: 'hsl(35 80% 70%)', name: 'Apricot', type: 'strong', specialty: 'AP' },
]

// Light colors for CP (Clinical Pathology) - Bluish/cool hues
// Based on chart-2 (blue), chart-1 (cyan/teal)
export const CP_COLORS: CategoryColor[] = [
  { value: 'hsl(214 90% 85%)', name: 'Sky Blue', type: 'light', specialty: 'CP' },
  { value: 'hsl(170 60% 85%)', name: 'Mint', type: 'light', specialty: 'CP' },
  { value: 'hsl(210 88% 83%)', name: 'Light Blue', type: 'light', specialty: 'CP' },
  { value: 'hsl(180 65% 85%)', name: 'Aqua', type: 'light', specialty: 'CP' },
  { value: 'hsl(195 82% 85%)', name: 'Cyan', type: 'light', specialty: 'CP' },
  { value: 'hsl(165 60% 85%)', name: 'Seafoam', type: 'light', specialty: 'CP' },
  { value: 'hsl(220 87% 85%)', name: 'Periwinkle', type: 'light', specialty: 'CP' },
  { value: 'hsl(175 63% 85%)', name: 'Turquoise', type: 'light', specialty: 'CP' },
  { value: 'hsl(205 84% 87%)', name: 'Baby Blue', type: 'light', specialty: 'CP' },
  { value: 'hsl(170 58% 82%)', name: 'Teal', type: 'light', specialty: 'CP' },
  { value: 'hsl(225 85% 86%)', name: 'Lavender', type: 'light', specialty: 'CP' },
  { value: 'hsl(190 78% 87%)', name: 'Ice Blue', type: 'light', specialty: 'CP' },
  { value: 'hsl(208 80% 88%)', name: 'Powder Blue', type: 'light', specialty: 'CP' },
  { value: 'hsl(160 55% 83%)', name: 'Sage', type: 'light', specialty: 'CP' },
  { value: 'hsl(218 86% 84%)', name: 'Cornflower', type: 'light', specialty: 'CP' },
]

// All colors combined (30 total)
export const ALL_CATEGORY_COLORS: CategoryColor[] = [
  ...AP_COLORS,
  ...CP_COLORS,
]

// Helper function to get color by value
export function getCategoryColor(value: string): CategoryColor | undefined {
  return ALL_CATEGORY_COLORS.find(color => color.value === value)
}

// Helper function to get colors by specialty
export function getColorsBySpecialty(specialty: 'AP' | 'CP'): CategoryColor[] {
  return specialty === 'AP' ? AP_COLORS : CP_COLORS
}

// Helper function to get color name
export function getColorName(value: string): string {
  const color = getCategoryColor(value)
  return color ? color.name : value
}

