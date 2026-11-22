// src/features/inquiries/types/inquiries.ts
import { Database } from "@/shared/types/supabase";

// Database types
export type InquiryData = Database["public"]["Tables"]["inquiries"]["Row"];
export type InquiryInsert = Database["public"]["Tables"]["inquiries"]["Insert"];
export type InquiryUpdate = Database["public"]["Tables"]["inquiries"]["Update"];

// Extended types with relationships
export type InquiryWithDetails = InquiryData;

// Enums and constants
export const INQUIRY_TYPES = {
  GENERAL: "general",
  TECH: "technical",
} as const;

export const INQUIRY_STATUSES = {
  PENDING: "pending",
  RESOLVED: "resolved",
} as const;

export const INQUIRY_TYPE_LABELS: Record<string, string> = {
  general: "General",
  technical: "Technical",
};

/** The shape the admin inquiries UI works with (a full row). */
export type Inquiry = InquiryData;

export type InquiryType = (typeof INQUIRY_TYPES)[keyof typeof INQUIRY_TYPES];
