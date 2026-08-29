-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260707033108
-- Original name: add_consumed_at_to_payment_transactions

ALTER TABLE public.payment_transactions ADD COLUMN consumed_at TIMESTAMPTZ;
