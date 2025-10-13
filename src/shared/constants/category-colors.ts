// src/shared/constants/category-colors.ts
// Category color palette using color-mix() with chart colors
// 30 total colors: 15 strong (for AP - reddish) + 15 light (for CP - bluish)
// Colors adapt to theme changes automatically

export interface CategoryColor {
  value: string
  name: string
  type: 'strong' | 'light'
  specialty: 'AP' | 'CP'
}

// Strong colors for AP (Anatomic Pathology) - Reddish hues
// Using chart-5 (red), chart-4 (orange), chart-3 (purple) as base
export const AP_COLORS: CategoryColor[] = [
  { value: 'color-mix(in oklch, hsl(var(--chart-5)) 100%, transparent)', name: 'Rose', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-4)) 100%, transparent)', name: 'Coral', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-3)) 100%, transparent)', name: 'Purple', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-5)) 90%, hsl(var(--chart-4)) 10%)', name: 'Pink', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-4)) 90%, hsl(var(--chart-5)) 10%)', name: 'Peach', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-5)) 80%, hsl(var(--chart-3)) 20%)', name: 'Magenta', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-5)) 70%, hsl(var(--chart-4)) 30%)', name: 'Salmon', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-3)) 90%, hsl(var(--chart-5)) 10%)', name: 'Violet', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-5)) 85%, hsl(var(--chart-3)) 15%)', name: 'Red', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-3)) 60%, hsl(var(--chart-5)) 40%)', name: 'Fuchsia', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-4)) 85%, hsl(var(--chart-5)) 15%)', name: 'Terracotta', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-3)) 70%, hsl(var(--chart-5)) 30%)', name: 'Orchid', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-5)) 95%, hsl(var(--chart-3)) 5%)', name: 'Crimson', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-3)) 50%, hsl(var(--chart-5)) 50%)', name: 'Berry', type: 'strong', specialty: 'AP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-4)) 95%, hsl(var(--chart-3)) 5%)', name: 'Apricot', type: 'strong', specialty: 'AP' },
]

// Light colors for CP (Clinical Pathology) - Bluish hues
// Using chart-2 (blue), chart-1 (cyan/teal) as base, mixed with white for lightness
export const CP_COLORS: CategoryColor[] = [
  { value: 'color-mix(in oklch, hsl(var(--chart-2)) 50%, white 50%)', name: 'Sky Blue', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-1)) 50%, white 50%)', name: 'Mint', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-2)) 55%, white 45%)', name: 'Light Blue', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-1)) 55%, white 45%)', name: 'Aqua', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-2)) 45%, hsl(var(--chart-1)) 10%, white 45%)', name: 'Cyan', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-1)) 60%, white 40%)', name: 'Seafoam', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-2)) 60%, white 40%)', name: 'Periwinkle', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-1)) 45%, hsl(var(--chart-2)) 10%, white 45%)', name: 'Turquoise', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-2)) 40%, white 60%)', name: 'Baby Blue', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-1)) 65%, white 35%)', name: 'Teal', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-2)) 65%, hsl(var(--chart-3)) 5%, white 30%)', name: 'Lavender', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-1)) 40%, white 60%)', name: 'Ice Blue', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-2)) 35%, white 65%)', name: 'Powder Blue', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-1)) 70%, white 30%)', name: 'Sage', type: 'light', specialty: 'CP' },
  { value: 'color-mix(in oklch, hsl(var(--chart-2)) 70%, white 30%)', name: 'Cornflower', type: 'light', specialty: 'CP' },
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

