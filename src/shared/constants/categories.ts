// Category configuration based on database categories
// Source: categories table

export interface CategoryConfig {
  id: string
  name: string
  shortForm: string
  color: string
  parentId: string | null
  level: number
}

export const CATEGORIES: CategoryConfig[] = [
  // Level 1 - Main Categories
  {
    id: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    name: 'Anatomic Pathology',
    shortForm: 'AP',
    color: 'hsl(186 66% 40%)',
    parentId: null,
    level: 1,
  },
  {
    id: '68ff6c8e-c687-447a-ab0b-2cae8ecdc473',
    name: 'Clinical Pathology',
    shortForm: 'CP',
    color: 'hsl(220 85% 55%)',
    parentId: null,
    level: 1,
  },

  // Level 2 - AP Subspecialties
  {
    id: '620f5a8c-1d48-4477-beb7-3b2d1d47adf0',
    name: 'Dermatopathology',
    shortForm: 'Derm',
    color: 'hsl(32 90% 55%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: 'eb03af9c-fbd2-48a8-bd31-be7cbfc16094',
    name: 'Cytopathology',
    shortForm: 'Cyto',
    color: 'hsl(340 75% 50%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: '9779afa6-3773-49f6-8ca9-f112e4b59a9b',
    name: 'Neuropathology',
    shortForm: 'Neuro',
    color: 'hsl(60 70% 50%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: '410cb8d0-b12b-4e9a-a1e8-e596f7018346',
    name: 'Gastrointestinal',
    shortForm: 'GI',
    color: 'hsl(45 85% 50%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: 'e9032a40-2d26-43b0-965b-2188e949b76e',
    name: 'Breast',
    shortForm: 'Breast',
    color: 'hsl(262 75% 55%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: '8f33b1ec-56c2-419e-aa6c-a048c02090f5',
    name: 'Genitourinary',
    shortForm: 'GU',
    color: 'hsl(200 80% 50%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: '48d30f10-68ef-49b9-91b0-1be2d231c2e4',
    name: 'Thoracic',
    shortForm: 'Thorax',
    color: 'hsl(120 70% 45%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: 'fdaf44b9-b8e7-4f33-ad04-0c005aaafe4d',
    name: 'Bone & Soft Tissue',
    shortForm: 'BST',
    color: 'hsl(220 85% 55%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: 'fe2aab09-86ed-4c3d-a200-107dd95a9ab8',
    name: 'Head & Neck',
    shortForm: 'H&N',
    color: 'hsl(160 65% 45%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: 'c28dd904-aa6d-439c-a946-ac0bc0a6a64e',
    name: 'Gynecologic',
    shortForm: 'Gyn',
    color: 'hsl(5 80% 55%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: 'c1b13e07-d774-49c3-b224-24221f274ccb',
    name: 'Endocrine & Neuroendocrine',
    shortForm: 'Endo',
    color: 'hsl(142 70% 45%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: '99be94bf-386e-407e-b96a-4784c9580f0d',
    name: 'Liver',
    shortForm: 'Liver',
    color: 'hsl(240 70% 58%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: '85adf114-3e76-4a4f-af3b-7c64e03576e3',
    name: 'Pancreatobiliary',
    shortForm: 'Pancreatobiliary',
    color: 'hsl(320 70% 55%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: '37443ebb-d4c0-4789-82be-6d9e02655af5',
    name: 'Pediatric',
    shortForm: 'Peds',
    color: 'hsl(180 60% 40%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: '38aa8d52-97bb-4642-9660-36c12a5ced38',
    name: 'Placental',
    shortForm: 'Placenta',
    color: 'hsl(280 70% 50%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },
  {
    id: '5ce89145-b75b-416e-a838-febe567844a1',
    name: 'Forensics & Autopsy',
    shortForm: 'Autopsy',
    color: 'hsl(15 85% 55%)',
    parentId: '67ff6b84-6587-42c2-9874-4d8da0fb1a6d',
    level: 2,
  },

  // Level 2 - CP Subspecialties
  {
    id: 'fc9d881d-f0fb-4f53-91f3-1a2f145d9156',
    name: 'Clinical Chemistry',
    shortForm: 'Chem',
    color: 'hsl(262 75% 75%)',
    parentId: '68ff6c8e-c687-447a-ab0b-2cae8ecdc473',
    level: 2,
  },
  {
    id: '7c1c342a-3fba-474e-9a07-630d3cd09465',
    name: 'Coagulation',
    shortForm: 'Coag',
    color: 'hsl(340 75% 70%)',
    parentId: '68ff6c8e-c687-447a-ab0b-2cae8ecdc473',
    level: 2,
  },
  {
    id: 'b4aed7d4-e1ba-4450-addc-c0c8e353a465',
    name: 'Medical Microbiology',
    shortForm: 'Micro',
    color: 'hsl(200 80% 70%)',
    parentId: '68ff6c8e-c687-447a-ab0b-2cae8ecdc473',
    level: 2,
  },
  {
    id: '2f0c7425-5c0e-4c2d-a373-34d32021a362',
    name: 'Blood Banking/Transfusion Medicine',
    shortForm: 'BB/TM',
    color: 'hsl(220 85% 75%)',
    parentId: '68ff6c8e-c687-447a-ab0b-2cae8ecdc473',
    level: 2,
  },
  {
    id: '58d5f402-3344-42da-b63e-610b0d05a7ca',
    name: 'Immunology',
    shortForm: 'Immuno',
    color: 'hsl(142 70% 65%)',
    parentId: '68ff6c8e-c687-447a-ab0b-2cae8ecdc473',
    level: 2,
  },
  {
    id: 'd6d64892-2e17-4596-be2e-8ae27a41551e',
    name: 'Molecular Pathology & Cytogenetics',
    shortForm: 'MoPath',
    color: 'hsl(5 80% 75%)',
    parentId: '68ff6c8e-c687-447a-ab0b-2cae8ecdc473',
    level: 2,
  },
  {
    id: 'ff6d727c-62b6-47b8-bbda-7f71b3111a3c',
    name: 'Hematopathology',
    shortForm: 'Heme',
    color: 'hsl(32 90% 75%)',
    parentId: '68ff6c8e-c687-447a-ab0b-2cae8ecdc473',
    level: 2,
  },
  {
    id: 'b1b60d46-72a8-4ce4-854d-2d041763c68d',
    name: 'Informatics',
    shortForm: 'Informatics',
    color: 'hsl(15 85% 75%)',
    parentId: '68ff6c8e-c687-447a-ab0b-2cae8ecdc473',
    level: 2,
  },
  {
    id: 'b9cd1729-189e-4774-b1f3-5b2df86ca687',
    name: 'Laboratory Management & Medical Directorship',
    shortForm: 'Lab Mgmt',
    color: 'hsl(45 85% 70%)',
    parentId: '68ff6c8e-c687-447a-ab0b-2cae8ecdc473',
    level: 2,
  },
]

// Helper function to get category by name
export function getCategoryByName(name: string): CategoryConfig | undefined {
  return CATEGORIES.find(cat =>
    cat.name.toLowerCase() === name.toLowerCase() ||
    cat.shortForm.toLowerCase() === name.toLowerCase()
  )
}

// Helper function to convert HSL color to Tailwind-compatible classes
export function getCategoryBadgeClasses(_color: string): string {
  // Parse HSL color and generate appropriate Tailwind classes
  // For now, return a default class since we're using inline styles
  return 'border'
}

// Helper function to get category style from HSL color
export function getCategoryStyle(color: string) {
  const hslMatch = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/)
  if (hslMatch) {
    const [, h, s, l] = hslMatch
    const _lightness = parseInt(l)

    // Adjust for light/dark theme compatibility
    return {
      light: {
        backgroundColor: `hsl(${h} ${Math.min(parseInt(s), 50)}% 90%)`,
        color: `hsl(${h} ${s}% 20%)`,
        borderColor: `hsl(${h} ${Math.min(parseInt(s), 60)}% 70%)`,
      },
      dark: {
        backgroundColor: `hsl(${h} ${Math.min(parseInt(s), 50)}% 20%)`,
        color: `hsl(${h} ${s}% 80%)`,
        borderColor: `hsl(${h} ${Math.min(parseInt(s), 60)}% 30%)`,
      },
    }
  }

  // Fallback
  return {
    light: {
      backgroundColor: '#e5e7eb',
      color: '#1f2937',
      borderColor: '#d1d5db',
    },
    dark: {
      backgroundColor: '#374151',
      color: '#e5e7eb',
      borderColor: '#4b5563',
    },
  }
}
