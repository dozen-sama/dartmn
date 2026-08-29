-- Add "byl" as a valid payment_transactions.provider value.
--
-- Context: src/app/api/payments/byl/route.ts inserts provider: "bonum" (a
-- copy-paste leftover from src/app/api/payments/bonum/route.ts) instead of
-- "byl". Fixing that string alone is not enough because the existing CHECK
-- constraint only allows ('qpay', 'socialpay') — neither "bonum" nor "byl"
-- were ever valid. "bonum" is dead/unreferenced code (no frontend call site,
-- never present in this constraint historically) so it is intentionally
-- NOT added here — only "byl" is, alongside the two providers already live.
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT payment_transactions_provider_check;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_provider_check
  CHECK (provider = ANY (ARRAY['qpay'::text, 'socialpay'::text, 'byl'::text]));
