-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260627134757
-- Original name: multistage_tournament_phase1


-- ══════════════════════════════════════════════════════════════════
-- Phase 1: Multi-stage tournament pipeline schema
-- ══════════════════════════════════════════════════════════════════

-- 1. tournament_stages хүснэгт
CREATE TABLE IF NOT EXISTS tournament_stages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  order_no      int  NOT NULL DEFAULT 0,          -- 0-based дараалал
  stage_type    text NOT NULL CHECK (stage_type IN ('group','elimination','round_robin','swiss','rescue')),
  config        jsonb NOT NULL DEFAULT '{}'::jsonb, -- stage-specific settings
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','active','completed')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournament_stages_tournament ON tournament_stages(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_stages_order ON tournament_stages(tournament_id, order_no);

-- 2. tournament_matches-д stage_id нэмэх (nullable — backward compat)
ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES tournament_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_matches_stage ON tournament_matches(stage_id);

-- 3. tournaments-д uses_stages + current_stage_id нэмэх
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS uses_stages      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_stage_id uuid REFERENCES tournament_stages(id) ON DELETE SET NULL;

-- 4. RLS
ALTER TABLE tournament_stages ENABLE ROW LEVEL SECURITY;

-- Хүн бүр харж болно
CREATE POLICY "tournament_stages_select"
  ON tournament_stages FOR SELECT
  USING (true);

-- Зөвхөн зохион байгуулагч өөрчилж болно
CREATE POLICY "tournament_stages_insert"
  ON tournament_stages FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT organizer_id FROM tournaments WHERE id = tournament_id)
  );

CREATE POLICY "tournament_stages_update"
  ON tournament_stages FOR UPDATE
  USING (
    auth.uid() = (SELECT organizer_id FROM tournaments WHERE id = tournament_id)
  );

CREATE POLICY "tournament_stages_delete"
  ON tournament_stages FOR DELETE
  USING (
    auth.uid() = (SELECT organizer_id FROM tournaments WHERE id = tournament_id)
  );

-- 5. start_tournament RPC-д tournament_stages insert эрх нэмэх (SECURITY DEFINER хангалттай)
-- RPC нь postgres role-р ажилладаг тул RLS bypass — нэмэлт тохиргоо шаардлагагүй.
