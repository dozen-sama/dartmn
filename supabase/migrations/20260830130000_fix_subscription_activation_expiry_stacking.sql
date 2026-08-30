-- Fix: activate_subscription_from_payment discarded remaining paid time on
-- renewal (Phase D follow-up).
--
-- Context: the original function (20260829120200) always set
-- expires_at := now() + interval '1 month', unconditionally overwriting
-- whatever was already in player_subscriptions.expires_at. Renewing early
-- (or a second payment landing before the first month elapsed) would
-- silently discard the remaining paid time instead of stacking it. This was
-- pre-existing behavior carried over unchanged from the pre-refactor
-- /api/subscriptions/activate route (same now()+1month formula), not a
-- regression introduced by the webhook-authoritative migration — but it is
-- a real defect and is fixed here before any further live payment testing.
--
-- New rule: new_expires_at = GREATEST(now(), existing_expires_at) + 1 month.
-- No existing row / expired subscription -> now()+1 month (GREATEST picks
-- now()). Still-active subscription -> stacks the new month on top of the
-- remaining time (GREATEST picks the existing future expiry).
--
-- Race-safety for TWO DIFFERENT valid payments for the same player racing
-- concurrently (not just duplicate delivery of the SAME payment, already
-- handled by the payment_transactions consumed_at claim): a naive
-- SELECT expires_at then UPDATE would let both readers see the same
-- "before" value and one extension would clobber the other. Instead this
-- uses a single INSERT ... ON CONFLICT (player_id) DO UPDATE statement,
-- referencing the target row's own (about-to-be-locked) expires_at in the
-- SET clause. Postgres serializes concurrent upserts that conflict on the
-- same unique key: the second racer blocks until the first's transaction
-- commits, then evaluates its SET expression against the now-committed row
-- — so two concurrent extensions correctly stack rather than racing. This
-- is the documented, standard atomic upsert-with-read-of-current-value
-- pattern; no explicit SELECT ... FOR UPDATE / manual locking is needed or
-- introduced.
CREATE OR REPLACE FUNCTION public.activate_subscription_from_payment(p_transaction_id uuid, p_player_id uuid)
 RETURNS TABLE(result text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_amount integer;
  v_new_expires timestamptz;
  v_txn RECORD;
BEGIN
  -- Atomic claim: only a transaction that is paid, owned by this player, for
  -- the Premium purpose, and not yet consumed can be claimed (unchanged from
  -- 20260829120200 — this is what makes duplicate/10-way-concurrent delivery
  -- of the SAME payment activate exactly once).
  UPDATE public.payment_transactions
  SET consumed_at = now()
  WHERE id = p_transaction_id
    AND player_id = p_player_id
    AND status = 'paid'
    AND (metadata->>'purpose') = 'subscription_premium'
    AND consumed_at IS NULL
  RETURNING amount INTO v_amount;

  IF FOUND THEN
    INSERT INTO public.player_subscriptions AS ps (player_id, status, expires_at, amount, payment_id)
    VALUES (p_player_id, 'active', now() + interval '1 month', v_amount, p_transaction_id)
    ON CONFLICT (player_id) DO UPDATE
      SET status = 'active',
          expires_at = GREATEST(now(), ps.expires_at) + interval '1 month',
          amount = v_amount,
          payment_id = p_transaction_id
    RETURNING ps.expires_at INTO v_new_expires;

    -- profiles.is_premium/premium_expires_at derivation already exists as its
    -- own function (refresh_premium_status, defined earlier in the baseline)
    -- — reused here rather than re-implementing the same UPDATE inline.
    PERFORM public.refresh_premium_status(p_player_id);

    RETURN QUERY SELECT 'activated'::text, v_new_expires;
    RETURN;
  END IF;

  -- Claim failed. Distinguish "already activated by an earlier caller"
  -- (safe, idempotent — the webhook may have beaten the browser here) from
  -- "genuinely invalid" (wrong owner, wrong purpose, unpaid) so the caller
  -- never surfaces an error for the former.
  SELECT * INTO v_txn
  FROM public.payment_transactions
  WHERE id = p_transaction_id AND player_id = p_player_id;

  IF v_txn.id IS NOT NULL
     AND v_txn.status = 'paid'
     AND (v_txn.metadata->>'purpose') = 'subscription_premium'
     AND v_txn.consumed_at IS NOT NULL
  THEN
    SELECT ps.expires_at INTO v_new_expires
    FROM public.player_subscriptions ps
    WHERE ps.player_id = p_player_id;

    RETURN QUERY SELECT 'already_active'::text, v_new_expires;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'invalid'::text, NULL::timestamptz;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.activate_subscription_from_payment(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription_from_payment(uuid, uuid) TO service_role;
