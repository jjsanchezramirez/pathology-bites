// src/shared/config/learning-module-icons.ts

interface HealthIcon {
  id: string
  category: string
  path: string
  title: string
  style: 'outline' | 'filled'
}

// Icon mapping for pathology learning module categories
export const LEARNING_MODULE_ICONS: Record<string, HealthIcon> = {
  // Anatomic Pathology - Organ Systems
  'breast': {
    id: 'breasts',
    category: 'body',
    path: 'body/breasts',
    title: 'Breast Pathology',
    style: 'outline'
  },
  'gu': {
    id: 'kidneys',
    category: 'body',
    path: 'body/kidneys',
    title: 'Genitourinary Pathology',
    style: 'outline'
  },
  'male_reproductive': {
    id: 'kidneys', // Using kidneys as placeholder for GU system
    category: 'body',
    path: 'body/kidneys',
    title: 'Male Reproductive Pathology',
    style: 'outline'
  },
  'cardiovascular': {
    id: 'heart_organ',
    category: 'body',
    path: 'body/heart_organ',
    title: 'Cardiovascular Pathology',
    style: 'outline'
  },
  'head_neck': {
    id: 'heart_organ', // Placeholder - no specific H&N icon available
    category: 'body',
    path: 'body/heart_organ',
    title: 'Head & Neck Pathology',
    style: 'outline'
  },
  'digestive': {
    id: 'stomach',
    category: 'body',
    path: 'body/stomach',
    title: 'Digestive System Pathology',
    style: 'outline'
  },
  'endocrine': {
    id: 'thyroid',
    category: 'body',
    path: 'body/thyroid',
    title: 'Endocrine Pathology',
    style: 'outline'
  },
  'female_reproductive': {
    id: 'breasts', // Using breasts as closest available icon
    category: 'body',
    path: 'body/breasts',
    title: 'Female Reproductive Pathology',
    style: 'outline'
  },
  'placenta': {
    id: 'breasts', // Placeholder - no specific placenta icon available
    category: 'body',
    path: 'body/breasts',
    title: 'Placental Pathology',
    style: 'outline'
  },
  'respiratory': {
    id: 'lungs',
    category: 'body',
    path: 'body/lungs',
    title: 'Respiratory Pathology',
    style: 'outline'
  },
  'pleura_mediastinum': {
    id: 'lungs', // Using lungs as closest available icon
    category: 'body',
    path: 'body/lungs',
    title: 'Pleura & Mediastinum Pathology',
    style: 'outline'
  },
  'bone_soft_tissue': {
    id: 'skeleton',
    category: 'body',
    path: 'body/skeleton',
    title: 'Bone & Soft Tissue Pathology',
    style: 'outline'
  },
  
  // Anatomic Pathology - Specialized Areas
  'cyto': {
    id: 'microscope',
    category: 'devices',
    path: 'devices/microscope',
    title: 'Cytopathology',
    style: 'outline'
  },
  'dermpath': {
    id: 'skeleton', // Placeholder - no specific skin icon available
    category: 'body',
    path: 'body/skeleton',
    title: 'Dermatopathology',
    style: 'outline'
  },
  'forensics': {
    id: 'microscope', // Placeholder - no magnifying glass available
    category: 'devices',
    path: 'devices/microscope',
    title: 'Forensic Pathology',
    style: 'outline'
  },
  'hemepath': {
    id: 'blood_bag',
    category: 'blood',
    path: 'blood/blood_bag',
    title: 'Hematopathology',
    style: 'outline'
  },
  'neuropath': {
    id: 'skeleton', // Placeholder - no specific brain icon available
    category: 'body',
    path: 'body/skeleton',
    title: 'Neuropathology',
    style: 'outline'
  },
  'peds_path': {
    id: 'baby_0306m',
    category: 'people',
    path: 'people/baby_0306m',
    title: 'Pediatric Pathology',
    style: 'outline'
  },
  
  // Clinical Pathology - Laboratory Medicine
  'blood_bank_transfusion': {
    id: 'blood_bag',
    category: 'blood',
    path: 'blood/blood_bag',
    title: 'Blood Bank & Transfusion Medicine',
    style: 'outline'
  },
  'clinical_chemistry': {
    id: 'test_tubes',
    category: 'devices',
    path: 'devices/test_tubes',
    title: 'Clinical Chemistry',
    style: 'outline'
  },
  'medical_microbiology': {
    id: 'bacteria',
    category: 'body',
    path: 'body/bacteria',
    title: 'Medical Microbiology',
    style: 'outline'
  },
  'molecular_pathology': {
    id: 'dna',
    category: 'body',
    path: 'body/dna',
    title: 'Molecular Pathology',
    style: 'outline'
  },
  'lab_management_informatics': {
    id: 'microscope', // Placeholder - no computer icon available
    category: 'devices',
    path: 'devices/microscope',
    title: 'Laboratory Management & Informatics',
    style: 'outline'
  },
  
  // Default fallback
  'default': {
    id: 'microscope',
    category: 'devices',
    path: 'devices/microscope',
    title: 'Pathology',
    style: 'outline'
  }
}

// Get SVG path for a healthicon
export function getHealthIconPath(iconKey: string, style: 'outline' | 'filled' = 'outline'): string {
  const icon = LEARNING_MODULE_ICONS[iconKey] || LEARNING_MODULE_ICONS.default
  return `/node_modules/healthicons/public/icons/svg/${style}/${icon.path}.svg`
}

// Get icon URL for use in components
export function getHealthIconUrl(iconKey: string, style: 'outline' | 'filled' = 'outline'): string {
  const icon = LEARNING_MODULE_ICONS[iconKey] || LEARNING_MODULE_ICONS.default
  return `/icons/svg/${style}/${icon.path}.svg`
}

// Get icon metadata
export function getHealthIconMeta(iconKey: string): HealthIcon {
  return LEARNING_MODULE_ICONS[iconKey] || LEARNING_MODULE_ICONS.default
}

// Get all available icon keys
export function getAvailableIconKeys(): string[] {
  return Object.keys(LEARNING_MODULE_ICONS)
}

// Search icons by keyword
export function searchHealthIcons(query: string): string[] {
  const lowerQuery = query.toLowerCase()
  return Object.keys(LEARNING_MODULE_ICONS).filter(key => {
    const icon = LEARNING_MODULE_ICONS[key]
    return (
      key.toLowerCase().includes(lowerQuery) ||
      icon.title.toLowerCase().includes(lowerQuery) ||
      icon.category.toLowerCase().includes(lowerQuery)
    )
  })
}

// Get icons by category
export function getHealthIconsByCategory(category: string): string[] {
  return Object.keys(LEARNING_MODULE_ICONS).filter(key => 
    LEARNING_MODULE_ICONS[key].category === category
  )
}