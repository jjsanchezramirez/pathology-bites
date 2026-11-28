-- Rollback for 20261128030000_ask_albright_public_history.sql.
-- Drops the table and every saved signed-out question in it.
drop table if exists public.ask_albright_public_history;
