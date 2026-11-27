-- Before the migration: an anonymous read fails on both tables, even for published rows.
\set ON_ERROR_STOP on
set role anon;
do $$ declare t text; begin
  foreach t in array array['learning_subjects', 'lessons'] loop
    begin
      execute format('select count(*) from public.%I where status = ''published''', t);
      raise exception 'expected 42501: anon read of % should fail before the migration', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
reset role;
