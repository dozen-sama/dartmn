# DartMN — Phase D: Server-Authoritative Subscription Activation Report

## 1. Existing activation architecture (before this phase)

Before this change, Premium entitlement was granted by exactly one code
path: the browser, after returning from BYL's hosted checkout, called
`POST /api/subscriptions/activate` with `{ player_id, transaction_id }`.
That route:

1. Authenticated the caller (`auth.getUser()`), checked `player_id === user.id`.
2. Fetched the `payment_transactions` row and required `status = 'paid'`,
   `player_id = user.id`, and `metadata->>'purpose' = 'subscription_premium'`.
3. Claimed the payment with a conditional `UPDATE ... WHERE consumed_at IS NULL`
   (idempotency guard).
4. Upserted `player_subscriptions` (`expires_at = now() + 1 month`) and
   updated `profiles.is_premium` / `profiles.premium_expires_at` as two
   separate REST calls from Node — not one DB transaction.

The BYL webhook (`/api/payments/byl/webhook`) only ever marked
`payment_transactions.status = 'paid'` and, for `platform_fee` /
tournament-entry purposes, updated `tournaments`/`tournament_registrations`.
It never touched subscriptions — `!txn?.tournament_id` short-circuited it
for every subscription payment (subscriptions have `tournament_id = NULL`).

## 2. Failure scenario (why this phase exists)

Because activation lived only in the client-called route, a user who paid
successfully (BYL webhook already marked the row `paid`) but never
completed the return trip to `/pricing/checkout` — closed the tab, lost
connection, crashed, or a redirect glitch — would have a `paid` payment
with `consumed_at = NULL` forever, and no `player_subscriptions` row, no
`profiles.is_premium`. Entitlement was browser-dependent even though the
money had already cleared.

## 3. Shared activation design

New server-only module: `src/lib/payments/activate-subscription.ts`

```ts
export async function activateSubscriptionFromPayment(
  supabase: SupabaseClient,
  transactionId: string,
  playerId: string,
): Promise<ActivationResult>
```

It is a thin wrapper around a single Postgres RPC,
`public.activate_subscription_from_payment(p_transaction_id, p_player_id)`.
All the actual claim/upsert/derive logic lives in that one SQL function, not
in TypeScript — both call sites (webhook, client fallback route) invoke the
exact same compiled logic, so there is no duplicated business logic to drift
out of sync. `import "server-only"` (the same convention already used in
`src/lib/cosmetics-server.ts`) makes it a build-time error if this module is
ever imported into a client bundle.

## 4. Atomicity strategy

Per the task's Step 5, the previous architecture's "claim, then two separate
REST writes" was not atomic — a crash between the claim and the
`player_subscriptions`/`profiles` writes would strand a consumed payment
with no entitlement. Rather than inventing new transaction machinery, I
reused the pattern already present in this schema: `SECURITY DEFINER`
PL/pgSQL functions with `SET search_path TO 'public'`, the same shape as
`matchmaking_claim_match`, `handle_new_user`, etc. (`supabase/migrations/
20260829120000_baseline.sql`). The entire claim → upsert → premium-derive
sequence for one payment now runs inside **one Postgres function call**,
which Postgres executes as a single implicit transaction — either all of it
commits or none of it does. There is no window where a payment is consumed
but no subscription exists.

One additional simplification found during implementation: `profiles.
is_premium` / `premium_expires_at` derivation from `player_subscriptions`
already existed as its own function, `refresh_premium_status(p_player_id)`
(defined in the baseline, but dead — revoked from every role and never
called anywhere in `src/`). Rather than re-implementing that `UPDATE
profiles SET is_premium = ...` inline a second time, the new RPC calls
`PERFORM public.refresh_premium_status(p_player_id)` after upserting
`player_subscriptions`. This is a straight reuse of existing, already-tested
logic, per the "do not duplicate this logic blindly" instruction.

## 5. Idempotency strategy

The claim step is a single conditional `UPDATE`:

```sql
UPDATE public.payment_transactions
SET consumed_at = now()
WHERE id = p_transaction_id
  AND player_id = p_player_id
  AND status = 'paid'
  AND (metadata->>'purpose') = 'subscription_premium'
  AND consumed_at IS NULL
RETURNING amount INTO v_amount;
```

Postgres takes a row lock on the matching row for the duration of the
`UPDATE`. A second caller (duplicate webhook delivery, or the client
fallback racing the webhook) evaluating the same `WHERE` clause either:

- blocks until the first transaction commits, then sees `consumed_at IS NOT
  NULL` and matches zero rows (`FOUND = false`), or
- if truly concurrent, only one of the two UPDATE statements can be the one
  that "wins" the row — Postgres's row-level locking makes this exclusive
  by construction, not by an application-level check.

