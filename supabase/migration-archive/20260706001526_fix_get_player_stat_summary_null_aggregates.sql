-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260706001526
-- Original name: fix_get_player_stat_summary_null_aggregates

CREATE OR REPLACE FUNCTION public.get_player_stat_summary(p_player_id uuid)
 RETURNS TABLE(matches bigint, legs_for bigint, legs_against bigint, darts_thrown bigint, points_scored bigint, avg3 numeric, avg_first9 numeric, band_60 bigint, band_80 bigint, band_100 bigint, band_120 bigint, band_140 bigint, band_170 bigint, count_180 bigint, high_finish integer, count_100_finishes bigint, best_leg_darts integer, worst_leg_darts integer, checkout_attempts bigint, checkout_makes bigint, keep_attempts bigint, keep_makes bigint, break_attempts bigint, break_makes bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT count(*), COALESCE(sum(legs_for), 0), COALESCE(sum(legs_against), 0), COALESCE(sum(darts_thrown), 0), COALESCE(sum(points_scored), 0),
         CASE WHEN sum(darts_thrown) > 0 THEN sum(points_scored)::numeric / sum(darts_thrown) * 3 ELSE 0 END,
         COALESCE(avg(avg_first9), 0),
         COALESCE(sum(band_60), 0), COALESCE(sum(band_80), 0), COALESCE(sum(band_100), 0), COALESCE(sum(band_120), 0), COALESCE(sum(band_140), 0), COALESCE(sum(band_170), 0), COALESCE(sum(count_180), 0),
         COALESCE(max(high_finish), 0), COALESCE(sum(count_100_finishes), 0),
         min(best_leg_darts), max(worst_leg_darts),
         COALESCE(sum(checkout_attempts), 0), COALESCE(sum(checkout_makes), 0), COALESCE(sum(keep_attempts), 0), COALESCE(sum(keep_makes), 0), COALESCE(sum(break_attempts), 0), COALESCE(sum(break_makes), 0)
  FROM public.match_stat_details WHERE player_id = p_player_id
$function$;
