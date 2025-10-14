// src/types/supabase.ts
import { QuestionSetSourceDetails } from '@/features/questions/types/question-sets';

// Define the quiz configuration type
export interface QuizConfig {
  mode: 'tutor' | 'timed' | 'untimed' | 'practice' | 'review';
  questionCount: number;
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
      learning_modules: {
        Row: {
          id: string
          parent_module_id: string | null
          category_id: string
          title: string
          slug: string
          description: string | null
          content: string | null
          learning_objectives: string[] | null
          difficulty_level: Database["public"]["Enums"]["difficulty_level"]
          estimated_duration_minutes: number
          sort_order: number
          content_type: string
          external_content_url: string | null
          quiz_id: string | null
          status: string
          is_featured: boolean
          published_at: string | null
          created_by: string | null
          reviewed_by: string | null
          view_count: number
          average_completion_time_minutes: number | null
          average_rating: number | null
          rating_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          parent_module_id?: string | null
          category_id: string
          title: string
          slug: string
          description?: string | null
          content?: string | null
          learning_objectives?: string[] | null
          difficulty_level?: Database["public"]["Enums"]["difficulty_level"]
          estimated_duration_minutes?: number
          sort_order?: number
          content_type?: string
          external_content_url?: string | null
          quiz_id?: string | null
          status?: string
          is_featured?: boolean
          published_at?: string | null
          created_by?: string | null
          reviewed_by?: string | null
          view_count?: number
          average_completion_time_minutes?: number | null
          average_rating?: number | null
          rating_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          parent_module_id?: string | null
          category_id?: string
          title?: string
          slug?: string
          description?: string | null
          content?: string | null
          learning_objectives?: string[] | null
          difficulty_level?: Database["public"]["Enums"]["difficulty_level"]
          estimated_duration_minutes?: number
          sort_order?: number
          content_type?: string
          external_content_url?: string | null
          quiz_id?: string | null
          status?: string
          is_featured?: boolean
          published_at?: string | null
          created_by?: string | null
          reviewed_by?: string | null
          view_count?: number
          average_completion_time_minutes?: number | null
          average_rating?: number | null
          rating_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_modules_parent_module_id_fkey"
            columns: ["parent_module_id"]
            referencedRelation: "learning_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_modules_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_modules_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_modules_reviewed_by_fkey"
            columns: ["reviewed_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      learning_paths: {
        Row: {
          id: string
          title: string
          slug: string
          description: string | null
          difficulty_level: string | null
          estimated_total_duration_minutes: number | null
          learning_objectives: string[] | null
          prerequisites: string[] | null
          target_audience: string | null
          thumbnail_image_id: string | null
          category_id: string | null
          tags: string[] | null
          status: string
          is_featured: boolean
          published_at: string | null

          average_rating: number | null
          rating_count: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: never
          title: string
          slug: string
          description?: string | null
          difficulty_level?: string | null
          estimated_total_duration_minutes?: number | null
          learning_objectives?: string[] | null
          prerequisites?: string[] | null
          target_audience?: string | null
          thumbnail_image_id?: string | null
          category_id?: string | null
          tags?: string[] | null
          status?: string
          is_featured?: boolean
          published_at?: string | null

          average_rating?: number | null
          rating_count?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: never
          title?: string
          slug?: string
          description?: string | null
          difficulty_level?: string | null
          estimated_total_duration_minutes?: number | null
          learning_objectives?: string[] | null
          prerequisites?: string[] | null
          target_audience?: string | null
          thumbnail_image_id?: string | null
          category_id?: string | null
          tags?: string[] | null
          status?: string
          is_featured?: boolean
          published_at?: string | null

          average_rating?: number | null
          rating_count?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_paths_thumbnail_image_id_fkey"
            columns: ["thumbnail_image_id"]
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_paths_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_paths_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      learning_path_modules: {
        Row: {
          id: string
          learning_path_id: string
          module_id: string
          sort_order: number
          is_required: boolean
          unlock_criteria: any | null
          custom_description: string | null
          estimated_duration_override: number | null
          created_at: string
        }
        Insert: {
          id?: string
          learning_path_id: string
          module_id: string
          sort_order: number
          is_required?: boolean
          unlock_criteria?: any | null
          custom_description?: string | null
          estimated_duration_override?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          learning_path_id?: string
          module_id?: string
          sort_order?: number
          is_required?: boolean
          unlock_criteria?: any | null
          custom_description?: string | null
          estimated_duration_override?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_modules_learning_path_id_fkey"
            columns: ["learning_path_id"]
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_modules_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "learning_modules"
            referencedColumns: ["id"]
          }
        ]
      }
      user_learning: {
        Row: {
          id: string
          user_id: string
          learning_path_id: string
          status: string
          enrolled_at: string
          started_at: string | null
          completed_at: string | null
          last_accessed_at: string | null
          current_module_id: string | null
          modules_completed: number
          total_modules: number | null
          progress_percentage: number
          total_time_minutes: number
          average_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          learning_path_id: string
          status?: string
          enrolled_at?: string
          started_at?: string | null
          completed_at?: string | null
          last_accessed_at?: string | null
          current_module_id?: string | null
          modules_completed?: number
          total_modules?: number | null
          progress_percentage?: number
          total_time_minutes?: number
          average_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          learning_path_id?: string
          status?: string
          enrolled_at?: string
          started_at?: string | null
          completed_at?: string | null
          last_accessed_at?: string | null
          current_module_id?: string | null
          modules_completed?: number
          total_modules?: number | null
          progress_percentage?: number
          total_time_minutes?: number
          average_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_learning_path_enrollments_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_learning_path_enrollments_learning_path_id_fkey"
            columns: ["learning_path_id"]
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_learning_path_enrollments_current_module_id_fkey"
            columns: ["current_module_id"]
            referencedRelation: "learning_modules"
            referencedColumns: ["id"]
          }
        ]
      }
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
          short_form: string | null
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
          short_form?: string | null
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
          short_form?: string | null
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
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          color?: string | null
          created_at?: string
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
          category: Database["public"]["Enums"]["image_category"]
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
          category: Database["public"]["Enums"]["image_category"]
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
          category?: Database["public"]["Enums"]["image_category"]
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
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          request_type: string
          first_name: string
          last_name: string
          organization?: string | null
          email: string
          inquiry: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          request_type?: string
          first_name?: string
          last_name?: string
          organization?: string | null
          email?: string
          inquiry?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          id: string
          title: string
          stem: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          teaching_point: string
          question_references: string | null
          status: Database["public"]["Enums"]["question_status"]
          created_by: string
          updated_by: string
          version: string
          question_set_id: string | null
          category_id: string | null
          reviewer_id: string | null
          reviewer_feedback: string | null
          rejected_at: string | null
          rejected_by: string | null
          published_at: string | null
          resubmission_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          stem: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          teaching_point: string
          question_references?: string | null
          status?: Database["public"]["Enums"]["question_status"]
          created_by: string
          updated_by: string
          version?: string
          question_set_id?: string | null
          category_id?: string | null
          reviewer_id?: string | null
          reviewer_feedback?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          published_at?: string | null
          resubmission_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          stem?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          teaching_point?: string
          question_references?: string | null
          status?: Database["public"]["Enums"]["question_status"]
          created_by?: string
          updated_by?: string
          version?: string
          question_set_id?: string | null
          category_id?: string | null
          reviewer_id?: string | null
          reviewer_feedback?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          published_at?: string | null
          resubmission_notes?: string | null
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
            referencedRelation: "question_sets"
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
          short_form: string | null
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
          short_form?: string | null
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
          short_form?: string | null
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
          role: Database["public"]["Enums"]["user_role"]
          user_type: Database["public"]["Enums"]["user_type"]
          status: Database["public"]["Enums"]["user_status"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          first_name?: string | null
          middle_initial?: string | null
          last_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_type?: Database["public"]["Enums"]["user_type"]
          status?: Database["public"]["Enums"]["user_status"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          first_name?: string | null
          middle_initial?: string | null
          last_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_type?: Database["public"]["Enums"]["user_type"]
          status?: Database["public"]["Enums"]["user_status"]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
          report_type: Database["public"]["Enums"]["report_type"]
          description: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          question_id: string
          reported_by: string
          report_type: Database["public"]["Enums"]["report_type"]
          description?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          question_id?: string
          reported_by?: string
          report_type?: Database["public"]["Enums"]["report_type"]
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
          question_ids: string[]
          current_question_index: number
          status: Database["public"]["Enums"]["session_status"]
          started_at: string | null
          completed_at: string | null
          total_time_spent: number | null
          score: number | null
          correct_answers: number | null
          total_questions: number
          total_time_limit: number | null
          time_remaining: number | null

          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          config: QuizConfig
          question_ids: string[]
          current_question_index?: number
          status?: Database["public"]["Enums"]["session_status"]
          started_at?: string | null
          completed_at?: string | null
          total_time_spent?: number | null
          score?: number | null
          correct_answers?: number | null
          total_questions: number
          total_time_limit?: number | null
          time_remaining?: number | null

          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          config?: QuizConfig
          question_ids?: string[]
          current_question_index?: number
          status?: Database["public"]["Enums"]["session_status"]
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
      module_attempts: {
        Row: {
          id: string
          user_id: string | null
          module_id: string | null
          learning_path_id: string | null
          attempt_number: number
          started_at: string | null
          completed_at: string | null
          time_spent_minutes: number | null
          completion_status: string
          assessment_score: number | null
          quiz_attempt_id: string | null
          self_rating: number | null
          confidence_level: number | null
          feedback: string | null
          found_helpful: boolean | null
          prerequisite_check_passed: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          module_id?: string | null
          learning_path_id?: string | null
          attempt_number?: number
          started_at?: string | null
          completed_at?: string | null
          time_spent_minutes?: number | null
          completion_status?: string
          assessment_score?: number | null
          quiz_attempt_id?: string | null
          self_rating?: number | null
          confidence_level?: number | null
          feedback?: string | null
          found_helpful?: boolean | null
          prerequisite_check_passed?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          module_id?: string | null
          learning_path_id?: string | null
          attempt_number?: number
          started_at?: string | null
          completed_at?: string | null
          time_spent_minutes?: number | null
          completion_status?: string
          assessment_score?: number | null
          quiz_attempt_id?: string | null
          self_rating?: number | null
          confidence_level?: number | null
          feedback?: string | null
          found_helpful?: boolean | null
          prerequisite_check_passed?: boolean | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_attempts_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_attempts_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "learning_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_attempts_learning_path_id_fkey"
            columns: ["learning_path_id"]
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          }
        ]
      }
      module_images: {
        Row: {
          id: string
          module_id: string | null
          image_id: string | null
          usage_type: string
          sort_order: number | null
          caption: string | null
          alt_text: string | null
          content_section: string | null
          created_at: string
        }
        Insert: {
          id?: string
          module_id?: string | null
          image_id?: string | null
          usage_type: string
          sort_order?: number | null
          caption?: string | null
          alt_text?: string | null
          content_section?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          module_id?: string | null
          image_id?: string | null
          usage_type?: string
          sort_order?: number | null
          caption?: string | null
          alt_text?: string | null
          content_section?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_images_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "learning_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_images_image_id_fkey"
            columns: ["image_id"]
            referencedRelation: "images"
            referencedColumns: ["id"]
          }
        ]
      }
      module_prerequisites: {
        Row: {
          id: string
          module_id: string | null
          prerequisite_module_id: string | null
          requirement_type: string
          created_at: string
        }
        Insert: {
          id?: string
          module_id?: string | null
          prerequisite_module_id?: string | null
          requirement_type?: string
          created_at?: string
        }
        Update: {
          id?: string
          module_id?: string | null
          prerequisite_module_id?: string | null
          requirement_type?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_prerequisites_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "learning_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_prerequisites_prerequisite_module_id_fkey"
            columns: ["prerequisite_module_id"]
            referencedRelation: "learning_modules"
            referencedColumns: ["id"]
          }
        ]
      }
      module_sessions: {
        Row: {
          id: string
          user_id: string | null
          module_id: string | null
          learning_path_id: string | null
          started_at: string | null
          ended_at: string | null
          duration_minutes: number | null
          sections_viewed: string[] | null
          completion_percentage: number | null
          accessed_via: string | null

          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          module_id?: string | null
          learning_path_id?: string | null
          started_at?: string | null
          ended_at?: string | null
          duration_minutes?: number | null
          sections_viewed?: string[] | null
          completion_percentage?: number | null
          accessed_via?: string | null

          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          module_id?: string | null
          learning_path_id?: string | null
          started_at?: string | null
          ended_at?: string | null
          duration_minutes?: number | null
          sections_viewed?: string[] | null
          completion_percentage?: number | null
          accessed_via?: string | null

          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_sessions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_sessions_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "learning_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_sessions_learning_path_id_fkey"
            columns: ["learning_path_id"]
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          }
        ]
      }
      performance_analytics: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          total_questions: number
          questions_answered: number
          correct_answers: number
          average_time: number
          peer_rank: number | null
          last_attempt_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id?: string | null
          total_questions?: number
          questions_answered?: number
          correct_answers?: number
          average_time?: number
          peer_rank?: number | null
          last_attempt_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string | null
          total_questions?: number
          questions_answered?: number
          correct_answers?: number
          average_time?: number
          peer_rank?: number | null
          last_attempt_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_analytics_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_analytics_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      user_achievements: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          description: string | null
          created_at: string
          group_key: string
          quiz_id: string | null
          subject_id: string | null
          data: Json | null
          is_read: boolean | null
          priority: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          description?: string | null
          created_at?: string
          group_key: string
          quiz_id?: string | null
          subject_id?: string | null
          data?: Json | null
          is_read?: boolean | null
          priority?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          description?: string | null
          created_at?: string
          group_key?: string
          quiz_id?: string | null
          subject_id?: string | null
          data?: Json | null
          is_read?: boolean | null
          priority?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_favorites: {
        Row: {
          id: string
          user_id: string
          question_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          question_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          question_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_question_id_fkey"
            columns: ["question_id"]
            referencedRelation: "questions"
            referencedColumns: ["id"]
          }
        ]
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          quiz_settings: Json | null
          notification_settings: Json | null
          ui_settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          quiz_settings?: Json | null
          notification_settings?: Json | null
          ui_settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          quiz_settings?: Json | null
          notification_settings?: Json | null
          ui_settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
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
          category: Database["public"]["Enums"]["image_category"]
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
      v_creator_questions: {
        Row: {
          creator_id: string
          creator_name: string
          total_questions: number
          published_questions: number
          draft_questions: number
          pending_review_questions: number
          flagged_questions: number
          average_rating: number | null
          last_created: string | null
        }
        Relationships: []
      }
      v_flagged_questions: {
        Row: {
          question_id: string
          question_title: string
          flag_count: number
          latest_flag_date: string
          flag_types: string[]
          question_status: string
          created_by: string
          creator_name: string
        }
        Relationships: []
      }
      v_learning_modules_detailed: {
        Row: {
          id: string
          title: string
          slug: string
          description: string | null
          difficulty_level: string
          estimated_duration_minutes: number
          content_type: string
          status: string
          is_featured: boolean
          view_count: number
          average_rating: number | null
          rating_count: number
          category_name: string | null
          creator_name: string | null
          image_count: number
          prerequisite_count: number
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
      v_learning_paths_detailed: {
        Row: {
          id: string
          title: string
          slug: string
          description: string | null
          difficulty_level: string | null
          estimated_total_duration_minutes: number | null
          status: string
          is_featured: boolean

          average_rating: number | null
          rating_count: number
          category_name: string | null
          creator_name: string | null
          module_count: number
          completion_rate: number | null
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
      v_module_analytics: {
        Row: {
          module_id: string
          module_title: string
          total_attempts: number
          completed_attempts: number
          average_completion_time: number | null
          completion_rate: number | null
          average_score: number | null
          average_rating: number | null
          view_count: number
          last_accessed: string | null
        }
        Relationships: []
      }
      v_simplified_review_queue: {
        Row: {
          question_id: string
          title: string
          status: string
          created_by: string
          creator_name: string
          created_at: string
          updated_at: string
          flag_count: number
          review_count: number
          priority_score: number
        }
        Relationships: []
      }
      v_user_progress_summary: {
        Row: {
          user_id: string
          user_name: string
          total_quiz_sessions: number
          completed_quiz_sessions: number
          total_questions_answered: number
          correct_answers: number
          accuracy_percentage: number | null
          average_time_per_question: number | null
          favorite_categories: string[]
          last_activity: string | null
          streak_days: number | null
        }
        Relationships: []
      }
      mv_user_performance_analytics: {
        Row: {
          user_id: string
          full_name: string
          status: string
          role: string
          total_sessions: number
          completed_sessions: number
          avg_score: number | null
          total_attempts: number
          correct_attempts: number
          last_quiz_at: string | null
          success_rate: number
          peer_rank: number
          percentile: number
          last_calculated_at: string
        }
        Relationships: []
      }
      mv_user_category_stats: {
        Row: {
          user_id: string
          category_id: string
          total_attempts: number
          correct_attempts: number
          incorrect_attempts: number
          last_attempt_at: string
          unique_questions_attempted: number
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      image_category: "microscopic" | "gross" | "figure" | "table" | "external"
      user_role: "admin" | "creator" | "reviewer" | "user"
      user_status: "active" | "inactive" | "suspended"
      user_type: "student" | "resident" | "faculty" | "other"
      question_status: "draft" | "pending_review" | "rejected" | "published" | "flagged" | "archived"
      difficulty_level: "easy" | "medium" | "hard"
      session_status: "not_started" | "in_progress" | "completed" | "abandoned"
      report_type: "incorrect_answer" | "unclear_explanation" | "broken_image" | "inappropriate_content" | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}