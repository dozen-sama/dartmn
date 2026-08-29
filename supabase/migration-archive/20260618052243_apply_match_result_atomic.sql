-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260618052243
-- Original name: apply_match_result_atomic

-- Тоглолтын үр дүнг нэг транзакцид хэрэглэнэ: бүх тоглогчийн профайл шинэчлэл +
-- rating_history + achievements шалгалт. Дунд нь унавал бүгд rollback хийгдэнэ
-- ("хагас sync" гарахгүй). ELO/статистикийг дуудагч (JS) урьдчилан тооцоолж дамжуулна.
create or replace function public.apply_match_result(p_updates jsonb, p_history jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u jsonb;
begin
  -- Тоглогч бүрийн профайл (эцсийн утгууд)
  for u in select value from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) loop
    update public.profiles set
      rating_points    = (u->>'rating_points')::int,
      matches_played   = (u->>'matches_played')::int,
      matches_won      = (u->>'matches_won')::int,
      count_180        = (u->>'count_180')::int,
      highest_checkout = (u->>'highest_checkout')::int,
      average_score    = (u->>'average_score')::numeric,
      career_points    = (u->>'career_points')::int,
      career_darts     = (u->>'career_darts')::int
    where id = (u->>'id')::uuid;
  end loop;

  -- Rating түүх (нэг bulk insert)
  if coalesce(jsonb_array_length(p_history), 0) > 0 then
    insert into public.rating_history
      (player_id, rating_before, rating_after, change, reason, opponent_id, won, room_id)
    select (h->>'player_id')::uuid, (h->>'rating_before')::int, (h->>'rating_after')::int,
           (h->>'change')::int, h->>'reason', nullif(h->>'opponent_id','')::uuid,
           (h->>'won')::boolean, nullif(h->>'room_id','')::uuid
    from jsonb_array_elements(p_history) h;
  end if;

  -- Амжилтын тэмдэг (idempotent) — мөн адил транзакцид
  for u in select value from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) loop
    perform public.check_achievements((u->>'id')::uuid);
  end loop;
end;
$$;
