-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260609081213
-- Original name: synced_local_sessions

create table if not exists public.synced_local_sessions (
  session_id uuid primary key,
  synced_at timestamptz not null default now()
);

alter table public.synced_local_sessions enable row level security;
-- policy байхгүй → зөвхөн service role (admin client) хандана
