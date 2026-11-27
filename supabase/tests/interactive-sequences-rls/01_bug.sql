-- Before the migration: an anonymous read fails even for published rows.
\set ON_ERROR_STOP on
set role anon;
do $$ begin
  perform count(*) from public.interactive_sequences where status = 'published';
  raise exception 'expected 42501: anon read should fail before the migration';
exception when insufficient_privilege then null;
end $$;
reset role;
