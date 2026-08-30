-- Server-authoritative subscription activation (Phase D).
--
-- Context: subscription entitlement previously depended entirely on the
-- browser calling /api/subscriptions/activate after BYL redirected back to
-- checkout. If the tab closed, the connection dropped, or the redirect
-- failed, a payment could sit "paid" in payment_transactions forever
-- without player_subscriptions/profiles ever being updated.
--
-- This function makes the claim-payment + grant-entitlement sequence a
-- single atomic transaction, callable from BOTH the BYL webhook (the new
-- authoritative path) and the existing client activation endpoint (kept as
-- an idempotent fallback). Two concurrent/duplicate callers racing on the
-- same transaction_id can only ever have one of them observe FOUND on the
-- claim UPDATE below — Postgres's row-level lock on the UPDATE serializes
-- them, so "one paid payment activates exactly once" holds even under a
-- true webhook/client race, not just under sequential duplicate delivery.
CREATE OR REPLACE FUNCTION public.activate_subscription_from_payment(p_transaction_id uuid, p_player_id uuid)
 RETURNS TABLE(result text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_amount integer;
  v_expires timestamptz;
  v_txn RECORD;
BEGIN
  -- Atomic claim: only a transaction that is paid, owned by this player, for
  -- the Premium purpose, and not yet consumed can be claimed. This mirrors
  -- the WHERE consumed_at IS NULL conditional UPDATE pattern already used
  -- elsewhere in this schema (payment_transactions status transitions) —
  -- the row lock this UPDATE takes makes it the single source of truth for
  -- "did this payment already grant entitlement", not a separate flag.
  UPDATE public.payment_transactions
  SET consumed_at = now()
  WHERE id = p_transaction_id
    AND player_id = p_player_id
    AND status = 'paid'
    AND (metadata->>'purpose') = 'subscription_premium'
    AND consumed_at IS NULL
  RETURNING amount INTO v_amount;

  IF FOUND THEN
    v_expires := now() + interval '1 month';

    INSERT INTO public.player_subscriptions (player_id, status, expires_at, amount, payment_id)
    VALUES (p_player_id, 'active', v_expires, v_amount, p_transaction_id)
    ON CONFLICT (player_id) DO UPDATE
      SET status = 'active', expires_at = v_expires, amount = v_amount, payment_id = p_transaction_id;

    -- profiles.is_premium/premium_expires_at derivation already exists as its
    -- own function (refresh_premium_status, defined earlier in the baseline)
    -- — reused here rather than re-implementing the same UPDATE inline.
    PERFORM public.refresh_premium_status(p_player_id);

    RETURN QUERY SELECT 'activated'::text, v_expires;
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
    SELECT ps.expires_at INTO v_expires
    FROM public.player_subscriptions ps
    WHERE ps.player_id = p_player_id;

    RETURN QUERY SELECT 'already_active'::text, v_expires;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'invalid'::text, NULL::timestamptz;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.activate_subscription_from_payment(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription_from_payment(uuid, uuid) TO service_role;
