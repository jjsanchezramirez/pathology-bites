// src/features/inquiries/types/inquiries.ts
import { Database } from '@/shared/types/supabase'

// Database types
export type InquiryData = Database['public']['Tables']['inquiries']['Row']
export type InquiryInsert = Database['public']['Tables']['inquiries']['Insert']
export type InquiryUpdate = Database['public']['Tables']['inquiries']['Update']

export type QuestionReportData = Database['public']['Tables']['question_reports']['Row']
export type QuestionReportInsert = Database['public']['Tables']['question_reports']['Insert']
export type QuestionReportUpdate = Database['public']['Tables']['question_reports']['Update']

// Extended types with relationships
export type InquiryWithDetails = InquiryData

export interface QuestionReportWithDetails extends QuestionReportData {
  question?: {
    title: string
  }
  reporter?: {
    first_name: string
    last_name: string
    email: string
  }
}

// Enums and constants
export const INQUIRY_TYPES = {
  GENERAL: 'general',
  TECH: 'tech'
} as const

export const REPORT_TYPES = {
  INCORRECT_ANSWER: 'incorrect_answer',
  UNCLEAR_QUESTION: 'unclear_question',
  TECHNICAL_ISSUE: 'technical_issue',
  INAPPROPRIATE_CONTENT: 'inappropriate_content'
} as const

export const REPORT_STATUSES = {
  PENDING: 'pending',
  REVIEWING: 'reviewing',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed'
} as const

export type InquiryType = typeof INQUIRY_TYPES[keyof typeof INQUIRY_TYPES]
export type ReportType = typeof REPORT_TYPES[keyof typeof REPORT_TYPES]
export type ReportStatus = typeof REPORT_STATUSES[keyof typeof REPORT_STATUSES]
