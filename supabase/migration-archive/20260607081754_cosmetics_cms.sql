-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260607081754
-- Original name: cosmetics_cms

-- Pass багцууд
create table if not exists public.cosmetic_passes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- Effect-үүд (админаас удирддаг)
create table if not exists public.cosmetic_effects (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid references public.cosmetic_passes(id) on delete set null,
  key text not null unique,
  name text not null,
  lottie_url text not null,
  xp integer not null default 0,
  fit text not null default 'cover',
  scale numeric not null default 1,
  scope text not null default 'profile',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cosmetic_passes enable row level security;
alter table public.cosmetic_effects enable row level security;

-- Нийтэд унших (бичих зөвхөн admin API / service role-оор)
create policy "public read passes" on public.cosmetic_passes for select using (true);
create policy "public read effects" on public.cosmetic_effects for select using (true);

-- Storage bucket (Lottie upload)
insert into storage.buckets (id, name, public)
values ('cosmetics', 'cosmetics', true)
on conflict (id) do nothing;

-- Одоогийн 15 effect-ийг seed (одоо public/lottie-д байгаа)
insert into public.cosmetic_effects (key, name, lottie_url, xp, fit, scope, sort_order) values
  ('campfire','Бамбар','/lottie/campfire.json',300,'contain','profile',1),
  ('fire','Гал','/lottie/fire.json',500,'cover','profile',2),
  ('lightning1','Цахилгаан 1','/lottie/lightning1.json',700,'contain','profile',3),
  ('lightning2','Цахилгаан 2','/lottie/lightning2.json',700,'contain','profile',4),
  ('lightning3','Цахилгаан 3','/lottie/lightning3.json',700,'contain','profile',5),
  ('neon','Неон','/lottie/neon.json',900,'cover','profile',6),
  ('wave','Долгион','/lottie/wave.json',1000,'cover','profile',7),
  ('rainbow','Солонго','/lottie/rainbow.json',1200,'cover','profile',8),
  ('fx14','FX 14','/lottie/fx14.json',1500,'cover','profile',9),
  ('fxa','Эффект A','/lottie/fxa.json',600,'contain','profile',10),
  ('fxb','Эффект B','/lottie/fxb.json',600,'contain','profile',11),
  ('fxc','Эффект C','/lottie/fxc.json',600,'cover','profile',12),
  ('fxd','Эффект D','/lottie/fxd.json',600,'contain','profile',13),
  ('fxe','Эффект E','/lottie/fxe.json',600,'cover','profile',14),
  ('fxf','Эффект F','/lottie/fxf.json',600,'cover','profile',15)
on conflict (key) do nothing;
