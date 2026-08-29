-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260628024411
-- Original name: stage_type_rescue_to_semifinal_final


ALTER TABLE tournament_stages
  DROP CONSTRAINT IF EXISTS tournament_stages_stage_type_check;

ALTER TABLE tournament_stages
  ADD CONSTRAINT tournament_stages_stage_type_check
  CHECK (stage_type IN ('group','elimination','round_robin','swiss','semifinal','final'));
