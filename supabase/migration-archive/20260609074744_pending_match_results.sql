-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260609074744
-- Original name: pending_match_results

create table if not exists public.pending_match_results (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.profiles(id) on delete cascade,
  winner_id uuid not null references public.profiles(id) on delete cascade,
  format text,
  payload jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.pending_match_results enable row level security;

-- Оролцогчид (мэдээлэгч + өрсөлдөгч) л харна
create policy "pmr_select" on public.pending_match_results
  for select using (auth.uid() = reporter_id or auth.uid() = opponent_id);

create index if not exists pmr_opponent_idx on public.pending_match_results(opponent_id, status);
