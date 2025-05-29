// src/types/supabase.ts
import { QuestionSetSourceDetails } from './question-sets';

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
      answer_options: {
        Row: {
          id: string
          question_id: string
          text: string
          is_correct: boolean
          explanation: string | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          question_id: string
          text: string
          is_correct?: boolean
          explanation?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          question_id?: string
          text?: string
          is_correct?: boolean
          explanation?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_options_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          }
        ]
      }
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          parent_id: string | null
          level: number
          color: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          parent_id?: string | null
          level?: number
          color?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          parent_id?: string | null
          level?: number
          color?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      tags: {
        Row: {
          id: string
          name: string
          description: string | null
          color: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          color?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          color?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions_tags: {
        Row: {
          id: string
          question_id: string
          tag_id: string
          created_at: string
        }
        Insert: {
          id?: string
          question_id: string
          tag_id: string
          created_at?: string
        }
        Update: {
          id?: string
          question_id?: string
          tag_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_tags_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_tags_tag_id_fkey"
            columns: ["tag_id"]
            referencedRelation: "tags"
            referencedColumns: ["id"]
          }
        ]
      }
      questions_categories: {
        Row: {
          id: string
          question_id: string
          category_id: string
          created_at: string
        }
        Insert: {
          id?: string
          question_id: string
          category_id: string
          created_at?: string
        }
        Update: {
          id?: string
          question_id?: string
          category_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_categories_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_categories_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
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
        Relationships: []
      }
      inquiries: {
        Row: {
          id: string
          request_type: string
          first_name: string
          last_name: string
          organization: string | null
          email: string
          inquiry: string
          created_at: string
        }
        Insert: {
          id?: string
          request_type: string
          first_name: string
          last_name: string
          organization?: string | null
          email: string
          inquiry: string
          created_at?: string
        }
        Update: {
          id?: string
          request_type?: string
          first_name?: string
          last_name?: string
          organization?: string | null
          email?: string
          inquiry?: string
          created_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          id: string
          title: string
          stem: string
          difficulty: string
          teaching_point: string
          question_references: string | null
          status: string
          created_by: string
          version: number
          question_set_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          stem: string
          difficulty: string
          teaching_point: string
          question_references?: string | null
          status?: string
          created_by: string
          version?: number
          question_set_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          stem?: string
          difficulty?: string
          teaching_point?: string
          question_references?: string | null
          status?: string
          created_by?: string
          version?: number
          question_set_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_question_set_id_fkey"
            columns: ["question_set_id"]
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          }
        ]
      }
      question_sets: {
        Row: {
          id: string
          name: string
          description: string | null
          source_type: string
          source_details: QuestionSetSourceDetails
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          source_type: string
          source_details?: QuestionSetSourceDetails
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          source_type?: string
          source_details?: QuestionSetSourceDetails
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_sets_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      question_images: {
        Row: {
          id: string
          question_id: string
          image_id: string
          question_section: string
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          question_id: string
          image_id: string
          question_section: string
          order_index?: number
          created_at?: string
        }
        Update: {
          id?: string
          question_id?: string
          image_id?: string
          question_section?: string
          order_index?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_images_image_id_fkey"
            columns: ["image_id"]
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_images_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          }
        ]
      }
      users: {
        Row: {
          id: string
          email: string | null
          first_name: string | null
          middle_initial: string | null
          last_name: string | null
          institution_id: string | null
          role: string
          user_type: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          first_name?: string | null
          middle_initial?: string | null
          last_name?: string | null
          institution_id?: string | null
          role?: string
          user_type?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          first_name?: string | null
          middle_initial?: string | null
          last_name?: string | null
          institution_id?: string | null
          role?: string
          user_type?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_institution_id_fkey"
            columns: ["institution_id"]
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          }
        ]
      }
      waitlist: {
        Row: {
          id: string
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
        }
        Relationships: []
      }
      notification_states: {
        Row: {
          id: string
          user_id: string
          source_type: string
          source_id: string
          read: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_type: string
          source_id: string
          read?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_type?: string
          source_id?: string
          read?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_states_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      question_reports: {
        Row: {
          id: string
          question_id: string
          reported_by: string
          report_type: string
          description: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          question_id: string
          reported_by: string
          report_type: string
          description?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          question_id?: string
          reported_by?: string
          report_type?: string
          description?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_reports_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_reports_reported_by_fkey"
            columns: ["reported_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}