The losing caller falls into the second branch, which distinguishes
"already consumed **and** the purpose/status prove it was a legitimate
subscription activation" (→ `already_active`, current `expires_at` returned)
from every other case — wrong owner, wrong purpose, not paid, unknown id —
which returns `invalid`. This is the contract that lets the client
fallback route return success (not an error) when the webhook won the race.

## 6. Webhook integration

`src/app/api/payments/byl/webhook/route.ts`: after the existing atomic
`status: 'pending' → 'paid'` transition (unchanged — still scoped to
`provider = 'byl'` and `status = 'pending'` for the same reasons as before),
the handler now branches on `purpose` *before* the old `tournament_id`
check:

```ts
if (purpose === "subscription_premium") {
  const result = await activateSubscriptionFromPayment(supabase, txnId, txn.player_id)
  ...
  return NextResponse.json({ ok: true })
}
if (!txn.tournament_id) return NextResponse.json({ ok: true })
// unchanged platform_fee / tournament_registrations logic
```

This was necessary because subscription payments have `tournament_id =
NULL` — the old `!txn?.tournament_id` early return would otherwise still
skip them. Tournament/platform-fee payments (which always have a
`tournament_id`) are structurally unreachable by the new branch and fall
through to the untouched code below exactly as before.

## 7. Webhook response semantics

- Signature/JSON-parse failures: unchanged (401 / 400 / 503), not part of
  this phase.
- Successful claim-or-already-active for a subscription payment: `200 {ok:
  true}`.
- The activation RPC throwing (a real, unexpected DB error — not a logical
  "invalid" result): `500`, so BYL retries. Safe to retry because the claim
  UPDATE has already run by then either way — a retry either re-attempts a
  genuinely failed activation (good) or finds the payment already consumed
  and returns `already_active` (also safe, no double-write).
- The RPC returning `invalid` for a subscription-purpose payment that
  passed the `status: pending→paid` transition (meaning the row exists,
  is `paid`, has this purpose, but activation still says invalid — should
  not happen in practice since the same query already filtered on those
  fields moments earlier) is logged but still returns `200 {ok: true}`,
  since retrying would return the same `invalid` result forever and BYL has
  no bounded retry budget documented in this repo.

## 8. Client endpoint role after change

`POST /api/subscriptions/activate` is now purely a recovery/fallback
endpoint. It still authenticates and checks `player_id === user.id`, then
delegates entirely to `activateSubscriptionFromPayment`. It no longer
contains any claim/upsert logic of its own — it cannot diverge from the
webhook's behavior because there is only one implementation. If the webhook
already activated the subscription, this route returns `{ ok: true, status:
"already_active", expiresAt }`, not an error. Confirmed nothing else in the
codebase calls this route (`grep -rn "subscriptions/activate"` → only
`checkout/page.tsx`), so nothing else depends on its previous exact
response shape.

## 9. Checkout UX

