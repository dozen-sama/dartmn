-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260606101006
-- Original name: club_messages_subscription_gate

drop policy if exists "club members read messages" on public.club_messages;
drop policy if exists "club members send messages" on public.club_messages;

-- Зөвхөн ТӨЛБӨРТЭЙ клубын гишүүд мессеж унших
create policy "club members read messages" on public.club_messages
  for select using (
    exists (
      select 1 from public.club_members cm
      join public.clubs c on c.id = cm.club_id
      where cm.club_id = club_messages.club_id
        and cm.player_id = auth.uid()
        and c.subscription_plan is not null
    )
  );

-- Зөвхөн ТӨЛБӨРТЭЙ клубын гишүүд өөрийн нэрээр мессеж бичих
create policy "club members send messages" on public.club_messages
  for insert with check (
    player_id = auth.uid()
    and exists (
      select 1 from public.club_members cm
      join public.clubs c on c.id = cm.club_id
      where cm.club_id = club_messages.club_id
        and cm.player_id = auth.uid()
        and c.subscription_plan is not null
    )
  );
