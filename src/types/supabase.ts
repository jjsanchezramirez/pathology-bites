export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      images: {
        Row: {
          id: string
          url: string
          storage_path: string
          description: string
          alt_text: string
          category: string
          file_type: string
          source_ref: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          url: string
          storage_path: string
          description: string
          alt_text: string
          category: string
          file_type: string
          source_ref?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          url?: string
          storage_path?: string
          description?: string
          alt_text?: string
          category?: string
          file_type?: string
          source_ref?: string | null
          created_by?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}