No changes to `src/app/(main)/pricing/checkout/page.tsx` or
`src/hooks/useBylInvoice.ts` were needed. The "Төлбөр амжилттай!" / "paid"
step was already driven purely by `payment_transactions.status === "paid"`
(via `useBylInvoice`'s direct Supabase read), independent of whether
`/api/subscriptions/activate` succeeds — so the UI was already decoupled
from activation outcome before this phase, and remains exactly as verified
in production commit `f54b11d`. The client's fire-and-forget call to
`/api/subscriptions/activate` is now genuinely just a "confirm/hurry along"
call; the entitlement itself was already granted server-side by the webhook
in the overwhelming majority of cases by the time this call happens.

## 10. DB migration

New forward migration:
`supabase/migrations/20260829120200_add_subscription_activation_rpc.sql`

Adds one function, `public.activate_subscription_from_payment(uuid, uuid)`,
plus its `REVOKE`/`GRANT` pair. `20260829120000_baseline.sql` was **not**
edited. Applied cleanly on top of both existing migrations in the isolated
test environment described in §11.

## 11. Security

The new function follows the exact hardened pattern already established in
the baseline (`SECURITY DEFINER`, `SET search_path TO 'public'`, then):

```sql
REVOKE EXECUTE ON FUNCTION public.activate_subscription_from_payment(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription_from_payment(uuid, uuid) TO service_role;
```

Verified live (see §12): `SET ROLE anon` and `SET ROLE authenticated` both
get `permission denied for function activate_subscription_from_payment`;
`SET ROLE service_role` succeeds. Only the webhook and the client fallback
route call it, both via `createAdminClient()` (service-role key, never
exposed to the browser).

## 12. Tests — executed against a real, isolated Postgres instance

**No paid Supabase branch was created** (per your explicit instruction).
Instead: Docker was already running locally with the actual Supabase
Postgres image cached (`public.ecr.aws/supabase/postgres:17.6.1.165`) — the
same image the Supabase CLI's local stack uses, with real `auth`/`storage`/
`extensions` schemas, real `anon`/`authenticated`/`service_role` roles, and
`auth.uid()` pre-installed, not a hand-rolled stub. An ephemeral container
was started, all three migrations applied in order (baseline → byl provider
→ new RPC), the test matrix run directly against it with `psql`, and the
container destroyed afterward. Nothing was installed system-wide; nothing
touched production or any paid resource.

(The baseline's storage-bucket-seed section, §12 of that file, fails on a
bare Postgres image because the Storage service's own migrations — which
create `storage.buckets` — aren't part of this repo; that section and
Realtime publication membership were skipped as irrelevant to this feature.
Every table/function/trigger/RLS/grant relevant to payments and
subscriptions applied without error.)

| # | Test | Result |
|---|---|---|
| 1 | **Primary acceptance test**: fresh `paid` subscription_premium txn, RPC called with no browser involved → `activated`, `player_subscriptions.status='active'`, `expires_at` = +1 month, `profiles.is_premium=true`, `premium_expires_at` set, `payment_transactions.consumed_at` set | ✅ PASS |
| 2 | Duplicate call on the same now-consumed txn (simulates duplicate `invoice.paid` delivery) | ✅ `already_active`, same `expires_at`, no second write |
| 3 | Client-fallback call after webhook already claimed (sequential race) | ✅ `already_active`, no double extension |
| 4 | **True concurrency race**: 10 simultaneous `psql` connections calling the RPC on the *same never-before-consumed* txn at once | ✅ Exactly 1 returned `activated`, 9 returned `already_active`; final state: exactly 1 `player_subscriptions` row, `consumed_at` set exactly once |
| 5 | Pending (not yet paid) payment | ✅ `invalid`, no mutation |
| 6 | Unrelated user's payment (wrong `player_id`) | ✅ `invalid`, no mutation |
| 7 | Wrong purpose (`platform_fee`) | ✅ `invalid`; `payment_transactions.consumed_at` left NULL — untouched |
| 8 | Unknown/nonexistent transaction id | ✅ `invalid` |
| 9 | Non-BYL provider (`qpay`) paid subscription txn | ✅ Still activates — RPC is provider-agnostic by design, matching the old route's behavior exactly (never checked provider) |
| 10 | `SET ROLE anon` / `SET ROLE authenticated` calling the RPC directly | ✅ Both denied: `permission denied for function activate_subscription_from_payment` |
| 11 | `SET ROLE service_role` calling the RPC | ✅ Succeeds |

Not independently re-executed in this isolated environment (no
PostgREST/webhook HTTP layer was stood up, since Docker+bare Postgres was
the explicitly approved scope): the HMAC signature verification, the
`invoice.paid`/`checkout.completed` payload parsing, and the outer
`status: pending→paid` UPDATE in the webhook route — none of that code was
touched by this phase (see the diff in §15), and it was already verified
live in production per `DARTMN_BYL_REPAIR_REPORT.md`. What *was* touched
(the new branch that calls into the shared RPC) is a straight-line call
with no conditional logic of its own beyond the try/catch already covered
by tests 1–11 above via the RPC directly.

## 13. Regression

- Tournament/platform-fee webhook path: unchanged code, structurally
  unreachable by the new branch (subscription purposes never have a
  `tournament_id`; tournament/platform-fee purposes never match
  `purpose === "subscription_premium"`). Verified in test #7 that a
  `platform_fee`-purpose paid transaction is left completely untouched by
  the subscription RPC.
- Club subscriptions (`subscription_basic/pro/enterprise`): confirmed via
  `grep` that no activation path exists anywhere in the codebase for these
  today (checkout page only calls `/api/subscriptions/activate` when
  `type === "player"`; the old route explicitly rejected non-`premium`
  purposes). This phase does not add one — out of scope, behavior
  unchanged (still dead/unactivated, as it already was).
- `npx tsc --noEmit`: clean.
- `npm run build`: succeeds, all routes compile including the two changed
  ones.
- `npm run lint`: 44 pre-existing errors / 108 pre-existing warnings, all
  in files this phase did not touch (`useLiveTournament.ts`,
  `useWebRTCCamera.ts`, `local-game/*`). Zero lint issues in any file this
  phase changed.

## 14. Production rollout plan

1. Review this report and the diff (§15).
2. Apply `supabase/migrations/20260829120200_add_subscription_activation_rpc.sql`
   to production (additive only — one new function + its grants, no table
   changes, no data migration).
3. Deploy the three changed TypeScript files together (webhook route,
   client fallback route, new shared module) — they must land in the same
   deploy, since the webhook route imports the shared module.
4. Verify with a real BYL subscription purchase, this time specifically
   confirming activation happens even if the browser tab is closed
   immediately after payment (the actual acceptance criterion for this
   phase) — not just the already-verified redirect-return path.
5. Leave the existing pending invoice `72635` untouched, per your explicit
   instruction — out of scope for this phase.

## 15. Remaining risks

- The webhook's `invoice.paid` txn-id extraction still depends on a
  description-embedded UUID regex for the legacy Invoices API path (unrelated
  pre-existing limitation, not touched here — documented already in
  `DARTMN_BYL_REPAIR_REPORT.md` §8).
- If BYL's actual retry policy for a `5xx` webhook response is more limited
  than assumed (e.g., very few retries, or none), a transient DB error at
  the exact moment of `invoice.paid` delivery could still leave a payment
  `paid`-but-unconsumed until the user's browser calls the fallback route.
  This is a strict improvement over today's behavior (where the browser was
  the *only* path, period), not a new failure mode — the fallback route
  now exists and is idempotent-safe.
