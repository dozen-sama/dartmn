-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260606100751
-- Original name: create_club_messages

create table if not exists public.club_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists club_messages_club_created_idx
  on public.club_messages (club_id, created_at desc);

alter table public.club_messages enable row level security;

-- Зөвхөн клубын гишүүд мессеж унших
create policy "club members read messages" on public.club_messages
  for select using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = club_messages.club_id and cm.player_id = auth.uid()
    )
  );

-- Зөвхөн гишүүд өөрийн нэрээр мессеж бичих
create policy "club members send messages" on public.club_messages
  for insert with check (
    player_id = auth.uid()
    and exists (
      select 1 from public.club_members cm
      where cm.club_id = club_messages.club_id and cm.player_id = auth.uid()
    )
  );

-- Realtime publication-д нэмэх
alter publication supabase_realtime add table public.club_messages;
