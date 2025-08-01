// src/types/supabase.ts
import { QuestionSetSourceDetails } from '@/features/questions/types/question-sets';

// Define the quiz configuration type
export interface QuizConfig {
  mode: 'tutor' | 'timed' | 'untimed' | 'practice' | 'review';
  questionCount: number;
  timeLimit?: number; // deprecated - use totalTimeLimit instead
  timePerQuestion?: number;
  totalTimeLimit?: number; // total time for entire quiz in seconds (global timer)
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  categories?: string[];
  tags?: string[];
  questionSets?: string[];
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  showExplanations?: boolean;
  allowReview?: boolean;
  showProgress?: boolean;
}

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
      question_options: {
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
            foreignKeyName: "question_options_question_id_fkey"
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
      question_images: {
        Row: {
          question_id: string
          image_id: string
          question_section: string
          order_index: number
        }
        Insert: {
          question_id: string
          image_id: string
          question_section: string
          order_index?: number
        }
        Update: {
          question_id?: string
          image_id?: string
          question_section?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_images_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_images_image_id_fkey"
            columns: ["image_id"]
            referencedRelation: "images"
            referencedColumns: ["id"]
          }
        ]
      }
      question_tags: {
        Row: {
          question_id: string
          tag_id: string
        }
        Insert: {
          question_id: string
          tag_id: string
        }
        Update: {
          question_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_tags_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_tag_id_fkey"
            columns: ["tag_id"]
            referencedRelation: "tags"
            referencedColumns: ["id"]
          }
        ]
      }

      images: {
        Row: {
          id: string
          url: string
          storage_path: string | null
          description: string | null
          alt_text: string | null
          category: string
          file_type: string | null
          source_ref: string | null
          created_by: string | null
          created_at: string
          search_vector: unknown | null
          file_size_bytes: number | null
          width: number | null
          height: number | null
        }
        Insert: {
          id?: string
          url: string
          storage_path?: string | null
          description?: string | null
          alt_text?: string | null
          category: string
          file_type?: string | null
          source_ref?: string | null
          created_by?: string | null
          created_at?: string
          search_vector?: unknown | null
          file_size_bytes?: number | null
          width?: number | null
          height?: number | null
        }
        Update: {
          id?: string
          url?: string
          storage_path?: string | null
          description?: string | null
          alt_text?: string | null
          category?: string
          file_type?: string | null
          source_ref?: string | null
          created_by?: string | null
          created_at?: string
          search_vector?: unknown | null
          file_size_bytes?: number | null
          width?: number | null
          height?: number | null
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
          updated_by: string
          version: number
          question_set_id: string | null
          category_id: string | null
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
          updated_by: string
          version?: number
          question_set_id?: string | null
          category_id?: string | null
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
          updated_by?: string
          version?: number
          question_set_id?: string | null
          category_id?: string | null
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
            foreignKeyName: "questions_updated_by_fkey"
            columns: ["updated_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_set_id_fkey"
            columns: ["question_set_id"]
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      sets: {
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
            foreignKeyName: "sets_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
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
          institution: string | null
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
          institution?: string | null
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
          institution?: string | null
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
      question_reviews: {
        Row: {
          id: string
          question_id: string
          reviewer_id: string
          action: string
          feedback: string | null
          changes_made: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          question_id: string
          reviewer_id: string
          action: string
          feedback?: string | null
          changes_made?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          question_id?: string
          reviewer_id?: string
          action?: string
          feedback?: string | null
          changes_made?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_reviews_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      question_analytics: {
        Row: {
          id: string
          question_id: string
          total_attempts: number
          correct_attempts: number
          avg_time_spent: string | null
          median_time_spent: string | null
          success_rate: number | null
          difficulty_score: number | null
          flag_count: number
          review_count: number
          last_calculated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          question_id: string
          total_attempts?: number
          correct_attempts?: number
          avg_time_spent?: string | null
          median_time_spent?: string | null
          success_rate?: number | null
          difficulty_score?: number | null
          flag_count?: number
          review_count?: number
          last_calculated_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          question_id?: string
          total_attempts?: number
          correct_attempts?: number
          avg_time_spent?: string | null
          median_time_spent?: string | null
          success_rate?: number | null
          difficulty_score?: number | null
          flag_count?: number
          review_count?: number
          last_calculated_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_analytics_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          }
        ]
      }
      question_versions: {
        Row: {
          id: string
          question_id: string
          version_major: number
          version_minor: number
          version_patch: number
          version_string: string
          question_data: Json
          update_type: string
          change_summary: string | null
          changed_by: string
          created_at: string
        }
        Insert: {
          id?: string
          question_id: string
          version_major: number
          version_minor: number
          version_patch: number
          version_string: string
          question_data: Json
          update_type: string
          change_summary?: string | null
          changed_by: string
          created_at?: string
        }
        Update: {
          id?: string
          question_id?: string
          version_major?: number
          version_minor?: number
          version_patch?: number
          version_string?: string
          question_data?: Json
          update_type?: string
          change_summary?: string | null
          changed_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_versions_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_versions_changed_by_fkey"
            columns: ["changed_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      question_flags: {
        Row: {
          id: string
          question_id: string
          flagged_by: string
          flag_type: string
          description: string
          status: string
          resolved_by: string | null
          resolved_at: string | null
          resolution_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          question_id: string
          flagged_by: string
          flag_type: string
          description: string
          status?: string
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          question_id?: string
          flagged_by?: string
          flag_type?: string
          description?: string
          status?: string
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_flags_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_flags_flagged_by_fkey"
            columns: ["flagged_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_flags_resolved_by_fkey"
            columns: ["resolved_by"]
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
      demo_questions: {
        Row: {
          id: string
          question_id: string
          is_active: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          question_id: string
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          question_id?: string
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_questions_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          }
        ]
      }
      quiz_sessions: {
        Row: {
          id: string
          user_id: string
          title: string
          config: QuizConfig
          questions: string[]
          current_question_index: number
          status: string
          started_at: string | null
          completed_at: string | null
          total_time_spent: number | null
          score: number | null
          correct_answers: number | null
          total_questions: number
          total_time_limit: number | null
          time_remaining: number | null
          quiz_started_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          config: QuizConfig
          questions: string[]
          current_question_index?: number
          status?: string
          started_at?: string | null
          completed_at?: string | null
          total_time_spent?: number | null
          score?: number | null
          correct_answers?: number | null
          total_questions: number
          total_time_limit?: number | null
          time_remaining?: number | null
          quiz_started_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          config?: QuizConfig
          questions?: string[]
          current_question_index?: number
          status?: string
          started_at?: string | null
          completed_at?: string | null
          total_time_spent?: number | null
          score?: number | null
          correct_answers?: number | null
          total_questions?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      quiz_attempts: {
        Row: {
          id: string
          quiz_session_id: string
          question_id: string
          selected_answer_id: string | null
          first_answer_id: string | null
          is_correct: boolean | null
          time_spent: number | null
          attempted_at: string
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          quiz_session_id: string
          question_id: string
          selected_answer_id?: string | null
          first_answer_id?: string | null
          is_correct?: boolean | null
          time_spent?: number | null
          attempted_at?: string
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          quiz_session_id?: string
          question_id?: string
          selected_answer_id?: string | null
          first_answer_id?: string | null
          is_correct?: boolean | null
          time_spent?: number | null
          attempted_at?: string
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_session_id_fkey"
            columns: ["quiz_session_id"]
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_selected_answer_id_fkey"
            columns: ["selected_answer_id"]
            referencedRelation: "question_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_first_answer_id_fkey"
            columns: ["first_answer_id"]
            referencedRelation: "question_options"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      v_image_usage_stats: {
        Row: {
          id: string
          url: string
          alt_text: string | null
          description: string | null
          category: string
          file_size_bytes: number | null
          width: number | null
          height: number | null
          created_at: string
          created_by: string | null
          source_ref: string | null
          usage_count: number
          is_orphaned: boolean
          question_ids: string[]
        }
        Relationships: []
      }
      v_storage_stats: {
        Row: {
          total_images: number
          total_size_bytes: number
          microscopic_count: number
          gross_count: number
          figure_count: number
          table_count: number
          microscopic_size_bytes: number
          gross_size_bytes: number
          figure_size_bytes: number
          table_size_bytes: number
          orphaned_count: number
          orphaned_size_bytes: number
        }
        Relationships: []
      }
      v_orphaned_images: {
        Row: {
          id: string
          url: string
          alt_text: string | null
          description: string | null
          category: string
          file_size_bytes: number | null
          storage_path: string | null
          created_at: string
        }
        Relationships: []
      }
      v_image_usage_by_category: {
        Row: {
          category: string
          total_images: number
          used_images: number
          orphaned_images: number
          total_size_bytes: number
          avg_size_bytes: number
          usage_percentage: number
        }
        Relationships: []
      }
      v_dashboard_stats: {
        Row: {
          published_questions: number
          draft_questions: number
          flagged_questions: number
          recent_questions: number
          total_users: number
          recent_users: number
          total_images: number
          total_quiz_sessions: number
          recent_quiz_sessions: number
          total_inquiries: number
          question_reports: number
          pending_reports: number
          last_updated: string
        }
        Relationships: []
      }
      v_user_stats: {
        Row: {
          total_users: number
          active_users: number
          inactive_users: number
          suspended_users: number
          recent_users: number
          internal_users: number
          end_users: number
          active_internal_users: number
          active_end_users: number
          total_admins: number
          total_creators: number
          total_reviewers: number
          active_admins: number
          active_creators: number
          active_reviewers: number
          active_percentage: string
          inactive_percentage: string
          suspended_percentage: string
          internal_percentage: string
          end_users_percentage: string
          last_updated: string
        }
        Relationships: []
      }
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