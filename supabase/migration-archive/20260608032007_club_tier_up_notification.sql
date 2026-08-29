-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260608032007
-- Original name: club_tier_up_notification

-- 1) Шинэ notification төрөл нэмэх
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'tournament_registered','match_completed','achievement_earned','rating_changed',
    'club_joined','system','tournament_starting','club_tier'
  ]));

-- 2) club_score-оор tier index тооцох туслах
create or replace function public.club_tier_idx(score int) returns int language sql immutable as $$
  select case
    when score >= 6000 then 4
    when score >= 3000 then 3
    when score >= 1500 then 2
    when score >=  500 then 1
    else 0 end;
$$;

-- 3) Клубын цол ахихад Удирдагч/Орлогчид мэдэгдэл
create or replace function public.notify_club_tier_up() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  old_idx int := public.club_tier_idx(coalesce(old.club_score, 0));
  new_idx int := public.club_tier_idx(coalesce(new.club_score, 0));
begin
  if new_idx > old_idx then
    insert into public.notifications (user_id, type, title, body, icon, link, data)
    select cm.player_id, 'club_tier',
           'Клубын цол ахилаа! 🎉',
           new.name || ' клуб дээшиллээ — шинэ tag өнгө нээгдлээ. Сонгож гишүүддээ зүүлгээрэй.',
           '🏅',
           '/clubs/' || new.id || '/edit',
           jsonb_build_object('club_id', new.id, 'tier', new_idx)
    from public.club_members cm
    where cm.club_id = new.id and cm.role in ('owner','admin');
  end if;
  return new;
end;$$;

drop trigger if exists club_tier_up_trigger on public.clubs;
create trigger club_tier_up_trigger
  after update of club_score on public.clubs
  for each row execute function public.notify_club_tier_up();