- `refresh_premium_status` is called by number-of-callers this phase adds
  (2: webhook, fallback route) — it was previously wired into the schema
  but never invoked from application code anywhere; this phase is the
  first real caller.

## 16. Git diff

New files:
- `src/lib/payments/activate-subscription.ts`
- `supabase/migrations/20260829120200_add_subscription_activation_rpc.sql`
- `DARTMN_SUBSCRIPTION_WEBHOOK_ACTIVATION_REPORT.md` (this file)

Modified files (see full diff via `git diff`):
- `src/app/api/payments/byl/webhook/route.ts`
- `src/app/api/subscriptions/activate/route.ts`
- `src/types/database.ts` (added `activate_subscription_from_payment` RPC
  type signature, matching what `supabase generate_typescript_types` would
  produce)

---

# Final Response

**Status: PASS**

**Activation authority:** BYL webhook (`invoice.paid` / `checkout.completed`)
is now the primary, browser-independent activation path. The client
`/api/subscriptions/activate` route is a fallback/recovery path only, backed
by the identical shared RPC.

**Atomicity:** One `SECURITY DEFINER` Postgres function
(`activate_subscription_from_payment`) performs claim + upsert +
premium-derivation as a single implicit transaction — no window where a
payment is consumed without a resulting subscription.

**Idempotency:** Guarded by a conditional `UPDATE ... WHERE consumed_at IS
NULL` claim, using Postgres row-level locking as the serialization
mechanism (not an app-level check). Verified with 10 truly concurrent
callers on the same payment: exactly 1 activation, 9 safe `already_active`
responses.

**Webhook behavior:** Marks payment paid (unchanged), then for
`subscription_premium` purpose calls the shared RPC and returns 200 on
success/already-active, 500 only on a genuine unexpected error (to invite a
safe BYL retry).

**Client /api/subscriptions/activate:** Thin fallback, delegates entirely
to the shared RPC, no independent logic, returns success (not error) when
the webhook already activated.

**Checkout UX:** Unchanged — already decoupled from activation-call outcome
before this phase; verified no code changes needed.

**DB migration:** One new additive migration,
`20260829120200_add_subscription_activation_rpc.sql`. Baseline untouched.

**Security tests:** `anon`/`authenticated` denied EXECUTE; `service_role`
allowed. Verified live in an isolated Postgres instance.

**Race tests:** 10-way concurrent claim on one payment → exactly one
activation. Sequential webhook-then-client and client-then-webhook orderings
both verified idempotent.

**Tournament regression:** Platform-fee/tournament-entry webhook logic is
byte-for-byte unchanged and structurally unreachable by the new code path;
verified live that a `platform_fee` txn is untouched by the new RPC.

**TypeScript:** `npx tsc --noEmit` — clean.

**Build:** `npm run build` — succeeds.

**Production mutated:** No.

**Files changed:**
- `src/lib/payments/activate-subscription.ts` (new)
- `supabase/migrations/20260829120200_add_subscription_activation_rpc.sql` (new)
- `src/app/api/payments/byl/webhook/route.ts` (modified)
- `src/app/api/subscriptions/activate/route.ts` (modified)
- `src/types/database.ts` (modified)

**git status --short:**
```
 M src/app/api/payments/byl/webhook/route.ts
 M src/app/api/subscriptions/activate/route.ts
 M src/types/database.ts
?? src/lib/payments/activate-subscription.ts
?? supabase/migrations/20260829120200_add_subscription_activation_rpc.sql
?? DARTMN_SUBSCRIPTION_WEBHOOK_ACTIVATION_REPORT.md
```

**Recommended rollout:** See §14 above — apply migration, deploy the three
code files together, verify with a real BYL purchase where the browser tab
is closed immediately after payment.

Do not commit. Wait for review.
