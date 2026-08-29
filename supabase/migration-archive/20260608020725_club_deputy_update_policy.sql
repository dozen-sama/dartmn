-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260608020725
-- Original name: club_deputy_update_policy

-- Орлогч (admin) клубын тохиргоо засаж болно (устгахаас бусад)
create policy "Club deputies can update" on public.clubs
  for update
  using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = clubs.id and cm.player_id = auth.uid() and cm.role = 'admin'
    )
  );
