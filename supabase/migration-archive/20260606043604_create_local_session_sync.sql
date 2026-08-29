-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260606043604
-- Original name: create_local_session_sync


CREATE TABLE IF NOT EXISTS public.local_session_sync (
  session_id text PRIMARY KEY,
  data jsonb NOT NULL,
  password_hash text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Realtime идэвхжүүлэх
ALTER TABLE public.local_session_sync REPLICA IDENTITY FULL;

-- RLS: хэн ч уншиж болно, анон ч бичиж болно (local game)
ALTER TABLE public.local_session_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read live sessions"
  ON public.local_session_sync FOR SELECT USING (true);

CREATE POLICY "anyone can upsert live sessions"
  ON public.local_session_sync FOR INSERT WITH CHECK (true);

CREATE POLICY "anyone can update live sessions"
  ON public.local_session_sync FOR UPDATE USING (true);
