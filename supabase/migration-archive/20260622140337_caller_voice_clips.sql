-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260622140337
-- Original name: caller_voice_clips

-- Дуут caller-ийн хүний дуу бичлэгүүд. key = тоо ("1".."180") эсвэл фраз
-- ("p_taniy_onoo","p_aas","p_maximum","p_checkout","p_bust"). Файл нь
-- caller-voice bucket-д <key>.<ext>. Бичих зөвхөн service role (admin API).
create table if not exists public.caller_clips (
  key text primary key,
  ext text not null default 'webm',
  updated_at timestamptz not null default now()
);

alter table public.caller_clips enable row level security;

drop policy if exists "caller_clips public read" on public.caller_clips;
create policy "caller_clips public read" on public.caller_clips
  for select using (true);

-- Public bucket — нийтэд унших боломжтой, бичих нь service role-оор
insert into storage.buckets (id, name, public)
values ('caller-voice', 'caller-voice', true)
on conflict (id) do nothing;
