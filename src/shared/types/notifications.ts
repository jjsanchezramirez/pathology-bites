// src/types/notifications.ts
export interface BaseNotification {
    id: string
    created_at: string
    read: boolean
  }
  
  export interface InquiryNotification extends BaseNotification {
    type: 'technical_inquiry' | 'general_inquiry'
    title: string
    description: string
    metadata: {
      inquiryId: string
      requestType: string
      email: string
      status: string
    }
  }
  
  export interface ReportNotification extends BaseNotification {
    type: 'question_report'
    title: string
    description: string
    metadata: {
      reportId: string
      questionId: string
      reportType: string
      reportedBy: string
      status: string
    }
  }
  
  export type Notification = InquiryNotification | ReportNotification
  
  // Define types for the inquiry and report payload
  export interface InquiryPayload {
    id: string
    first_name: string
    last_name: string
    organization?: string
    request_type: string
    email: string
    status: string
    created_at: string
  }
  
  export interface ReportPayload {
    id: string
    question_id: string
    report_type: string
    reported_by: string
    status: string
    created_at: string
  }