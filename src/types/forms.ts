// src/types/forms.ts
export interface ContactFormData {
    requestType: 'technical' | 'general'
    firstName: string
    lastName: string
    organization?: string
    email: string
    inquiry: string
  }
  
  export interface ProfileFormData {
    firstName: string
    lastName: string
    email: string
    institution?: string
    userType: string
  }