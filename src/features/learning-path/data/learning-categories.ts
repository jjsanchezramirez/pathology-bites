// src/features/learning-path/data/learning-categories.ts

import { LearningCategory } from '../types/learning-path'

// Simplified Learning Categories - Bone and Soft Tissue Only
export const LEARNING_MODULES: LearningCategory[] = [
  {
    id: 'bone-pathology',
    name: 'Bone Pathology',
    description: 'Comprehensive study of bone tumors, development, and pathological processes',
    type: 'ap',
    progress: 0,
    completedModules: 0,
    totalModules: 6,
    color: 'bg-amber-500',
    icon: '🦴',
    modules: [
      {
        id: 'bone-development',
        name: 'Bone Development & Structure',
        description: 'Normal bone formation, growth, and remodeling processes',
        questionCount: 20,
        estimatedHours: 1.5,
        status: 'available',
        order: 1
      },
      {
        id: 'bone-pathophysiology',
        name: 'Bone Pathophysiology',
        description: 'Common pathological processes affecting bone tissue',
        questionCount: 25,
        estimatedHours: 2,
        status: 'locked',
        prerequisites: ['bone-development'],
        order: 2
      },
      {
        id: 'primary-bone-tumors',
        name: 'Primary Bone Tumors',
        description: 'Benign and malignant primary bone neoplasms',
        questionCount: 35,
        estimatedHours: 3,
        status: 'locked',
        prerequisites: ['bone-pathophysiology'],
        order: 3
      },
      {
        id: 'secondary-bone-lesions',
        name: 'Secondary Bone Lesions',
        description: 'Metastatic disease and secondary bone involvement',
        questionCount: 25,
        estimatedHours: 2,
        status: 'locked',
        prerequisites: ['primary-bone-tumors'],
        order: 4
      },
      {
        id: 'metabolic-bone-disease',
        name: 'Metabolic Bone Disease',
        description: 'Osteoporosis, osteomalacia, and metabolic bone disorders',
        questionCount: 30,
        estimatedHours: 2.5,
        status: 'locked',
        prerequisites: ['bone-pathophysiology'],
        order: 5
      },
      {
        id: 'bone-infections',
        name: 'Bone Infections',
        description: 'Osteomyelitis and other infectious processes of bone',
        questionCount: 20,
        estimatedHours: 1.5,
        status: 'locked',
        prerequisites: ['metabolic-bone-disease'],
        order: 6
      }
    ]
  },
  {
    id: 'soft-tissue-pathology',
    name: 'Soft Tissue Pathology',
    description: 'Comprehensive study of soft tissue tumors and tumor-like lesions',
    type: 'ap',
    progress: 0,
    completedModules: 0,
    totalModules: 6,
    color: 'bg-rose-500',
    icon: '🔬',
    modules: [
      {
        id: 'soft-tissue-basics',
        name: 'Soft Tissue Fundamentals',
        description: 'Normal soft tissue anatomy and basic pathological concepts',
        questionCount: 20,
        estimatedHours: 1.5,
        status: 'available',
        order: 1
      },
      {
        id: 'benign-soft-tissue',
        name: 'Benign Soft Tissue Tumors',
        description: 'Lipomas, fibromas, and other benign soft tissue lesions',
        questionCount: 30,
        estimatedHours: 2.5,
        status: 'locked',
        prerequisites: ['soft-tissue-basics'],
        order: 2
      },
      {
        id: 'malignant-soft-tissue',
        name: 'Malignant Soft Tissue Tumors',
        description: 'Sarcomas and other malignant soft tissue neoplasms',
        questionCount: 40,
        estimatedHours: 3.5,
        status: 'locked',
        prerequisites: ['benign-soft-tissue'],
        order: 3
      },
      {
        id: 'soft-tissue-grading',
        name: 'Soft Tissue Tumor Grading',
        description: 'Histologic grading systems and prognostic factors',
        questionCount: 25,
        estimatedHours: 2,
        status: 'locked',
        prerequisites: ['malignant-soft-tissue'],
        order: 4
      },
      {
        id: 'soft-tissue-immunohistochemistry',
        name: 'Soft Tissue IHC',
        description: 'Immunohistochemical markers in soft tissue pathology',
        questionCount: 35,
        estimatedHours: 3,
        status: 'locked',
        prerequisites: ['malignant-soft-tissue'],
        order: 5
      },
      {
        id: 'soft-tissue-molecular',
        name: 'Molecular Diagnostics',
        description: 'Molecular testing in soft tissue tumor diagnosis',
        questionCount: 30,
        estimatedHours: 2.5,
        status: 'locked',
        prerequisites: ['soft-tissue-grading', 'soft-tissue-immunohistochemistry'],
        order: 6
      }
    ]
  }
]

// Helper function to get all modules
export function getAllModules(): LearningCategory[] {
  return LEARNING_MODULES
}

// Helper function to get module by ID
export function getModuleById(id: string): LearningCategory | undefined {
  return LEARNING_MODULES.find(module => module.id === id)
}

// Get all submodules from all main modules
export function getAllSubModules() {
  return LEARNING_MODULES.reduce((acc, module) => {
    return acc.concat(module.modules)
  }, [] as any[])
}

// Legacy exports for backward compatibility
export const AP_CATEGORIES = LEARNING_MODULES
export const CP_CATEGORIES: LearningCategory[] = []
export function getAllCategories() {
  return LEARNING_MODULES
}
export function getCategoryById(id: string) {
  return getModuleById(id)
}