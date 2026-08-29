-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260607074115
-- Original name: create_player_unlocks

create table if not exists public.player_unlocks (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  item_kind text not null,
  item_key text not null,
  unlocked_at timestamptz not null default now(),
  unique (player_id, item_kind, item_key)
);

alter table public.player_unlocks enable row level security;

-- Хэрэглэгч зөвхөн өөрийнхөө нээлтийг харна. Insert зөвхөн API (service role)-оор.
create policy "read own unlocks" on public.player_unlocks
  for select using (player_id = auth.uid());

create index if not exists player_unlocks_player_idx on public.player_unlocks (player_id);
