export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      achievements: {
        Row: {
          animation_type: string;
          category: string;
          created_at: string | null;
          description: string;
          id: string;
          requirement: number;
          title: string;
        };
        Insert: {
          animation_type: string;
          category: string;
          created_at?: string | null;
          description: string;
          id: string;
          requirement: number;
          title: string;
        };
        Update: {
          animation_type?: string;
          category?: string;
          created_at?: string | null;
          description?: string;
          id?: string;
          requirement?: number;
          title?: string;
        };
        Relationships: [];
      };
      audio: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          duration_seconds: number | null;
          file_size_bytes: number;
          file_type: string;
          generated_text: string | null;
          id: string;
          pathology_category_id: string | null;
          search_vector: unknown;
          storage_path: string;
          title: string;
          updated_at: string | null;
          url: string;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          duration_seconds?: number | null;
          file_size_bytes: number;
          file_type: string;
          generated_text?: string | null;
          id?: string;
          pathology_category_id?: string | null;
          search_vector?: unknown;
          storage_path: string;
          title: string;
          updated_at?: string | null;
          url: string;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          duration_seconds?: number | null;
          file_size_bytes?: number;
          file_type?: string;
          generated_text?: string | null;
          id?: string;
          pathology_category_id?: string | null;
          search_vector?: unknown;
          storage_path?: string;
          title?: string;
          updated_at?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audio_pathology_category_id_fkey";
            columns: ["pathology_category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          color: string | null;
          created_at: string | null;
          id: string;
          level: number;
          name: string;
          parent_id: string | null;
          short_form: string | null;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          id?: string;
          level?: number;
          name: string;
          parent_id?: string | null;
          short_form?: string | null;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          id?: string;
          level?: number;
          name?: string;
          parent_id?: string | null;
          short_form?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      demo_questions: {
        Row: {
          display_order: number | null;
          id: string;
          is_active: boolean | null;
          question_id: string;
        };
        Insert: {
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          question_id: string;
        };
        Update: {
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          question_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "demo_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "demo_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "v_flagged_questions";
            referencedColumns: ["question_id"];
          },
        ];
      };
      images: {
        Row: {
          alt_text: string | null;
          category: Database["public"]["Enums"]["image_category"] | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          file_size_bytes: number | null;
          file_type: string | null;
          height: number | null;
          id: string;
          magnification: string | null;
          pathology_category_id: string | null;
          search_vector: unknown;
          source_ref: string | null;
          storage_path: string | null;
          url: string;
          width: number | null;
        };
        Insert: {
          alt_text?: string | null;
          category?: Database["public"]["Enums"]["image_category"] | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          file_size_bytes?: number | null;
          file_type?: string | null;
          height?: number | null;
          id?: string;
          magnification?: string | null;
          pathology_category_id?: string | null;
          search_vector?: unknown;
          source_ref?: string | null;
          storage_path?: string | null;
          url: string;
          width?: number | null;
        };
        Update: {
          alt_text?: string | null;
          category?: Database["public"]["Enums"]["image_category"] | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          file_size_bytes?: number | null;
          file_type?: string | null;
          height?: number | null;
          id?: string;
          magnification?: string | null;
          pathology_category_id?: string | null;
          search_vector?: unknown;
          source_ref?: string | null;
          storage_path?: string | null;
          url?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "images_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "images_pathology_category_id_fkey";
            columns: ["pathology_category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      inquiries: {
        Row: {
          created_at: string | null;
          email: string;
          first_name: string;
          id: string;
          inquiry: string;
          last_name: string;
          organization: string | null;
          request_type: string;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          first_name: string;
          id?: string;
          inquiry: string;
          last_name: string;
          organization?: string | null;
          request_type: string;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          first_name?: string;
          id?: string;
          inquiry?: string;
          last_name?: string;
          organization?: string | null;
          request_type?: string;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      notification_states: {
        Row: {
          created_at: string | null;
          id: string;
          read: boolean;
          source_id: string;
          source_type: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          read?: boolean;
          source_id: string;
          source_type: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          read?: boolean;
          source_id?: string;
          source_type?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_states_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      performance_analytics: {
        Row: {
          average_time: number;
          category_id: string | null;
          correct_answers: number;
          created_at: string | null;
          id: string;
          last_attempt_at: string | null;
          peer_rank: number | null;
          questions_answered: number;
          total_questions: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          average_time?: number;
          category_id?: string | null;
          correct_answers?: number;
          created_at?: string | null;
          id?: string;
          last_attempt_at?: string | null;
          peer_rank?: number | null;
          questions_answered?: number;
          total_questions?: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          average_time?: number;
          category_id?: string | null;
          correct_answers?: number;
          created_at?: string | null;
          id?: string;
          last_attempt_at?: string | null;
          peer_rank?: number | null;
          questions_answered?: number;
          total_questions?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "performance_analytics_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_analytics_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      question_analytics: {
        Row: {
          avg_time_spent: unknown;
          correct_attempts: number;
          created_at: string | null;
          difficulty_score: number | null;
          flag_count: number;
          id: string;
          last_calculated_at: string | null;
          median_time_spent: unknown;
          question_id: string;
          review_count: number;
          success_rate: number | null;
          total_attempts: number;
          updated_at: string | null;
        };
        Insert: {
          avg_time_spent?: unknown;
          correct_attempts?: number;
          created_at?: string | null;
          difficulty_score?: number | null;
          flag_count?: number;
          id?: string;
          last_calculated_at?: string | null;
          median_time_spent?: unknown;
          question_id: string;
          review_count?: number;
          success_rate?: number | null;
          total_attempts?: number;
          updated_at?: string | null;
        };
        Update: {
          avg_time_spent?: unknown;
          correct_attempts?: number;
          created_at?: string | null;
          difficulty_score?: number | null;
          flag_count?: number;
          id?: string;
          last_calculated_at?: string | null;
          median_time_spent?: unknown;
          question_id?: string;
          review_count?: number;
          success_rate?: number | null;
          total_attempts?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "question_analytics_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_analytics_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "v_flagged_questions";
            referencedColumns: ["question_id"];
          },
        ];
      };
      question_flags: {
        Row: {
          created_at: string | null;
          description: string | null;
          flag_type: string;
          flagged_by: string;
          id: string;
          question_id: string;
          resolution_notes: string | null;
          resolution_type: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          flag_type: string;
          flagged_by: string;
          id?: string;
          question_id: string;
          resolution_notes?: string | null;
          resolution_type?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          flag_type?: string;
          flagged_by?: string;
          id?: string;
          question_id?: string;
          resolution_notes?: string | null;
          resolution_type?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "question_flags_flagged_by_fkey";
            columns: ["flagged_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_flags_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_flags_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_flagged_questions";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "question_flags_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      question_images: {
        Row: {
          image_id: string;
          order_index: number;
          question_id: string;
          question_section: string;
        };
        Insert: {
          image_id: string;
          order_index?: number;
          question_id: string;
          question_section: string;
        };
        Update: {
          image_id?: string;
          order_index?: number;
          question_id?: string;
          question_section?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_images_image_id_fkey";
            columns: ["image_id"];
            isOneToOne: false;
            referencedRelation: "images";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_images_image_id_fkey";
            columns: ["image_id"];
            isOneToOne: false;
            referencedRelation: "v_image_usage_stats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_images_image_id_fkey";
            columns: ["image_id"];
            isOneToOne: false;
            referencedRelation: "v_orphaned_images";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_images_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_images_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_flagged_questions";
            referencedColumns: ["question_id"];
          },
        ];
      };
      question_options: {
        Row: {
          created_at: string | null;
          explanation: string | null;
          id: string;
          is_correct: boolean;
          order_index: number;
          question_id: string;
          text: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          explanation?: string | null;
          id?: string;
          is_correct?: boolean;
          order_index?: number;
          question_id: string;
          text: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          explanation?: string | null;
          id?: string;
          is_correct?: boolean;
          order_index?: number;
          question_id?: string;
          text?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_options_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_flagged_questions";
            referencedColumns: ["question_id"];
          },
        ];
      };
      question_reports: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          question_id: string;
          report_type: Database["public"]["Enums"]["report_type"];
          reported_by: string;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          question_id: string;
          report_type: Database["public"]["Enums"]["report_type"];
          reported_by: string;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          question_id?: string;
          report_type?: Database["public"]["Enums"]["report_type"];
          reported_by?: string;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "question_reports_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_reports_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_flagged_questions";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "question_reports_reported_by_fkey";
            columns: ["reported_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      question_reviews: {
        Row: {
          action: string;
          changes_made: Json | null;
          created_at: string | null;
          feedback: string | null;
          id: string;
          question_id: string;
          reviewer_id: string;
        };
        Insert: {
          action: string;
          changes_made?: Json | null;
          created_at?: string | null;
          feedback?: string | null;
          id?: string;
          question_id: string;
          reviewer_id: string;
        };
        Update: {
          action?: string;
          changes_made?: Json | null;
          created_at?: string | null;
          feedback?: string | null;
          id?: string;
          question_id?: string;
          reviewer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_reviews_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_reviews_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_flagged_questions";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "question_reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      question_sets: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          short_form: string | null;
          source_details: Json | null;
          source_type: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          short_form?: string | null;
          source_details?: Json | null;
          source_type: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          short_form?: string | null;
          source_details?: Json | null;
          source_type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      question_tags: {
        Row: {
          question_id: string;
          tag_id: string;
        };
        Insert: {
          question_id: string;
          tag_id: string;
        };
        Update: {
          question_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_tags_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_tags_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_flagged_questions";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "question_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      question_versions: {
        Row: {
          change_summary: string | null;
          changed_by: string;
          created_at: string | null;
          id: string;
          question_data: Json;
          question_id: string;
          update_type: string | null;
          version_major: number | null;
          version_minor: number | null;
          version_patch: number | null;
        };
        Insert: {
          change_summary?: string | null;
          changed_by: string;
          created_at?: string | null;
          id?: string;
          question_data: Json;
          question_id: string;
          update_type?: string | null;
          version_major?: number | null;
          version_minor?: number | null;
          version_patch?: number | null;
        };
        Update: {
          change_summary?: string | null;
          changed_by?: string;
          created_at?: string | null;
          id?: string;
          question_data?: Json;
          question_id?: string;
          update_type?: string | null;
          version_major?: number | null;
          version_minor?: number | null;
          version_patch?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "question_versions_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_versions_new_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_versions_new_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_flagged_questions";
            referencedColumns: ["question_id"];
          },
        ];
      };
      questions: {
        Row: {
          anki_card_id: string | null;
          anki_deck_name: string | null;
          category_id: string | null;
          created_at: string | null;
          created_by: string;
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null;
          id: string;
          lesson: string | null;
          published_at: string | null;
          question_references: string | null;
          question_set_id: string | null;
          reviewer_feedback: string | null;
          reviewer_id: string | null;
          status: Database["public"]["Enums"]["question_status"] | null;
          stem: string;
          teaching_point: string;
          title: string;
          topic: string | null;
          updated_at: string | null;
          updated_by: string;
          version_major: number | null;
          version_minor: number | null;
          version_patch: number | null;
        };
        Insert: {
          anki_card_id?: string | null;
          anki_deck_name?: string | null;
          category_id?: string | null;
          created_at?: string | null;
          created_by: string;
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null;
          id?: string;
          lesson?: string | null;
          published_at?: string | null;
          question_references?: string | null;
          question_set_id?: string | null;
          reviewer_feedback?: string | null;
          reviewer_id?: string | null;
          status?: Database["public"]["Enums"]["question_status"] | null;
          stem: string;
          teaching_point: string;
          title: string;
          topic?: string | null;
          updated_at?: string | null;
          updated_by: string;
          version_major?: number | null;
          version_minor?: number | null;
          version_patch?: number | null;
        };
        Update: {
          anki_card_id?: string | null;
          anki_deck_name?: string | null;
          category_id?: string | null;
          created_at?: string | null;
          created_by?: string;
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null;
          id?: string;
          lesson?: string | null;
          published_at?: string | null;
          question_references?: string | null;
          question_set_id?: string | null;
          reviewer_feedback?: string | null;
          reviewer_id?: string | null;
          status?: Database["public"]["Enums"]["question_status"] | null;
          stem?: string;
          teaching_point?: string;
          title?: string;
          topic?: string | null;
          updated_at?: string | null;
          updated_by?: string;
          version_major?: number | null;
          version_minor?: number | null;
          version_patch?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "questions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_set_id_fkey";
            columns: ["question_set_id"];
            isOneToOne: false;
            referencedRelation: "question_sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_attempts: {
        Row: {
          attempted_at: string;
          category_id: string | null;
          created_at: string | null;
          first_answer_id: string | null;
          id: string;
          is_correct: boolean | null;
          question_id: string | null;
          quiz_session_id: string;
          reviewed_at: string | null;
          selected_answer_id: string | null;
          time_spent: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          attempted_at?: string;
          category_id?: string | null;
          created_at?: string | null;
          first_answer_id?: string | null;
          id?: string;
          is_correct?: boolean | null;
          question_id?: string | null;
          quiz_session_id: string;
          reviewed_at?: string | null;
          selected_answer_id?: string | null;
          time_spent?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          attempted_at?: string;
          category_id?: string | null;
          created_at?: string | null;
          first_answer_id?: string | null;
          id?: string;
          is_correct?: boolean | null;
          question_id?: string | null;
          quiz_session_id?: string;
          reviewed_at?: string | null;
          selected_answer_id?: string | null;
          time_spent?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_first_answer_id_fkey";
            columns: ["first_answer_id"];
            isOneToOne: false;
            referencedRelation: "question_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_flagged_questions";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "quiz_attempts_quiz_session_id_fkey";
            columns: ["quiz_session_id"];
            isOneToOne: false;
            referencedRelation: "quiz_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_selected_answer_id_fkey";
            columns: ["selected_answer_id"];
            isOneToOne: false;
            referencedRelation: "question_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_sessions: {
        Row: {
          completed_at: string | null;
          config: Json;
          correct_answers: number | null;
          created_at: string | null;
          current_question_index: number;
          id: string;
          question_ids: string[];
          score: number | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["session_status"] | null;
          time_remaining: number | null;
          title: string;
          total_questions: number;
          total_time_limit: number | null;
          total_time_spent: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          config: Json;
          correct_answers?: number | null;
          created_at?: string | null;
          current_question_index?: number;
          id?: string;
          question_ids: string[];
          score?: number | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["session_status"] | null;
          time_remaining?: number | null;
          title: string;
          total_questions: number;
          total_time_limit?: number | null;
          total_time_spent?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          config?: Json;
          correct_answers?: number | null;
          created_at?: string | null;
          current_question_index?: number;
          id?: string;
          question_ids?: string[];
          score?: number | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["session_status"] | null;
          time_remaining?: number | null;
          title?: string;
          total_questions?: number;
          total_time_limit?: number | null;
          total_time_spent?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      system_updates: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          message: string;
          published_at: string;
          severity: string;
          target_audience: string;
          title: string;
          update_type: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          message: string;
          published_at?: string;
          severity?: string;
          target_audience?: string;
          title: string;
          update_type: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          message?: string;
          published_at?: string;
          severity?: string;
          target_audience?: string;
          title?: string;
          update_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "system_updates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      user_achievements: {
        Row: {
          achievement_id: string;
          created_at: string | null;
          id: string;
          user_id: string;
        };
        Insert: {
          achievement_id: string;
          created_at?: string | null;
          id?: string;
          user_id: string;
        };
        Update: {
          achievement_id?: string;
          created_at?: string | null;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey";
            columns: ["achievement_id"];
            isOneToOne: false;
            referencedRelation: "achievements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_favorites: {
        Row: {
          created_at: string | null;
          id: string;
          question_id: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          question_id?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          question_id?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_favorites_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_favorites_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "v_flagged_questions";
            referencedColumns: ["question_id"];
          },
          {
            foreignKeyName: "user_favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_settings: {
        Row: {
          counter_settings: Json | null;
          created_at: string | null;
          id: string;
          notification_settings: Json | null;
          quiz_settings: Json | null;
          ui_settings: Json | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          counter_settings?: Json | null;
          created_at?: string | null;
          id?: string;
          notification_settings?: Json | null;
          quiz_settings?: Json | null;
          ui_settings?: Json | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          counter_settings?: Json | null;
          created_at?: string | null;
          id?: string;
          notification_settings?: Json | null;
          quiz_settings?: Json | null;
          ui_settings?: Json | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          email: string;
          first_name: string | null;
          id: string;
          institution: string | null;
          last_name: string | null;
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["user_status"];
          updated_at: string | null;
          user_type: Database["public"]["Enums"]["user_type"];
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          email: string;
          first_name?: string | null;
          id?: string;
          institution?: string | null;
          last_name?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["user_status"];
          updated_at?: string | null;
          user_type: Database["public"]["Enums"]["user_type"];
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          email?: string;
          first_name?: string | null;
          id?: string;
          institution?: string | null;
          last_name?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["user_status"];
          updated_at?: string | null;
          user_type?: Database["public"]["Enums"]["user_type"];
        };
        Relationships: [];
      };
      videos: {
        Row: {
          category_id: string | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          duration_seconds: number | null;
          file_size_bytes: number | null;
          height: number | null;
          id: string;
          published_at: string | null;
          sequence_storage_path: string | null;
          sequence_url: string | null;
          status: string | null;
          thumbnail_storage_path: string | null;
          thumbnail_url: string | null;
          title: string;
          updated_at: string | null;
          video_storage_path: string;
          video_url: string;
          width: number | null;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          duration_seconds?: number | null;
          file_size_bytes?: number | null;
          height?: number | null;
          id?: string;
          published_at?: string | null;
          sequence_storage_path?: string | null;
          sequence_url?: string | null;
          status?: string | null;
          thumbnail_storage_path?: string | null;
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string | null;
          video_storage_path: string;
          video_url: string;
          width?: number | null;
        };
        Update: {
          category_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          duration_seconds?: number | null;
          file_size_bytes?: number | null;
          height?: number | null;
          id?: string;
          published_at?: string | null;
          sequence_storage_path?: string | null;
          sequence_url?: string | null;
          status?: string | null;
          thumbnail_storage_path?: string | null;
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string | null;
          video_storage_path?: string;
          video_url?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "videos_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      waitlist: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          type: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          type?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          type?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      mv_user_category_stats: {
        Row: {
          category_id: string | null;
          correct_attempts: number | null;
          incorrect_attempts: number | null;
          last_attempt_at: string | null;
          total_attempts: number | null;
          unique_questions_attempted: number | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      v_dashboard_stats: {
        Row: {
          active_users: number | null;
          draft_questions: number | null;
          flagged_questions: number | null;
          last_updated: string | null;
          pending_questions: number | null;
          pending_reports: number | null;
          published_questions: number | null;
          question_reports: number | null;
          recent_questions: number | null;
          recent_quiz_sessions: number | null;
          recent_users: number | null;
          rejected_questions: number | null;
          total_images: number | null;
          total_inquiries: number | null;
          total_questions: number | null;
          total_quiz_sessions: number | null;
          total_users: number | null;
          unread_inquiries: number | null;
        };
        Relationships: [];
      };
      v_flagged_questions: {
        Row: {
          created_by: string | null;
          creator_name: string | null;
          flag_count: number | null;
          flag_types: string[] | null;
          latest_flag_date: string | null;
          question_id: string | null;
          question_status: Database["public"]["Enums"]["question_status"] | null;
          question_title: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "questions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      v_image_usage_stats: {
        Row: {
          alt_text: string | null;
          category: Database["public"]["Enums"]["image_category"] | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          file_size_bytes: number | null;
          height: number | null;
          id: string | null;
          is_orphaned: boolean | null;
          question_ids: string[] | null;
          url: string | null;
          usage_count: number | null;
          width: number | null;
        };
        Insert: {
          alt_text?: string | null;
          category?: Database["public"]["Enums"]["image_category"] | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          file_size_bytes?: number | null;
          height?: number | null;
          id?: string | null;
          is_orphaned?: never;
          question_ids?: never;
          url?: string | null;
          usage_count?: never;
          width?: number | null;
        };
        Update: {
          alt_text?: string | null;
          category?: Database["public"]["Enums"]["image_category"] | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          file_size_bytes?: number | null;
          height?: number | null;
          id?: string | null;
          is_orphaned?: never;
          question_ids?: never;
          url?: string | null;
          usage_count?: never;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "images_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      v_orphaned_images: {
        Row: {
          alt_text: string | null;
          category: Database["public"]["Enums"]["image_category"] | null;
          created_at: string | null;
          description: string | null;
          file_size_bytes: number | null;
          id: string | null;
          storage_path: string | null;
          url: string | null;
        };
        Insert: {
          alt_text?: string | null;
          category?: Database["public"]["Enums"]["image_category"] | null;
          created_at?: string | null;
          description?: string | null;
          file_size_bytes?: number | null;
          id?: string | null;
          storage_path?: string | null;
          url?: string | null;
        };
        Update: {
          alt_text?: string | null;
          category?: Database["public"]["Enums"]["image_category"] | null;
          created_at?: string | null;
          description?: string | null;
          file_size_bytes?: number | null;
          id?: string | null;
          storage_path?: string | null;
          url?: string | null;
        };
        Relationships: [];
      };
      v_public_stats: {
        Row: {
          last_refreshed: string | null;
          total_categories: number | null;
          total_images: number | null;
          total_questions: number | null;
        };
        Relationships: [];
      };
      v_storage_stats: {
        Row: {
          figure_count: number | null;
          figure_size_bytes: number | null;
          gross_count: number | null;
          gross_size_bytes: number | null;
          microscopic_count: number | null;
          microscopic_size_bytes: number | null;
          orphaned_count: number | null;
          orphaned_size_bytes: number | null;
          table_count: number | null;
          table_size_bytes: number | null;
          total_images: number | null;
          total_size_bytes: number | null;
        };
        Relationships: [];
      };
      v_storage_stats_secure: {
        Row: {
          figure_count: number | null;
          figure_size_bytes: number | null;
          gross_count: number | null;
          gross_size_bytes: number | null;
          microscopic_count: number | null;
          microscopic_size_bytes: number | null;
          orphaned_count: number | null;
          orphaned_size_bytes: number | null;
          table_count: number | null;
          table_size_bytes: number | null;
          total_images: number | null;
          total_size_bytes: number | null;
        };
        Relationships: [];
      };
      v_audio_stats_secure: {
        Row: {
          total_audio: number | null;
          total_size_bytes: number | null;
          avg_duration_seconds: number | null;
          min_duration_seconds: number | null;
          max_duration_seconds: number | null;
          total_duration_seconds: number | null;
          uncategorized_count: number | null;
          categorized_count: number | null;
          unique_file_types: number | null;
          generated_count: number | null;
          uploaded_count: number | null;
          files_under_1mb: number | null;
          files_1mb_to_10mb: number | null;
          files_over_10mb: number | null;
          used_in_lessons: number | null;
          orphaned_count: number | null;
        };
        Relationships: [];
      };
      v_user_category_stats: {
        Row: {
          category_id: string | null;
          correct_attempts: number | null;
          incorrect_attempts: number | null;
          last_attempt_at: string | null;
          total_attempts: number | null;
          unique_questions_attempted: number | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      v_user_stats: {
        Row: {
          active_admins: number | null;
          active_creators: number | null;
          active_end_users: number | null;
          active_internal_users: number | null;
          active_percentage: string | null;
          active_reviewers: number | null;
          active_users: number | null;
          end_users: number | null;
          end_users_percentage: string | null;
          inactive_percentage: string | null;
          inactive_users: number | null;
          internal_percentage: string | null;
          internal_users: number | null;
          last_updated: string | null;
          recent_users: number | null;
          suspended_percentage: string | null;
          suspended_users: number | null;
          total_admins: number | null;
          total_creators: number | null;
          total_reviewers: number | null;
          total_users: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      analyze_user_login_activity: {
        Args: never;
        Returns: {
          avg_session_duration: unknown;
          first_login: string;
          last_login: string;
          total_logins: number;
          user_id: string;
        }[];
      };
      backfill_orphaned_users: {
        Args: never;
        Returns: {
          settings_created: number;
          users_created: number;
        }[];
      };
      calculate_question_analytics:
        | { Args: never; Returns: undefined }
        | { Args: { question_id_param?: string }; Returns: undefined };
      create_question_version_simplified: {
        Args: {
          change_summary_param: string;
          changed_by_param: string;
          question_id_param: string;
        };
        Returns: string;
      };
      get_all_user_scores: {
        Args: never;
        Returns: {
          score: number;
          user_id: string;
        }[];
      };
      get_categories_with_parents: {
        Args: { category_ids: string[] };
        Returns: {
          color: string;
          id: string;
          name: string;
          parent_id: string;
          parent_short_form: string;
          short_form: string;
        }[];
      };
      get_complete_quiz_dashboard:
        | { Args: never; Returns: Json }
        | {
            Args: { p_recent_sessions_limit?: number; p_user_id: string };
            Returns: {
              cache_version: string;
              categories: Json;
              question_type_stats: Json;
              recent_sessions: Json;
              user_activity: Json;
              user_stats: Json;
            }[];
          };
      get_database_size_analysis: { Args: never; Returns: Json };
      get_most_recent_attempts: {
        Args: { p_question_ids: string[]; p_user_id: string };
        Returns: {
          most_recent_correct: boolean;
          question_id: string;
          second_recent_correct: boolean;
          total_attempts: number;
        }[];
      };
      get_public_stats: {
        Args: never;
        Returns: {
          last_refreshed: string;
          total_categories: number;
          total_images: number;
          total_questions: number;
        }[];
      };
      get_question_snapshot_data: {
        Args: { question_id_param: string };
        Returns: Json;
      };
      get_question_success_rates: {
        Args: { question_ids: string[] };
        Returns: {
          correct_attempts: number;
          question_id: string;
          success_rate: number;
          total_attempts: number;
        }[];
      };
      get_user_activity_heatmap: {
        Args: { days_back?: number; p_user_id: string };
        Returns: {
          date: string;
          questions: number;
          quizzes: number;
        }[];
      };
      get_user_category_stats: {
        Args: { p_category_ids: string[]; p_user_id: string };
        Returns: {
          all_count: number;
          category_id: string;
          correct_count: number;
          incorrect_count: number;
          marked_count: number;
          unused_count: number;
        }[];
      };
      get_user_data_analysis: { Args: never; Returns: Json };
      get_user_percentile: {
        Args: { p_avg_score: number; p_user_id: string };
        Returns: {
          percentile: number;
          rank: number;
          total_users: number;
        }[];
      };
      get_user_performance_data: {
        Args: { target_user_id: string };
        Returns: {
          avg_score: number;
          data_source: string;
          full_name: string;
          peer_rank: number;
          percentile: number;
          success_rate: number;
          total_sessions: number;
          user_id: string;
        }[];
      };
      get_user_question_stats_optimized:
        | {
            Args: { p_category_ids: string[]; p_user_id: string };
            Returns: {
              category_id: string;
              marked: number;
              mastered: number;
              needs_review: number;
              total_questions: number;
              unused: number;
            }[];
          }
        | {
            Args: { user_uuid: string };
            Returns: {
              avg_time_per_question: number;
              correct_attempts: number;
              success_rate: number;
              total_attempts: number;
              unique_questions: number;
            }[];
          };
      get_user_statistics: {
        Args: never;
        Returns: {
          active_admins: number;
          active_creators: number;
          active_end_users: number;
          active_internal_users: number;
          active_percentage: string;
          active_reviewers: number;
          active_users: number;
          end_users: number;
          end_users_percentage: string;
          inactive_percentage: string;
          inactive_users: number;
          internal_percentage: string;
          internal_users: number;
          last_updated: string;
          recent_users: number;
          suspended_percentage: string;
          suspended_users: number;
          total_admins: number;
          total_creators: number;
          total_reviewers: number;
          total_users: number;
        }[];
      };
      get_user_stats: {
        Args: never;
        Returns: {
          active_admins: number;
          active_creators: number;
          active_end_users: number;
          active_internal_users: number;
          active_percentage: string;
          active_reviewers: number;
          active_users: number;
          end_users: number;
          end_users_percentage: string;
          inactive_percentage: string;
          inactive_users: number;
          internal_percentage: string;
          internal_users: number;
          last_updated: string;
          recent_users: number;
          suspended_percentage: string;
          suspended_users: number;
          total_admins: number;
          total_creators: number;
          total_reviewers: number;
          total_users: number;
        }[];
      };
      is_current_user_admin: { Args: never; Returns: boolean };
      recalculate_all_question_analytics: { Args: never; Returns: undefined };
      refresh_materialized_views: { Args: never; Returns: undefined };
      refresh_public_stats: { Args: never; Returns: undefined };
      refresh_user_category_stats: {
        Args: { p_user_id?: string };
        Returns: undefined;
      };
      refresh_user_performance_analytics: {
        Args: never;
        Returns: {
          last_refresh: string;
          refresh_duration: unknown;
          rows_updated: number;
        }[];
      };
      update_question_analytics_batch: {
        Args: { question_ids: string[] };
        Returns: undefined;
      };
      update_question_version: {
        Args: {
          change_summary_param?: string;
          question_data_param?: Json;
          question_id_param: string;
          update_type_param: string;
        };
        Returns: string;
      };
    };
    Enums: {
      difficulty_level: "easy" | "medium" | "hard";
      image_category: "microscopic" | "gross" | "figure" | "table" | "external";
      question_status:
        | "draft"
        | "pending_review"
        | "approved"
        | "flagged"
        | "archived"
        | "rejected"
        | "published";
      report_type:
        | "incorrect_answer"
        | "unclear_explanation"
        | "broken_image"
        | "inappropriate_content"
        | "other";
      session_status: "not_started" | "in_progress" | "completed" | "abandoned";
      user_role: "admin" | "creator" | "reviewer" | "user";
      user_status: "active" | "inactive" | "suspended" | "deleted";
      user_type: "student" | "resident" | "faculty" | "other" | "fellow" | "attending";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      difficulty_level: ["easy", "medium", "hard"],
      image_category: ["microscopic", "gross", "figure", "table", "external"],
      question_status: [
        "draft",
        "pending_review",
        "approved",
        "flagged",
        "archived",
        "rejected",
        "published",
      ],
      report_type: [
        "incorrect_answer",
        "unclear_explanation",
        "broken_image",
        "inappropriate_content",
        "other",
      ],
      session_status: ["not_started", "in_progress", "completed", "abandoned"],
      user_role: ["admin", "creator", "reviewer", "user"],
      user_status: ["active", "inactive", "suspended", "deleted"],
      user_type: ["student", "resident", "faculty", "other", "fellow", "attending"],
    },
  },
} as const;
