-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260619124452
-- Original name: seed_knockout_rpc

-- Бүлгийн шат дууссаны дараа KO round-1-ийн талуудыг (TS-д cross-seed хийсэн)
-- атомикоор суулгана. Зөвхөн хоосон (seed-лээгүй), pending KO match-д бичнэ —
-- давхар seed-лэхээс хамгаална. p_assignments: [{match_id, side1, side2}].
CREATE OR REPLACE FUNCTION public.seed_knockout(p_tournament_id uuid, p_assignments jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.tournament_matches tm SET
    side1_entrant_id = NULLIF(a->>'side1','')::uuid,
    side2_entrant_id = NULLIF(a->>'side2','')::uuid
  FROM jsonb_array_elements(p_assignments) a
  WHERE tm.id = (a->>'match_id')::uuid
    AND tm.tournament_id = p_tournament_id
    AND tm.group_no IS NULL
    AND tm.status = 'pending'
    AND tm.side1_entrant_id IS NULL
    AND tm.side2_entrant_id IS NULL;
END; $function$
