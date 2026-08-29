-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260608235652
-- Original name: club_join_requests

create table if not exists public.club_join_requests (
  id uuid primary key default uuid_generate_v4(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (club_id, player_id)
);

alter table public.club_join_requests enable row level security;

create policy "club_join_requests_select" on public.club_join_requests
  for select using (
    auth.uid() = player_id
    or exists (
      select 1 from public.club_members m
      where m.club_id = club_join_requests.club_id
        and m.player_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

create policy "club_join_requests_insert" on public.club_join_requests
  for insert with check (auth.uid() = player_id);

create policy "club_join_requests_delete" on public.club_join_requests
  for delete using (auth.uid() = player_id);

create index if not exists club_join_requests_club_idx on public.club_join_requests(club_id);
