export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
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
      assays: {
        Row: {
          code: string;
          id: string;
          name: string;
        };
        Insert: {
          code: string;
          id?: string;
          name: string;
        };
        Update: {
          code?: string;
          id?: string;
          name?: string;
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
          word_timings: Json | null;
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
          word_timings?: Json | null;
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
          word_timings?: Json | null;
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
      authorities: {
        Row: {
          classification_id: string | null;
          created_at: string;
          edition_ord: number | null;
          id: string;
          kind: string;
          name: string;
          publisher: string | null;
          slug: string;
          tier: number;
          volume_family: string | null;
          year: number | null;
        };
        Insert: {
          classification_id?: string | null;
          created_at?: string;
          edition_ord?: number | null;
          id?: string;
          kind: string;
          name: string;
          publisher?: string | null;
          slug: string;
          tier: number;
          volume_family?: string | null;
          year?: number | null;
        };
        Update: {
          classification_id?: string | null;
          created_at?: string;
          edition_ord?: number | null;
          id?: string;
          kind?: string;
          name?: string;
          publisher?: string | null;
          slug?: string;
          tier?: number;
          volume_family?: string | null;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "authorities_classification_id_fkey";
            columns: ["classification_id"];
            isOneToOne: false;
            referencedRelation: "classifications";
            referencedColumns: ["id"];
          },
        ];
      };
      axis_authority_ranks: {
        Row: {
          authority_id: string;
          axis: string;
          rank: number;
          rationale: string | null;
        };
        Insert: {
          authority_id: string;
          axis: string;
          rank: number;
          rationale?: string | null;
        };
        Update: {
          authority_id?: string;
          axis?: string;
          rank?: number;
          rationale?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "axis_authority_ranks_authority_id_fkey";
            columns: ["authority_id"];
            isOneToOne: false;
            referencedRelation: "authorities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "axis_authority_ranks_authority_id_fkey";
            columns: ["authority_id"];
            isOneToOne: false;
            referencedRelation: "claim_quotes";
            referencedColumns: ["authority_id"];
          },
          {
            foreignKeyName: "axis_authority_ranks_authority_id_fkey";
            columns: ["authority_id"];
            isOneToOne: false;
            referencedRelation: "entity_axis_verdicts";
            referencedColumns: ["winner_authority_id"];
          },
          {
            foreignKeyName: "axis_authority_ranks_axis_fkey";
            columns: ["axis"];
            isOneToOne: false;
            referencedRelation: "monograph_axes";
            referencedColumns: ["code"];
          },
        ];
      };
      axis_coverage: {
        Row: {
          axis: string;
          computed_at: string;
          document_id: string;
          entity_id: string;
          n_claims: number;
          passage_id: string | null;
          run_id: string | null;
          state: string;
        };
        Insert: {
          axis: string;
          computed_at?: string;
          document_id: string;
          entity_id: string;
          n_claims?: number;
          passage_id?: string | null;
          run_id?: string | null;
          state: string;
        };
        Update: {
          axis?: string;
          computed_at?: string;
          document_id?: string;
          entity_id?: string;
          n_claims?: number;
          passage_id?: string | null;
          run_id?: string | null;
          state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "axis_coverage_axis_fkey";
            columns: ["axis"];
            isOneToOne: false;
            referencedRelation: "monograph_axes";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "axis_coverage_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "claim_quotes";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "axis_coverage_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "axis_coverage_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "axis_coverage_passage_id_fkey";
            columns: ["passage_id"];
            isOneToOne: false;
            referencedRelation: "claim_quotes";
            referencedColumns: ["passage_id"];
          },
          {
            foreignKeyName: "axis_coverage_passage_id_fkey";
            columns: ["passage_id"];
            isOneToOne: false;
            referencedRelation: "passages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "axis_coverage_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "extractor_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      board_prep_config: {
        Row: {
          created_at: string;
          days_off: Json;
          exam_dates: Json;
          id: string;
          phases: Json;
          recurring_off: number[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          days_off?: Json;
          exam_dates?: Json;
          id?: string;
          phases?: Json;
          recurring_off?: number[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          days_off?: Json;
          exam_dates?: Json;
          id?: string;
          phases?: Json;
          recurring_off?: number[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      board_prep_progress: {
        Row: {
          completed_at: string;
          id: string;
          task_key: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string;
          id?: string;
          task_key: string;
          user_id: string;
        };
        Update: {
          completed_at?: string;
          id?: string;
          task_key?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      board_prep_resources: {
        Row: {
          active: boolean;
          color: string;
          created_at: string;
          id: string;
          name: string;
          pace: number;
          resource_id: string;
          short_name: string;
          subjects: Json;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          pace?: number;
          resource_id: string;
          short_name?: string;
          subjects?: Json;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          pace?: number;
          resource_id?: string;
          short_name?: string;
          subjects?: Json;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      board_prep_schedule: {
        Row: {
          activity: string;
          content_label: string;
          content_units: number;
          created_at: string;
          date: string;
          id: string;
          idx: number;
          is_review: boolean;
          minutes: number;
          resource_id: string;
          resource_name: string;
          resource_type: string;
          subject: string;
          subject_id: string;
          task_id: string;
          task_type: string;
          user_id: string;
        };
        Insert: {
          activity?: string;
          content_label?: string;
          content_units?: number;
          created_at?: string;
          date: string;
          id?: string;
          idx?: number;
          is_review?: boolean;
          minutes?: number;
          resource_id: string;
          resource_name: string;
          resource_type: string;
          subject?: string;
          subject_id: string;
          task_id: string;
          task_type?: string;
          user_id: string;
        };
        Update: {
          activity?: string;
          content_label?: string;
          content_units?: number;
          created_at?: string;
          date?: string;
          id?: string;
          idx?: number;
          is_review?: boolean;
          minutes?: number;
          resource_id?: string;
          resource_name?: string;
          resource_type?: string;
          subject?: string;
          subject_id?: string;
          task_id?: string;
          task_type?: string;
          user_id?: string;
        };
        Relationships: [];
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
      claim_rejects: {
        Row: {
          cited_document_id: string | null;
          content_key: string;
          first_seen_at: string;
          id: string;
          legacy_evidence_id: string | null;
          payload: Json;
          predicate: string | null;
          reason: string;
          relocated_document_id: string | null;
          run_id: string | null;
          subject_entity_id: string | null;
          supplied_quote: string | null;
        };
        Insert: {
          cited_document_id?: string | null;
          content_key: string;
          first_seen_at?: string;
          id?: string;
          legacy_evidence_id?: string | null;
          payload?: Json;
          predicate?: string | null;
          reason: string;
          relocated_document_id?: string | null;
          run_id?: string | null;
          subject_entity_id?: string | null;
          supplied_quote?: string | null;
        };
        Update: {
          cited_document_id?: string | null;
          content_key?: string;
          first_seen_at?: string;
          id?: string;
          legacy_evidence_id?: string | null;
          payload?: Json;
          predicate?: string | null;
          reason?: string;
          relocated_document_id?: string | null;
          run_id?: string | null;
          subject_entity_id?: string | null;
          supplied_quote?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "claim_rejects_cited_document_id_fkey";
            columns: ["cited_document_id"];
            isOneToOne: false;
            referencedRelation: "claim_quotes";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "claim_rejects_cited_document_id_fkey";
            columns: ["cited_document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_rejects_legacy_evidence_id_fkey";
            columns: ["legacy_evidence_id"];
            isOneToOne: false;
            referencedRelation: "evidence";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_rejects_legacy_evidence_id_fkey";
            columns: ["legacy_evidence_id"];
            isOneToOne: false;
            referencedRelation: "kg_evidence_live";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_rejects_relocated_document_id_fkey";
            columns: ["relocated_document_id"];
            isOneToOne: false;
            referencedRelation: "claim_quotes";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "claim_rejects_relocated_document_id_fkey";
            columns: ["relocated_document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_rejects_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "extractor_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_rejects_subject_entity_id_fkey";
            columns: ["subject_entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
        ];
      };
      claims: {
        Row: {
          assay_id: string | null;
          axis: string;
          content_key: string;
          created_at: string;
          cue_end: number | null;
          cue_start: number | null;
          denominator_kind: string | null;
          document_id: string;
          id: string;
          mention_end: number | null;
          mention_start: number | null;
          modality: string;
          n_positive: number | null;
          n_supports: number;
          n_total: number | null;
          object_code: string | null;
          object_code_system: string | null;
          object_entity_id: string | null;
          object_key: string;
          object_marker_id: string | null;
          object_site_id: string | null;
          object_source_id: string | null;
          object_text: string | null;
          passage_id: string;
          pattern: string | null;
          polarity: string | null;
          polarity_nuance: string | null;
          predicate: string;
          qty_high: number | null;
          qty_high_si: number | null;
          qty_low: number | null;
          qty_low_si: number | null;
          qty_unit: string | null;
          qty_unit_si: string | null;
          qualifier: Json;
          retracted_at: string | null;
          run_id: string;
          scope_key: string;
          span_end: number;
          span_start: number;
          subject_entity_id: string;
          subject_kind: string;
          support_class: string;
          value_key: string;
        };
        Insert: {
          assay_id?: string | null;
          axis: string;
          content_key: string;
          created_at?: string;
          cue_end?: number | null;
          cue_start?: number | null;
          denominator_kind?: string | null;
          document_id: string;
          id?: string;
          mention_end?: number | null;
          mention_start?: number | null;
          modality?: string;
          n_positive?: number | null;
          n_supports?: number;
          n_total?: number | null;
          object_code?: string | null;
          object_code_system?: string | null;
          object_entity_id?: string | null;
          object_key: string;
          object_marker_id?: string | null;
          object_site_id?: string | null;
          object_source_id?: string | null;
          object_text?: string | null;
          passage_id: string;
          pattern?: string | null;
          polarity?: string | null;
          polarity_nuance?: string | null;
          predicate: string;
          qty_high?: number | null;
          qty_high_si?: number | null;
          qty_low?: number | null;
          qty_low_si?: number | null;
          qty_unit?: string | null;
          qty_unit_si?: string | null;
          qualifier?: Json;
          retracted_at?: string | null;
          run_id: string;
          scope_key: string;
          span_end: number;
          span_start: number;
          subject_entity_id: string;
          subject_kind: string;
          support_class?: string;
          value_key: string;
        };
        Update: {
          assay_id?: string | null;
          axis?: string;
          content_key?: string;
          created_at?: string;
          cue_end?: number | null;
          cue_start?: number | null;
          denominator_kind?: string | null;
          document_id?: string;
          id?: string;
          mention_end?: number | null;
          mention_start?: number | null;
          modality?: string;
          n_positive?: number | null;
          n_supports?: number;
          n_total?: number | null;
          object_code?: string | null;
          object_code_system?: string | null;
          object_entity_id?: string | null;
          object_key?: string;
          object_marker_id?: string | null;
          object_site_id?: string | null;
          object_source_id?: string | null;
          object_text?: string | null;
          passage_id?: string;
          pattern?: string | null;
          polarity?: string | null;
          polarity_nuance?: string | null;
          predicate?: string;
          qty_high?: number | null;
          qty_high_si?: number | null;
          qty_low?: number | null;
          qty_low_si?: number | null;
          qty_unit?: string | null;
          qty_unit_si?: string | null;
          qualifier?: Json;
          retracted_at?: string | null;
          run_id?: string;
          scope_key?: string;
          span_end?: number;
          span_start?: number;
          subject_entity_id?: string;
          subject_kind?: string;
          support_class?: string;
          value_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claims_assay_id_fkey";
            columns: ["assay_id"];
            isOneToOne: false;
            referencedRelation: "assays";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_axis_fkey";
            columns: ["axis"];
            isOneToOne: false;
            referencedRelation: "monograph_axes";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "claims_object_entity_id_fkey";
            columns: ["object_entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_object_marker_id_fkey";
            columns: ["object_marker_id"];
            isOneToOne: false;
            referencedRelation: "markers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_object_site_id_fkey";
            columns: ["object_site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_object_source_id_fkey";
            columns: ["object_source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_passage_id_fkey";
            columns: ["passage_id"];
            isOneToOne: false;
            referencedRelation: "claim_quotes";
            referencedColumns: ["passage_id"];
          },
          {
            foreignKeyName: "claims_passage_id_fkey";
            columns: ["passage_id"];
            isOneToOne: false;
            referencedRelation: "passages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_passage_in_document";
            columns: ["passage_id", "document_id"];
            isOneToOne: false;
            referencedRelation: "passages";
            referencedColumns: ["id", "document_id"];
          },
          {
            foreignKeyName: "claims_predicate_fkey";
            columns: ["predicate"];
            isOneToOne: false;
            referencedRelation: "predicates";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "claims_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "extractor_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_subject_kind_fk";
            columns: ["subject_entity_id", "subject_kind"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id", "kind"];
          },
        ];
      };
      classifications: {
        Row: {
          created_at: string;
          edition: string | null;
          id: string;
          name: string;
          notes: string | null;
          precedence: number;
          publisher: string | null;
          slug: string;
          source_id: string | null;
          year: number | null;
        };
        Insert: {
          created_at?: string;
          edition?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          precedence?: number;
          publisher?: string | null;
          slug: string;
          source_id?: string | null;
          year?: number | null;
        };
        Update: {
          created_at?: string;
          edition?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          precedence?: number;
          publisher?: string | null;
          slug?: string;
          source_id?: string | null;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "classifications_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
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
        ];
      };
      documents: {
        Row: {
          authority_id: string;
          captured_at: string | null;
          content_sha256: string;
          created_at: string;
          entity_id: string | null;
          id: string;
          is_current: boolean;
          raw: Json;
          ref: string;
          source_id: string | null;
          superseded_by: string | null;
          supersedes: string | null;
          title: string | null;
          url: string | null;
        };
        Insert: {
          authority_id: string;
          captured_at?: string | null;
          content_sha256: string;
          created_at?: string;
          entity_id?: string | null;
          id: string;
          is_current?: boolean;
          raw?: Json;
          ref: string;
          source_id?: string | null;
          superseded_by?: string | null;
          supersedes?: string | null;
          title?: string | null;
          url?: string | null;
        };
        Update: {
          authority_id?: string;
          captured_at?: string | null;
          content_sha256?: string;
          created_at?: string;
          entity_id?: string | null;
          id?: string;
          is_current?: boolean;
          raw?: Json;
          ref?: string;
          source_id?: string | null;
          superseded_by?: string | null;
          supersedes?: string | null;
          title?: string | null;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "documents_authority_id_fkey";
            columns: ["authority_id"];
            isOneToOne: false;
            referencedRelation: "authorities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_authority_id_fkey";
            columns: ["authority_id"];
            isOneToOne: false;
            referencedRelation: "claim_quotes";
            referencedColumns: ["authority_id"];
          },
          {
            foreignKeyName: "documents_authority_id_fkey";
            columns: ["authority_id"];
            isOneToOne: false;
            referencedRelation: "entity_axis_verdicts";
            referencedColumns: ["winner_authority_id"];
          },
          {
            foreignKeyName: "documents_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "claim_quotes";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "documents_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_supersedes_fkey";
            columns: ["supersedes"];
            isOneToOne: false;
            referencedRelation: "claim_quotes";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "documents_supersedes_fkey";
            columns: ["supersedes"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      entities: {
        Row: {
          created_at: string;
          definition: string | null;
          icd_o: string | null;
          id: string;
          kind: string;
          name: string;
          sites_curated: boolean;
          slug: string;
          source_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          definition?: string | null;
          icd_o?: string | null;
          id?: string;
          kind?: string;
          name: string;
          sites_curated?: boolean;
          slug: string;
          source_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          definition?: string | null;
          icd_o?: string | null;
          id?: string;
          kind?: string;
          name?: string;
          sites_curated?: boolean;
          slug?: string;
          source_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entities_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      entity_differentials: {
        Row: {
          evidence: string | null;
          from_entity: string;
          id: string;
          source_id: string | null;
          to_entity: string;
        };
        Insert: {
          evidence?: string | null;
          from_entity: string;
          id?: string;
          source_id?: string | null;
          to_entity: string;
        };
        Update: {
          evidence?: string | null;
          from_entity?: string;
          id?: string;
          source_id?: string | null;
          to_entity?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entity_differentials_from_entity_fkey";
            columns: ["from_entity"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_differentials_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_differentials_to_entity_fkey";
            columns: ["to_entity"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
        ];
      };
      entity_merge_redirects: {
        Row: {
          entity_id: string | null;
          from_name: string;
          from_slug: string;
          merged_at: string;
          note: string | null;
        };
        Insert: {
          entity_id?: string | null;
          from_name: string;
          from_slug: string;
          merged_at?: string;
          note?: string | null;
        };
        Update: {
          entity_id?: string | null;
          from_name?: string;
          from_slug?: string;
          merged_at?: string;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "entity_merge_redirects_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
        ];
      };
      entity_placements: {
        Row: {
          chapter_name: string | null;
          classification_id: string | null;
          created_at: string;
          entity_id: string;
          id: string;
          organ_system: string | null;
          parent_id: string | null;
          rank: string;
          source_id: string | null;
          volume: string | null;
        };
        Insert: {
          chapter_name?: string | null;
          classification_id?: string | null;
          created_at?: string;
          entity_id: string;
          id?: string;
          organ_system?: string | null;
          parent_id?: string | null;
          rank: string;
          source_id?: string | null;
          volume?: string | null;
        };
        Update: {
          chapter_name?: string | null;
          classification_id?: string | null;
          created_at?: string;
          entity_id?: string;
          id?: string;
          organ_system?: string | null;
          parent_id?: string | null;
          rank?: string;
          source_id?: string | null;
          volume?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "entity_placements_classification_id_fkey";
            columns: ["classification_id"];
            isOneToOne: false;
            referencedRelation: "classifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_placements_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_placements_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_placements_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      entity_sites: {
        Row: {
          created_at: string;
          entity_id: string;
          id: string;
          note: string | null;
          provenance: string;
          salience: string | null;
          site_id: string;
          source_id: string | null;
        };
        Insert: {
          created_at?: string;
          entity_id: string;
          id?: string;
          note?: string | null;
          provenance?: string;
          salience?: string | null;
          site_id: string;
          source_id?: string | null;
        };
        Update: {
          created_at?: string;
          entity_id?: string;
          id?: string;
          note?: string | null;
          provenance?: string;
          salience?: string | null;
          site_id?: string;
          source_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "entity_sites_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_sites_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_sites_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      entity_synonyms: {
        Row: {
          bidirectional: boolean;
          entity_id: string;
          id: string;
          kind: string;
          source_id: string | null;
          term: string;
          term_normalized: string;
        };
        Insert: {
          bidirectional?: boolean;
          entity_id: string;
          id?: string;
          kind: string;
          source_id?: string | null;
          term: string;
          term_normalized: string;
        };
        Update: {
          bidirectional?: boolean;
          entity_id?: string;
          id?: string;
          kind?: string;
          source_id?: string | null;
          term?: string;
          term_normalized?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entity_synonyms_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_synonyms_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      evidence: {
        Row: {
          assay_id: string | null;
          call: string;
          certainty: string;
          claim_id: string | null;
          created_at: string;
          denominator_kind: string | null;
          entity_id: string;
          extraction: string | null;
          id: string;
          marker_id: string;
          n_positive: number | null;
          n_total: number | null;
          pattern: string | null;
          pct_high: number | null;
          pct_low: number | null;
          quote: string;
          quote_located: string;
          review_status: string;
          source_id: string;
        };
        Insert: {
          assay_id?: string | null;
          call: string;
          certainty?: string;
          claim_id?: string | null;
          created_at?: string;
          denominator_kind?: string | null;
          entity_id: string;
          extraction?: string | null;
          id?: string;
          marker_id: string;
          n_positive?: number | null;
          n_total?: number | null;
          pattern?: string | null;
          pct_high?: number | null;
          pct_low?: number | null;
          quote: string;
          quote_located?: string;
          review_status?: string;
          source_id: string;
        };
        Update: {
          assay_id?: string | null;
          call?: string;
          certainty?: string;
          claim_id?: string | null;
          created_at?: string;
          denominator_kind?: string | null;
          entity_id?: string;
          extraction?: string | null;
          id?: string;
          marker_id?: string;
          n_positive?: number | null;
          n_total?: number | null;
          pattern?: string | null;
          pct_high?: number | null;
          pct_low?: number | null;
          quote?: string;
          quote_located?: string;
          review_status?: string;
          source_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_assay_id_fkey";
            columns: ["assay_id"];
            isOneToOne: false;
            referencedRelation: "assays";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_marker_id_fkey";
            columns: ["marker_id"];
            isOneToOne: false;
            referencedRelation: "markers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      extractor_runs: {
        Row: {
          claims_written: number | null;
          documents_read: number | null;
          extractor: string;
          finished_at: string | null;
          id: string;
          input_filter: string | null;
          model: string | null;
          notes: string | null;
          params: Json;
          slug: string;
          started_at: string;
          status: string;
          version: string;
        };
        Insert: {
          claims_written?: number | null;
          documents_read?: number | null;
          extractor: string;
          finished_at?: string | null;
          id?: string;
          input_filter?: string | null;
          model?: string | null;
          notes?: string | null;
          params?: Json;
          slug: string;
          started_at?: string;
          status?: string;
          version: string;
        };
        Update: {
          claims_written?: number | null;
          documents_read?: number | null;
          extractor?: string;
          finished_at?: string | null;
          id?: string;
          input_filter?: string | null;
          model?: string | null;
          notes?: string | null;
          params?: Json;
          slug?: string;
          started_at?: string;
          status?: string;
          version?: string;
        };
        Relationships: [];
      };
      genes: {
        Row: {
          id: string;
          locus: string | null;
          name: string | null;
          symbol: string;
        };
        Insert: {
          id?: string;
          locus?: string | null;
          name?: string | null;
          symbol: string;
        };
        Update: {
          id?: string;
          locus?: string | null;
          name?: string | null;
          symbol?: string;
        };
        Relationships: [];
      };
      heading_axis_map: {
        Row: {
          axis: string | null;
          heading_norm: string;
          heading_seen: string;
          source_kind: string;
        };
        Insert: {
          axis?: string | null;
          heading_norm: string;
          heading_seen: string;
          source_kind: string;
        };
        Update: {
          axis?: string | null;
          heading_norm?: string;
          heading_seen?: string;
          source_kind?: string;
        };
        Relationships: [
          {
            foreignKeyName: "heading_axis_map_axis_fkey";
            columns: ["axis"];
            isOneToOne: false;
            referencedRelation: "monograph_axes";
            referencedColumns: ["code"];
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
      interactive_sequences: {
        Row: {
          category_id: string | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          id: string;
          published_at: string | null;
          search_vector: unknown;
          sequence_data: Json;
          status: string | null;
          title: string;
          updated_at: string | null;
          version: number | null;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          published_at?: string | null;
          search_vector?: unknown;
          sequence_data: Json;
          status?: string | null;
          title: string;
          updated_at?: string | null;
          version?: number | null;
        };
        Update: {
          category_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          published_at?: string | null;
          search_vector?: unknown;
          sequence_data?: Json;
          status?: string | null;
          title?: string;
          updated_at?: string | null;
          version?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "interactive_sequences_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      kb_refresh_log: {
        Row: {
          n_rows: number | null;
          object: string;
          refreshed_at: string;
        };
        Insert: {
          n_rows?: number | null;
          object: string;
          refreshed_at?: string;
        };
        Update: {
          n_rows?: number | null;
          object?: string;
          refreshed_at?: string;
        };
        Relationships: [];
      };
      kg_curation_log: {
        Row: {
          after_state: Json | null;
          before_state: Json;
          created_at: string;
          id: string;
          op: string;
          summary: string;
          undone_at: string | null;
        };
        Insert: {
          after_state?: Json | null;
          before_state: Json;
          created_at?: string;
          id?: string;
          op: string;
          summary: string;
          undone_at?: string | null;
        };
        Update: {
          after_state?: Json | null;
          before_state?: Json;
          created_at?: string;
          id?: string;
          op?: string;
          summary?: string;
          undone_at?: string | null;
        };
        Relationships: [];
      };
      learning_subjects: {
        Row: {
          category_id: string;
          cover_image_url: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          slug: string;
          sort_order: number;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          category_id: string;
          cover_image_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          slug: string;
          sort_order?: number;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          cover_image_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          slug?: string;
          sort_order?: number;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_subjects_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: {
          anki_deck_ref: string | null;
          content: Json;
          content_markdown: string | null;
          cover_image_url: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          estimated_minutes: number | null;
          id: string;
          quiz: Json | null;
          slug: string;
          sort_order: number;
          status: string;
          subject_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          anki_deck_ref?: string | null;
          content?: Json;
          content_markdown?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          estimated_minutes?: number | null;
          id?: string;
          quiz?: Json | null;
          slug: string;
          sort_order?: number;
          status?: string;
          subject_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          anki_deck_ref?: string | null;
          content?: Json;
          content_markdown?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          estimated_minutes?: number | null;
          id?: string;
          quiz?: Json | null;
          slug?: string;
          sort_order?: number;
          status?: string;
          subject_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lessons_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "learning_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      marker_synonyms: {
        Row: {
          id: string;
          kind: string;
          marker_id: string;
          term: string;
          term_normalized: string;
        };
        Insert: {
          id?: string;
          kind: string;
          marker_id: string;
          term: string;
          term_normalized: string;
        };
        Update: {
          id?: string;
          kind?: string;
          marker_id?: string;
          term?: string;
          term_normalized?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marker_synonyms_marker_id_fkey";
            columns: ["marker_id"];
            isOneToOne: false;
            referencedRelation: "markers";
            referencedColumns: ["id"];
          },
        ];
      };
      markers: {
        Row: {
          compartment: string | null;
          created_at: string;
          cytoband: string | null;
          definition: string | null;
          gene_symbols: string[] | null;
          hgvs: string | null;
          id: string;
          kind: string;
          name: string;
          parent_id: string | null;
          rung: string | null;
          slug: string;
          source_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          compartment?: string | null;
          created_at?: string;
          cytoband?: string | null;
          definition?: string | null;
          gene_symbols?: string[] | null;
          hgvs?: string | null;
          id?: string;
          kind: string;
          name: string;
          parent_id?: string | null;
          rung?: string | null;
          slug: string;
          source_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          compartment?: string | null;
          created_at?: string;
          cytoband?: string | null;
          definition?: string | null;
          gene_symbols?: string[] | null;
          hgvs?: string | null;
          id?: string;
          kind?: string;
          name?: string;
          parent_id?: string | null;
          rung?: string | null;
          slug?: string;
          source_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "markers_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "markers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "markers_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      monograph_axes: {
        Row: {
          code: string;
          holds: string;
          is_prose: boolean;
          label: string;
          notes: string | null;
          ord: number;
        };
        Insert: {
          code: string;
          holds?: string;
          is_prose?: boolean;
          label: string;
          notes?: string | null;
          ord: number;
        };
        Update: {
          code?: string;
          holds?: string;
          is_prose?: boolean;
          label?: string;
          notes?: string | null;
          ord?: number;
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
      passage_citations: {
        Row: {
          cited_document_id: string | null;
          id: string;
          kind: string;
          ordinal: number;
          passage_id: string;
          pos: number;
          ref: string;
          ref_norm: string | null;
        };
        Insert: {
          cited_document_id?: string | null;
          id?: string;
          kind: string;
          ordinal: number;
          passage_id: string;
          pos: number;
          ref: string;
          ref_norm?: string | null;
        };
        Update: {
          cited_document_id?: string | null;
          id?: string;
          kind?: string;
          ordinal?: number;
          passage_id?: string;
          pos?: number;
          ref?: string;
          ref_norm?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "passage_citations_cited_document_id_fkey";
            columns: ["cited_document_id"];
            isOneToOne: false;
            referencedRelation: "claim_quotes";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "passage_citations_cited_document_id_fkey";
            columns: ["cited_document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "passage_citations_passage_id_fkey";
            columns: ["passage_id"];
            isOneToOne: false;
            referencedRelation: "claim_quotes";
            referencedColumns: ["passage_id"];
          },
          {
            foreignKeyName: "passage_citations_passage_id_fkey";
            columns: ["passage_id"];
            isOneToOne: false;
            referencedRelation: "passages";
            referencedColumns: ["id"];
          },
        ];
      };
      passages: {
        Row: {
          axis: string | null;
          block_kind: string;
          block_ordinal: number;
          body: string;
          body_sha256: string | null;
          char_len: number | null;
          created_at: string;
          document_id: string;
          entity_id: string | null;
          has_html_residue: boolean | null;
          has_unresolved_xref: boolean | null;
          id: string;
          nesting_depth: number;
          ordinal: number;
          parent_passage_id: string | null;
          section_ordinal: number;
          section_title_raw: string;
        };
        Insert: {
          axis?: string | null;
          block_kind: string;
          block_ordinal: number;
          body: string;
          body_sha256?: string | null;
          char_len?: number | null;
          created_at?: string;
          document_id: string;
          entity_id?: string | null;
          has_html_residue?: boolean | null;
          has_unresolved_xref?: boolean | null;
          id: string;
          nesting_depth?: number;
          ordinal: number;
          parent_passage_id?: string | null;
          section_ordinal: number;
          section_title_raw: string;
        };
        Update: {
          axis?: string | null;
          block_kind?: string;
          block_ordinal?: number;
          body?: string;
          body_sha256?: string | null;
          char_len?: number | null;
          created_at?: string;
          document_id?: string;
          entity_id?: string | null;
          has_html_residue?: boolean | null;
          has_unresolved_xref?: boolean | null;
          id?: string;
          nesting_depth?: number;
          ordinal?: number;
          parent_passage_id?: string | null;
          section_ordinal?: number;
          section_title_raw?: string;
        };
        Relationships: [
          {
            foreignKeyName: "passages_axis_fkey";
            columns: ["axis"];
            isOneToOne: false;
            referencedRelation: "monograph_axes";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "passages_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "claim_quotes";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "passages_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "passages_entity_agrees";
            columns: ["document_id", "entity_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id", "entity_id"];
          },
          {
            foreignKeyName: "passages_parent_passage_id_fkey";
            columns: ["parent_passage_id"];
            isOneToOne: false;
            referencedRelation: "claim_quotes";
            referencedColumns: ["passage_id"];
          },
          {
            foreignKeyName: "passages_parent_passage_id_fkey";
            columns: ["parent_passage_id"];
            isOneToOne: false;
            referencedRelation: "passages";
            referencedColumns: ["id"];
          },
        ];
      };
      polarity_cues: {
        Row: {
          cue: string;
          implied_modality: string | null;
          notes: string | null;
          polarity: string;
        };
        Insert: {
          cue: string;
          implied_modality?: string | null;
          notes?: string | null;
          polarity: string;
        };
        Update: {
          cue?: string;
          implied_modality?: string | null;
          notes?: string | null;
          polarity?: string;
        };
        Relationships: [];
      };
      predicates: {
        Row: {
          axis: string;
          cardinality: string;
          code: string;
          label: string;
          object_slot: string | null;
          polar: boolean;
          requires_diagnosable_subject: boolean;
          scope_keys: string[];
          unit_dimension: string | null;
          value_kind: string;
        };
        Insert: {
          axis: string;
          cardinality?: string;
          code: string;
          label: string;
          object_slot?: string | null;
          polar?: boolean;
          requires_diagnosable_subject?: boolean;
          scope_keys?: string[];
          unit_dimension?: string | null;
          value_kind: string;
        };
        Update: {
          axis?: string;
          cardinality?: string;
          code?: string;
          label?: string;
          object_slot?: string | null;
          polar?: boolean;
          requires_diagnosable_subject?: boolean;
          scope_keys?: string[];
          unit_dimension?: string | null;
          value_kind?: string;
        };
        Relationships: [
          {
            foreignKeyName: "predicates_axis_fkey";
            columns: ["axis"];
            isOneToOne: false;
            referencedRelation: "monograph_axes";
            referencedColumns: ["code"];
          },
        ];
      };
      question_analytics: {
        Row: {
          avg_time_spent: string | null;
          correct_attempts: number;
          created_at: string | null;
          difficulty_score: number | null;
          flag_count: number;
          id: string;
          last_calculated_at: string | null;
          median_time_spent: string | null;
          question_id: string;
          review_count: number;
          success_rate: number | null;
          total_attempts: number;
          updated_at: string | null;
        };
        Insert: {
          avg_time_spent?: string | null;
          correct_attempts?: number;
          created_at?: string | null;
          difficulty_score?: number | null;
          flag_count?: number;
          id?: string;
          last_calculated_at?: string | null;
          median_time_spent?: string | null;
          question_id: string;
          review_count?: number;
          success_rate?: number | null;
          total_attempts?: number;
          updated_at?: string | null;
        };
        Update: {
          avg_time_spent?: string | null;
          correct_attempts?: number;
          created_at?: string | null;
          difficulty_score?: number | null;
          flag_count?: number;
          id?: string;
          last_calculated_at?: string | null;
          median_time_spent?: string | null;
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
          entity_id: string | null;
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
          entity_id?: string | null;
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
          entity_id?: string | null;
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
            foreignKeyName: "questions_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
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
      r2_storage_metrics: {
        Row: {
          bucket_name: string;
          created_at: string;
          last_synced: string | null;
          last_updated: string;
          object_count: number;
          total_size_bytes: number;
        };
        Insert: {
          bucket_name: string;
          created_at?: string;
          last_synced?: string | null;
          last_updated?: string;
          object_count?: number;
          total_size_bytes?: number;
        };
        Update: {
          bucket_name?: string;
          created_at?: string;
          last_synced?: string | null;
          last_updated?: string;
          object_count?: number;
          total_size_bytes?: number;
        };
        Relationships: [];
      };
      sites: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          parent_id: string | null;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          parent_id?: string | null;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          parent_id?: string | null;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sites_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      sources: {
        Row: {
          authors: string[] | null;
          citation: string;
          created_at: string;
          doi: string | null;
          id: string;
          journal: string | null;
          kind: string;
          pmid: string | null;
          ref: string;
          title: string | null;
          url: string | null;
          work: string | null;
          year: number | null;
        };
        Insert: {
          authors?: string[] | null;
          citation: string;
          created_at?: string;
          doi?: string | null;
          id?: string;
          journal?: string | null;
          kind: string;
          pmid?: string | null;
          ref: string;
          title?: string | null;
          url?: string | null;
          work?: string | null;
          year?: number | null;
        };
        Update: {
          authors?: string[] | null;
          citation?: string;
          created_at?: string;
          doi?: string | null;
          id?: string;
          journal?: string | null;
          kind?: string;
          pmid?: string | null;
          ref?: string;
          title?: string | null;
          url?: string | null;
          work?: string | null;
          year?: number | null;
        };
        Relationships: [];
      };
      surrogates: {
        Row: {
          alteration_id: string;
          direction: string;
          evidence: string | null;
          id: string;
          marker_id: string;
          sensitivity_pct: number | null;
          source_id: string | null;
          specificity_pct: number | null;
        };
        Insert: {
          alteration_id: string;
          direction: string;
          evidence?: string | null;
          id?: string;
          marker_id: string;
          sensitivity_pct?: number | null;
          source_id?: string | null;
          specificity_pct?: number | null;
        };
        Update: {
          alteration_id?: string;
          direction?: string;
          evidence?: string | null;
          id?: string;
          marker_id?: string;
          sensitivity_pct?: number | null;
          source_id?: string | null;
          specificity_pct?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "surrogates_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "markers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "surrogates_marker_id_fkey";
            columns: ["marker_id"];
            isOneToOne: false;
            referencedRelation: "markers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "surrogates_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      svg_assets: {
        Row: {
          category: string | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          file_size_bytes: number;
          height: number | null;
          id: string;
          name: string;
          search_vector: unknown;
          storage_path: string;
          tags: string[] | null;
          updated_at: string | null;
          url: string;
          width: number | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          file_size_bytes: number;
          height?: number | null;
          id?: string;
          name: string;
          search_vector?: unknown;
          storage_path: string;
          tags?: string[] | null;
          updated_at?: string | null;
          url: string;
          width?: number | null;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          file_size_bytes?: number;
          height?: number | null;
          id?: string;
          name?: string;
          search_vector?: unknown;
          storage_path?: string;
          tags?: string[] | null;
          updated_at?: string | null;
          url?: string;
          width?: number | null;
        };
        Relationships: [];
      };
      system_stats: {
        Row: {
          key: string;
          last_updated: string;
          value: number;
        };
        Insert: {
          key: string;
          last_updated?: string;
          value: number;
        };
        Update: {
          key?: string;
          last_updated?: string;
          value?: number;
        };
        Relationships: [];
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
            foreignKeyName: "user_favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_lesson_progress: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          last_accessed_at: string;
          lesson_id: string;
          quiz_score: number | null;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          last_accessed_at?: string;
          lesson_id: string;
          quiz_score?: number | null;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          last_accessed_at?: string;
          lesson_id?: string;
          quiz_score?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_lesson_progress_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
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
      wsi_question_events: {
        Row: {
          answered_at: string | null;
          category: string | null;
          completion_tokens: number | null;
          created_at: string;
          delivered_at: string | null;
          diagnosis: string | null;
          error_detail: string | null;
          generation_time_ms: number | null;
          id: string;
          model: string | null;
          outcome: string;
          prompt_tokens: number | null;
          question_kind: string | null;
          repository: string | null;
          stain_type: string | null;
          subcategory: string | null;
          surface: string;
          user_id: string | null;
          was_correct: boolean | null;
          wsi_id: string | null;
        };
        Insert: {
          answered_at?: string | null;
          category?: string | null;
          completion_tokens?: number | null;
          created_at?: string;
          delivered_at?: string | null;
          diagnosis?: string | null;
          error_detail?: string | null;
          generation_time_ms?: number | null;
          id?: string;
          model?: string | null;
          outcome: string;
          prompt_tokens?: number | null;
          question_kind?: string | null;
          repository?: string | null;
          stain_type?: string | null;
          subcategory?: string | null;
          surface?: string;
          user_id?: string | null;
          was_correct?: boolean | null;
          wsi_id?: string | null;
        };
        Update: {
          answered_at?: string | null;
          category?: string | null;
          completion_tokens?: number | null;
          created_at?: string;
          delivered_at?: string | null;
          diagnosis?: string | null;
          error_detail?: string | null;
          generation_time_ms?: number | null;
          id?: string;
          model?: string | null;
          outcome?: string;
          prompt_tokens?: number | null;
          question_kind?: string | null;
          repository?: string | null;
          stain_type?: string | null;
          subcategory?: string | null;
          surface?: string;
          user_id?: string | null;
          was_correct?: boolean | null;
          wsi_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wsi_question_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      claim_dissent: {
        Row: {
          axis: string | null;
          entity_id: string | null;
          losing_authority: string | null;
          losing_claim_id: string | null;
          losing_code: string | null;
          losing_polarity: string | null;
          losing_qty_low: number | null;
          losing_quote: string | null;
          losing_text: string | null;
          losing_year: number | null;
          object_key: string | null;
          predicate: string | null;
          scope_key: string | null;
          winner_claim_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "claims_axis_fkey";
            columns: ["axis"];
            isOneToOne: false;
            referencedRelation: "monograph_axes";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "claims_predicate_fkey";
            columns: ["predicate"];
            isOneToOne: false;
            referencedRelation: "predicates";
            referencedColumns: ["code"];
          },
        ];
      };
      claim_quotes: {
        Row: {
          assay_id: string | null;
          authority: string | null;
          authority_id: string | null;
          authority_name: string | null;
          axis: string | null;
          claim_id: string | null;
          cue: string | null;
          denominator_kind: string | null;
          document_id: string | null;
          document_ref: string | null;
          edition_ord: number | null;
          eff_rank: number | null;
          is_current: boolean | null;
          modality: string | null;
          n_positive: number | null;
          n_supports: number | null;
          n_total: number | null;
          object_code: string | null;
          object_code_system: string | null;
          object_entity_id: string | null;
          object_key: string | null;
          object_marker_id: string | null;
          object_site_id: string | null;
          object_text: string | null;
          passage_id: string | null;
          passage_ordinal: number | null;
          pattern: string | null;
          polarity: string | null;
          polarity_nuance: string | null;
          predicate: string | null;
          qty_high_si: number | null;
          qty_low_si: number | null;
          qty_unit_si: string | null;
          qualifier: Json | null;
          quote: string | null;
          run_id: string | null;
          said_under_axis: string | null;
          scope_key: string | null;
          subject_entity_id: string | null;
          support_class: string | null;
          tier: number | null;
          value_key: string | null;
          year: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "claims_assay_id_fkey";
            columns: ["assay_id"];
            isOneToOne: false;
            referencedRelation: "assays";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_axis_fkey";
            columns: ["axis"];
            isOneToOne: false;
            referencedRelation: "monograph_axes";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "claims_object_entity_id_fkey";
            columns: ["object_entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_object_marker_id_fkey";
            columns: ["object_marker_id"];
            isOneToOne: false;
            referencedRelation: "markers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_object_site_id_fkey";
            columns: ["object_site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_predicate_fkey";
            columns: ["predicate"];
            isOneToOne: false;
            referencedRelation: "predicates";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "claims_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "extractor_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "passages_axis_fkey";
            columns: ["said_under_axis"];
            isOneToOne: false;
            referencedRelation: "monograph_axes";
            referencedColumns: ["code"];
          },
        ];
      };
      entity_axis_verdicts: {
        Row: {
          agreement: string | null;
          axis: string | null;
          entity_id: string | null;
          modality: string | null;
          n_authorities: number | null;
          n_claims: number | null;
          n_positive: number | null;
          n_total: number | null;
          object_code: string | null;
          object_code_system: string | null;
          object_entity_id: string | null;
          object_key: string | null;
          object_marker_id: string | null;
          object_site_id: string | null;
          object_text: string | null;
          polarity: string | null;
          polarity_nuance: string | null;
          predicate: string | null;
          qty_high_si: number | null;
          qty_low_si: number | null;
          qty_unit_si: string | null;
          scope_key: string | null;
          winner_authority: string | null;
          winner_authority_id: string | null;
          winner_claim_id: string | null;
          winner_quote: string | null;
          winner_value_key: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "claims_axis_fkey";
            columns: ["axis"];
            isOneToOne: false;
            referencedRelation: "monograph_axes";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "claims_object_entity_id_fkey";
            columns: ["object_entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_object_marker_id_fkey";
            columns: ["object_marker_id"];
            isOneToOne: false;
            referencedRelation: "markers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_object_site_id_fkey";
            columns: ["object_site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_predicate_fkey";
            columns: ["predicate"];
            isOneToOne: false;
            referencedRelation: "predicates";
            referencedColumns: ["code"];
          },
        ];
      };
      evidence_compat: {
        Row: {
          assay_id: string | null;
          call: string | null;
          certainty: string | null;
          created_at: string | null;
          denominator_kind: string | null;
          entity_id: string | null;
          extraction: string | null;
          id: string | null;
          marker_id: string | null;
          n_positive: number | null;
          n_total: number | null;
          pattern: string | null;
          pct_high: number | null;
          pct_low: number | null;
          quote: string | null;
          quote_located: string | null;
          review_status: string | null;
          source_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "claims_assay_id_fkey";
            columns: ["assay_id"];
            isOneToOne: false;
            referencedRelation: "assays";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_object_marker_id_fkey";
            columns: ["marker_id"];
            isOneToOne: false;
            referencedRelation: "markers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      kb_extraction_health: {
        Row: {
          claims: number | null;
          count_bearing: number | null;
          distinct_polarities: number | null;
          predicate: string | null;
          run: string | null;
          uncited: number | null;
          unwitnessed: number | null;
          zero_numerator: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "claims_predicate_fkey";
            columns: ["predicate"];
            isOneToOne: false;
            referencedRelation: "predicates";
            referencedColumns: ["code"];
          },
        ];
      };
      kb_modality_audit: {
        Row: {
          claim_id: string | null;
          modality: string | null;
          object_marker_id: string | null;
          quote: string | null;
          subject_entity_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "claims_object_marker_id_fkey";
            columns: ["object_marker_id"];
            isOneToOne: false;
            referencedRelation: "markers";
            referencedColumns: ["id"];
          },
        ];
      };
      kg_evidence_live: {
        Row: {
          assay_id: string | null;
          call: string | null;
          certainty: string | null;
          created_at: string | null;
          denominator_kind: string | null;
          entity_id: string | null;
          extraction: string | null;
          id: string | null;
          marker_id: string | null;
          n_positive: number | null;
          n_total: number | null;
          pattern: string | null;
          pct_high: number | null;
          pct_low: number | null;
          polarity: string | null;
          quote: string | null;
          quote_located: string | null;
          review_status: string | null;
          source_id: string | null;
        };
        Insert: {
          assay_id?: string | null;
          call?: string | null;
          certainty?: string | null;
          created_at?: string | null;
          denominator_kind?: string | null;
          entity_id?: string | null;
          extraction?: string | null;
          id?: string | null;
          marker_id?: string | null;
          n_positive?: number | null;
          n_total?: number | null;
          pattern?: string | null;
          pct_high?: number | null;
          pct_low?: number | null;
          polarity?: never;
          quote?: string | null;
          quote_located?: string | null;
          review_status?: string | null;
          source_id?: string | null;
        };
        Update: {
          assay_id?: string | null;
          call?: string | null;
          certainty?: string | null;
          created_at?: string | null;
          denominator_kind?: string | null;
          entity_id?: string | null;
          extraction?: string | null;
          id?: string | null;
          marker_id?: string | null;
          n_positive?: number | null;
          n_total?: number | null;
          pattern?: string | null;
          pct_high?: number | null;
          pct_low?: number | null;
          polarity?: never;
          quote?: string | null;
          quote_located?: string | null;
          review_status?: string | null;
          source_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_assay_id_fkey";
            columns: ["assay_id"];
            isOneToOne: false;
            referencedRelation: "assays";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_marker_id_fkey";
            columns: ["marker_id"];
            isOneToOne: false;
            referencedRelation: "markers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      kg_pooled: {
        Row: {
          assays: number | null;
          call: string | null;
          definite_conflict: boolean | null;
          entity_id: string | null;
          has_dissent: boolean | null;
          marker_id: string | null;
          pct_high: number | null;
          pct_low: number | null;
          pooled_pct: number | null;
          sources: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_marker_id_fkey";
            columns: ["marker_id"];
            isOneToOne: false;
            referencedRelation: "markers";
            referencedColumns: ["id"];
          },
        ];
      };
      marker_summary: {
        Row: {
          assay_id: string | null;
          call: string | null;
          claim_strength: string | null;
          definite_conflict: boolean | null;
          denominator_kind: string | null;
          entity_id: string | null;
          has_dissent: boolean | null;
          marker_id: string | null;
          n_positive: number | null;
          n_total: number | null;
          pct_high: number | null;
          pct_low: number | null;
          pooled_pct: number | null;
          pooled_sources: number | null;
          quote_verified_sources: number | null;
          sources: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_assay_id_fkey";
            columns: ["assay_id"];
            isOneToOne: false;
            referencedRelation: "assays";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_marker_id_fkey";
            columns: ["marker_id"];
            isOneToOne: false;
            referencedRelation: "markers";
            referencedColumns: ["id"];
          },
        ];
      };
      set_membership_changes: {
        Row: {
          current_authority: string | null;
          dropped_from: string | null;
          entity_id: string | null;
          object_key: string | null;
          object_text: string | null;
          original_quote: string | null;
          predicate: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "claims_predicate_fkey";
            columns: ["predicate"];
            isOneToOne: false;
            referencedRelation: "predicates";
            referencedColumns: ["code"];
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
          published_questions: number | null;
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
        Relationships: [];
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
      wsi_question_daily: {
        Row: {
          answered: number | null;
          attempts: number | null;
          avg_ms: number | null;
          correct: number | null;
          correct_pct: number | null;
          day: string | null;
          delivered: number | null;
          delivered_per_user: number | null;
          failed: number | null;
          failure_pct: number | null;
          generated: number | null;
          never_seen: number | null;
          p95_ms: number | null;
          users: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      claim_run_diff: {
        Args: { p_a: string; p_b: string };
        Returns: {
          entity_id: string;
          object_marker_id: string;
          passage_id: string;
          polarity_a: string;
          polarity_b: string;
          span_start: number;
          verdict: string;
        }[];
      };
      count_active_users_since: {
        Args: { since_date: string };
        Returns: number;
      };
      create_question_version_simplified: {
        Args: {
          change_summary_param: string;
          changed_by_param: string;
          question_id_param: string;
        };
        Returns: string;
      };
      decrement_r2_metrics: {
        Args: { p_bucket_name: string; p_size_bytes: number };
        Returns: undefined;
      };
      get_audio_aggregate_stats: {
        Args: never;
        Returns: {
          total_count: number;
          total_size_bytes: number;
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
      get_most_recent_attempts: {
        Args: { p_question_ids: string[]; p_user_id: string };
        Returns: {
          most_recent_correct: boolean;
          question_id: string;
          second_recent_correct: boolean;
          total_attempts: number;
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
      increment_r2_metrics: {
        Args: { p_bucket_name: string; p_size_bytes: number };
        Returns: undefined;
      };
      is_email_confirmed: { Args: { p_email: string }; Returns: boolean };
      kb_canonical_qty: {
        Args: { hi: number; lo: number; unit: string };
        Returns: Record<string, unknown>;
      };
      kb_effective_rank: {
        Args: { p_authority: string; p_axis: string };
        Returns: number;
      };
      kb_entity_marker_rollup: { Args: { p_slug: string }; Returns: Json };
      kb_marker_entity_rollup: { Args: { p_slug: string }; Returns: Json };
      kb_entity_monograph: { Args: { p_slug: string }; Returns: Json };
      kb_first_sentence: { Args: { cap?: number; t: string }; Returns: string };
      kb_locate_exact: {
        Args: { p_document: string; p_needle: string };
        Returns: {
          passage_id: string;
          span_end: number;
          span_start: number;
        }[];
      };
      kb_norm: { Args: { t: string }; Returns: string };
      kb_refresh_verdicts: { Args: never; Returns: undefined };
      kb_sha: { Args: { t: string }; Returns: string };
      kg_atlas_entity: {
        Args: {
          p_child_cap?: number;
          p_entity: string;
          p_marker_cap?: number;
          p_probe_cap?: number;
          p_sibling_cap?: number;
          p_twin_cap?: number;
        };
        Returns: Json;
      };
      kg_atlas_grid: {
        Args: {
          p_col_cap?: number;
          p_entities?: string[];
          p_keep_empty?: boolean;
          p_min_rows?: number;
          p_root?: string;
          p_volume?: string;
        };
        Returns: Json;
      };
      kg_atlas_index: { Args: never; Returns: Json };
      kg_atlas_marker: {
        Args: {
          p_entity_cap?: number;
          p_marker: string;
          p_sibling_cap?: number;
        };
        Returns: Json;
      };
      kg_atlas_pair: { Args: { p_a: string; p_b: string }; Returns: Json };
      kg_marker_index: {
        Args: never;
        Returns: {
          evidence: number;
          gene_symbols: string[];
          id: string;
          kind: string;
          name: string;
          slug: string;
          status: string;
          synonym_terms: string[];
          synonyms: number;
        }[];
      };
      kg_merge_entity: {
        Args: { p_loser: string; p_winner: string };
        Returns: {
          n: number;
          step: string;
        }[];
      };
      kg_merge_marker: {
        Args: { p_loser: string; p_winner: string };
        Returns: undefined;
      };
      select_quiz_questions: {
        Args: {
          p_category_ids?: string[];
          p_limit?: number;
          p_question_type?: string;
          p_randomize?: boolean;
          p_user_id: string;
        };
        Returns: {
          question_id: string;
        }[];
      };
      update_question_analytics_batch: {
        Args: { question_ids: string[] };
        Returns: undefined;
      };
    };
    Enums: {
      difficulty_level: "easy" | "medium" | "hard";
      image_category: "microscopic" | "gross" | "figure" | "table" | "external";
      question_status:
        | "draft"
        | "pending_review"
        | "flagged"
        | "archived"
        | "rejected"
        | "published";
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
      question_status: ["draft", "pending_review", "flagged", "archived", "rejected", "published"],
      session_status: ["not_started", "in_progress", "completed", "abandoned"],
      user_role: ["admin", "creator", "reviewer", "user"],
      user_status: ["active", "inactive", "suspended", "deleted"],
      user_type: ["student", "resident", "faculty", "other", "fellow", "attending"],
    },
  },
} as const;
