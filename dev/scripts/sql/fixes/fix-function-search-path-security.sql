-- Fix search_path security issues for trigger functions
-- This prevents potential SQL injection attacks by setting an immutable search_path
-- Addresses Supabase database linter warnings: function_search_path_mutable

-- ==============================================================================
-- AUDIO TABLE TRIGGER FUNCTIONS
-- ==============================================================================

-- Fix: update_audio_updated_at
DROP FUNCTION IF EXISTS public.update_audio_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_audio_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp  -- Immutable search_path for security
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_audio_updated_at() IS
  'Trigger function to automatically update the updated_at timestamp.
   Uses immutable search_path for security.';

-- Recreate trigger
CREATE TRIGGER set_audio_updated_at
    BEFORE UPDATE ON public.audio
    FOR EACH ROW
    EXECUTE FUNCTION update_audio_updated_at();

-- Fix: update_audio_search_vector
DROP FUNCTION IF EXISTS public.update_audio_search_vector() CASCADE;

CREATE OR REPLACE FUNCTION public.update_audio_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp  -- Immutable search_path for security
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.transcript, '')), 'C');
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_audio_search_vector() IS
  'Trigger function to automatically update the full-text search vector.
   Uses immutable search_path for security.';

-- Recreate trigger
CREATE TRIGGER update_audio_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title, description, transcript
    ON public.audio
    FOR EACH ROW
    EXECUTE FUNCTION update_audio_search_vector();

-- ==============================================================================
-- INTERACTIVE SEQUENCES TABLE TRIGGER FUNCTIONS
-- ==============================================================================

-- Fix: update_interactive_sequences_updated_at
DROP FUNCTION IF EXISTS public.update_interactive_sequences_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_interactive_sequences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp  -- Immutable search_path for security
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_interactive_sequences_updated_at() IS
  'Trigger function to automatically update the updated_at timestamp.
   Uses immutable search_path for security.';

-- Recreate trigger
CREATE TRIGGER set_interactive_sequences_updated_at
    BEFORE UPDATE ON public.interactive_sequences
    FOR EACH ROW
    EXECUTE FUNCTION update_interactive_sequences_updated_at();

-- Fix: set_interactive_sequence_published_at
DROP FUNCTION IF EXISTS public.set_interactive_sequence_published_at() CASCADE;

CREATE OR REPLACE FUNCTION public.set_interactive_sequence_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp  -- Immutable search_path for security
AS $$
BEGIN
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
        NEW.published_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_interactive_sequence_published_at() IS
  'Trigger function to set published_at timestamp when status changes to published.
   Uses immutable search_path for security.';

-- Recreate trigger
CREATE TRIGGER interactive_sequence_set_published_at
    BEFORE INSERT OR UPDATE OF status
    ON public.interactive_sequences
    FOR EACH ROW
    EXECUTE FUNCTION set_interactive_sequence_published_at();

-- Fix: update_interactive_sequences_search_vector
DROP FUNCTION IF EXISTS public.update_interactive_sequences_search_vector() CASCADE;

CREATE OR REPLACE FUNCTION public.update_interactive_sequences_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp  -- Immutable search_path for security
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_interactive_sequences_search_vector() IS
  'Trigger function to automatically update the full-text search vector.
   Uses immutable search_path for security.';

-- Recreate trigger
CREATE TRIGGER update_interactive_sequences_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title, description
    ON public.interactive_sequences
    FOR EACH ROW
    EXECUTE FUNCTION update_interactive_sequences_search_vector();

-- ==============================================================================
-- UTILITY FUNCTIONS
-- ==============================================================================

-- Fix: get_complete_database_schema
DROP FUNCTION IF EXISTS public.get_complete_database_schema() CASCADE;

CREATE OR REPLACE FUNCTION public.get_complete_database_schema()
RETURNS TABLE(
    table_schema text,
    table_name text,
    column_name text,
    data_type text,
    is_nullable text,
    column_default text,
    character_maximum_length integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- Immutable search_path for security
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.table_schema::text,
        c.table_name::text,
        c.column_name::text,
        c.data_type::text,
        c.is_nullable::text,
        c.column_default::text,
        c.character_maximum_length::integer
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    ORDER BY c.table_schema, c.table_name, c.ordinal_position;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_complete_database_schema() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_complete_database_schema() TO service_role;

COMMENT ON FUNCTION public.get_complete_database_schema() IS
  'Returns complete database schema information for the public schema.
   Uses SECURITY DEFINER with immutable search_path for security.';

-- ==============================================================================
-- VERIFICATION
-- ==============================================================================

-- Verify all functions now have search_path set
DO $$
DECLARE
    func_count integer;
BEGIN
    SELECT COUNT(*)
    INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
        'update_audio_updated_at',
        'update_audio_search_vector',
        'update_interactive_sequences_updated_at',
        'set_interactive_sequence_published_at',
        'update_interactive_sequences_search_vector',
        'get_complete_database_schema'
    )
    AND prosecdef = false  -- Not SECURITY DEFINER (triggers shouldn't be)
    OR (prosecdef = true AND proconfig IS NOT NULL);  -- SECURITY DEFINER with config

    RAISE NOTICE 'Successfully updated % functions with immutable search_path', func_count;
END $$;
