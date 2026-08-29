# DartMN — BYL.mn Payment Repair Report (2026-08-29)

## 1. Preflight

- Base: baseline recovery phase complete and committed (`602eecb`, `6caa634`,
  `f1b0c11`, `9bfb803` on top of `ac97d52` security hardening). Working tree
  was clean before this phase.
- Sole schema source of truth: `supabase/migrations/20260829120000_baseline.sql`.
- Production Supabase Cloud (`idomtybdmqhsxbuttubk`) — read-only queries only,
  never mutated.

## 2. Payment provider inventory

| Provider | API route | Webhook | UI call site | DB history | Status |
|---|---|---|---|---|---|
| **qpay** | `src/app/api/payments/qpay/route.ts` | via Edge Function (`qpay-callback`, not in this repo) | `src/components/tournament/QPay.tsx` | in CHECK constraint since baseline | ACTIVE |
| **socialpay** | none | none | none — only a label string in `src/locales/mn.ts:184` | in CHECK constraint since baseline | reserved/never built, harmless, untouched |
| **bonum** | `src/app/api/payments/bonum/route.ts` (fully implemented, real HMAC signing) | `PUT` handler in the same file | **none** — no `fetch("/api/payments/bonum")` anywhere in the frontend | **never** in the CHECK constraint, not in the 73-migration archive | DEAD |
| **byl** | `src/app/api/payments/byl/route.ts` | `src/app/api/payments/byl/webhook/route.ts` (real HMAC verification) | `OrganizerPanel.tsx` (platform fee) + `pricing/checkout/page.tsx` (subscriptions) | not present pre-fix | ACTIVE (now repaired) |

`src/components/tournament/BylPay.tsx` was a third, unused standalone BYL
widget — grep confirmed zero imports anywhere in the codebase. Deleted (see §9).

## 3. Bonum investigation

Evidence gathered before making any decision:

- `grep -rn "bonum" -i` across `src/` found exactly two files: the bonum route
  itself and the byl route's copy-pasted `provider: "bonum"` literal.
- `grep -rn "api/payments"` across the whole frontend found **no** call to
  `/api/payments/bonum` — the route is unreachable from any UI.
- `grep -rln "bonum" -i supabase/migration-archive/ supabase/legacy/` (73
  historical migrations) returned nothing — `bonum` has never been a valid
  `payment_transactions.provider` value at any point in this project's history.
- Live production check (`execute_sql`, read-only):
  `SELECT count(*) FROM payment_transactions WHERE provider IN ('byl','bonum')`
  → **0 rows**. Neither provider has ever successfully recorded a transaction.

**Classification: DEAD.** Bonum is a real, non-trivial implementation
(own signature scheme, own env vars, own callback handler) built ahead of a
`BONUM_*` contract that was never signed (per its own code comment: "Гэрээ
байгуулсны дараа" = "after the contract is signed"), but it has no UI trigger
and was never wired into the DB constraint. It is not "copy-paste residue"
in the sense of being garbage code, but it is unreferenced and non-functional
today for a reason unrelated to BYL. Per the stop-scope for this phase, it
was **left untouched** — not added to the canonical provider set, not
deleted, not fixed. Its own `tournament_id` FK bug (see §5) was **not**
fixed either, since bonum is out of scope.

## 4. Canonical provider decision

```ts
// src/lib/payments/providers.ts
export const PAYMENT_PROVIDERS = ["qpay", "socialpay", "byl"] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]
```

`bonum` intentionally excluded per §3. `socialpay` carried forward unchanged
(reserved, unused, harmless).

## 5. BYL create-route audit (`src/app/api/payments/byl/route.ts`)

Findings, in order of how they were fixed:

1. **Provider mismatch (the reported bug).** Insert used
   `provider: "bonum"` — a copy-paste leftover from `bonum/route.ts`, which
   the two routes otherwise mirror closely. Fixed to `provider: "byl"`.

2. **New bug found during audit: broken subscription checkout.**
   `pricing/checkout/page.tsx` calls this route with
   `tournament_id: "00000000-0000-0000-0000-000000000000"` (a sentinel,
   since subscriptions aren't tied to a tournament). `payment_transactions.
   tournament_id` has `FOREIGN KEY ... REFERENCES tournaments(id)`. Verified
   on production (read-only) that this placeholder row does not exist:
   `SELECT EXISTS(SELECT 1 FROM tournaments WHERE id =
   '00000000-0000-0000-0000-000000000000')` → `false`. So **every BYL
   subscription invoice creation would have failed the FK constraint**,
   independent of the provider bug — the two bugs were masking each other,
   and fixing only the provider name would have unmasked this one. Fixed by
   treating any `purpose` starting with `subscription_` as tournament-less:
   the column is nullable (`ON DELETE SET NULL`), so the route now inserts
   `tournament_id: null` for subscriptions and no longer requires a
   `tournament_id` in the request body for that case. `checkout/page.tsx`
   updated to stop sending the placeholder UUID at all.

3. **Auth/ownership/amount — already correct, no changes needed:**
   - Requires an authenticated session (`auth.getUser()`); verified live: no
     session → 401.
   - `player_id !== user.id` → 403 (a user cannot create an invoice for
     someone else).
   - Amount is **never** taken from the client. `resolveExpectedAmount()`
     (`src/lib/payments/validate-amount.ts`, untouched) recomputes it
     server-side from a fixed subscription-price map or from
     `tournaments.entry_fee` / a computed platform fee, and the route
     rejects the request (400) if the client's `amount` doesn't match. This
     logic is shared with the QPay route and was not modified.
   - Secrets (`BYL_TOKEN`, `BYL_PROJECT_ID`) never leave the server.

## 6. Fail-closed credential handling — verified live

With `BYL_TOKEN`/`BYL_PROJECT_ID` unset, a real request against a local dev
server returned:
```
503 {"error":"byl.mn гэрээ хийгдээгүй байна"}
```
before any DB write or outbound call. Behavior preserved as-is (this was
already correct). `BYL_WEBHOOK_SECRET` is independently required only by the
webhook route, not the create route — the two were already correctly
decoupled.

## 7. Webhook security audit (`src/app/api/payments/byl/webhook/route.ts`)

Already correct, unchanged:
- Uses the **raw** request body for HMAC (`req.text()`, not parsed JSON).
- `crypto.timingSafeEqual` with an explicit length check first (avoids the
  throw `timingSafeEqual` raises on mismatched buffer lengths).
- Missing secret → 503 before any signature work.
- Missing/garbage signature → 401 (verified live with a `byl-signature:
  deadbeef` request).

Fixed:
- `JSON.parse(rawBody)` was unguarded — a malformed body with a *valid*
  signature would throw an uncaught exception (500, unhandled). Wrapped in
  try/catch → clean `400 {"error":"Invalid JSON"}` (verified live).

## 8. Idempotency & transaction matching

The webhook matches transactions by the internal `payment_transactions.id`
(a v4 UUID embedded directly in the BYL invoice `description` field at
creation time, e.g. `"... [uuid]"`), not by any BYL-side external ID. This
means cross-provider ID collisions were never structurally possible — the
match key is the internal primary key.

Two things were still worth hardening, both now a single atomic UPDATE:

```sql
UPDATE payment_transactions SET status = 'paid'
WHERE id = :txnId AND provider = 'byl' AND status = 'pending'
RETURNING player_id, tournament_id, metadata
```

- **`.eq("provider", "byl")`** — defense in depth. Even though PK matching
  already prevents it, this makes it structurally impossible for a byl
  webhook to ever touch a qpay/socialpay row, by construction rather than
  by accident of key design.
- **`.eq("status", "pending")`** — makes the whole handler idempotent. A
  duplicate `invoice.paid` delivery (BYL, like most providers, does not
  guarantee exactly-once delivery) now updates 0 rows on the second
  delivery, and the handler returns `{"ok":true}` without repeating the
  `tournaments.platform_fee_paid` / `tournament_registrations.payment_status`
  side effects. Previously the `UPDATE ... SET status='paid'` had no
  condition, so replays were "safe" only by accident (re-setting a boolean
  flag / a status string to the value it already had) — this makes it safe
  by design and stops **any** reprocessing, not just the two side effects
  that happened to already be flag-sets.

This mirrors the existing `consumed_at IS NULL` conditional-update pattern
already used in `src/app/api/subscriptions/activate/route.ts` for the same
purpose — no new architecture invented.

**Documented limitation (per the STOP CONDITIONS in the task brief):** there
is no BYL API payload schema available anywhere in this repo or its history,
and the amount actually paid is not independently re-verified against
`payment_transactions.amount` inside the webhook, because the exact shape of
`event.data.object` for `invoice.paid` beyond `description` is unknown — I
will not guess field names. Mitigating factors: the amount was already
fixed server-side at invoice-creation time (§5), and the webhook is
HMAC-signed by BYL, so this is a real but low-severity gap tied to BYL's own
payload documentation, not something fixable by guessing.

Verified live (local Supabase + local dev server, fake HMAC secret):
- Fresh `invoice.paid` for a pending byl txn → `paid`, `tournament_registrations.payment_status` → `paid`. ✓
- Exact same webhook replayed → `{"ok":true}`, no error, no second write. ✓
- A `qpay` transaction with a different id sitting in the same table was
  untouched by the byl webhook. ✓
- `invoice.paid` for an unknown/nonexistent txn id → `{"ok":true}`, no mutation. ✓

## 9. Frontend canonicalization

Found **three** independent implementations of the same "create BYL invoice →
open payment tab → poll `payment_transactions.status`" flow (the task brief
named two; audit found a third in the subscription checkout page):

1. `OrganizerPanel.tsx` — platform-fee payment, wired to auto-start the
   tournament on success.
2. `pricing/checkout/page.tsx` — subscription payment, wired to
   `/api/subscriptions/activate` on success.
3. `BylPay.tsx` — a generic standalone component, **never imported anywhere**.

None of the three could simply replace the other two as-is: (1) and (2) each
have real, different post-payment side effects that a generic component
would need many override props to support, and each has bespoke surrounding
UI (a styled panel with a "Болих" cancel button vs. a full checkout card) —
forcing them into one shared rendered component would either lose that UX or
turn `BylPay` into a large prop-driven render-override component, which is
more machinery than three call sites justify.

Instead: extracted the actual duplicated part — the fetch/poll/state-machine
logic, not the rendering — into `src/hooks/useBylInvoice.ts`. Both real call
sites (`OrganizerPanel.tsx`, `checkout/page.tsx`) now use it; each keeps its
own JSX exactly as before. `BylPay.tsx` (dead, and the least-used-in-practice
of the three) was deleted rather than kept as a fourth thing to maintain.
Net: two payment implementations removed, zero behavior change, one
reusable hook.

## 10. UI behavior when BYL is not configured

Unchanged, already correct: the create route's `503 {"error":"byl.mn
гэрээ хийгдээгүй байна"}` is surfaced via `toast.error(result.error ?? ...)`
in both call sites through the shared hook — no fake success path exists.

## 11. QPay/SocialPay/Bonum regression

- `src/app/api/payments/qpay/route.ts` — not touched.
- `src/components/tournament/QPay.tsx` — not touched.
- `src/app/api/payments/bonum/route.ts` — not touched (still has its own,
  separate, out-of-scope `tournament_id` FK bug — see §3; not fixed here).
- `socialpay` — no code exists to regress; constraint value carried forward.
- Migration test matrix (below) explicitly confirms `qpay`/`socialpay` still
  accepted after the constraint change.

## 12. Fresh baseline + migration test

Local stack: `npx supabase init` (added `supabase/config.toml` +
`supabase/.gitignore` — the CLI workflow documented in `supabase/README.md`
requires these and they were missing; committing them lets future migrations
follow that workflow) → `npx supabase start` → applied
`20260829120000_baseline.sql` then `20260829120100_add_byl_payment_provider.sql`.

**0 SQL errors on both.**

## 13. Test matrix

| Test | Method | Result |
|---|---|---|
| `qpay` accepted | live INSERT, local DB | ✓ accepted |
| `socialpay` accepted | live INSERT, local DB | ✓ accepted |
| `byl` accepted | live INSERT, local DB | ✓ accepted |
| `bonum` rejected | live INSERT, local DB | ✓ rejected (CHECK violation) |
| garbage rejected | live INSERT, local DB | ✓ rejected (CHECK violation) |
| Create route: missing config → 503 | live HTTP, local dev server | ✓ |
| Create route: unauthenticated → 401 | live HTTP, local dev server, creds configured | ✓ |
| Create route: ownership (`player_id !== user.id` → 403) | code review (unchanged logic) | not independently exercised — see note below |
| Create route: arbitrary client amount rejected | code review (unchanged `resolveExpectedAmount`) | not independently exercised — see note below |
| Webhook: missing signature → 401 | live HTTP | ✓ |
| Webhook: bad signature → 401 | live HTTP | ✓ |
| Webhook: malformed JSON w/ valid signature → 400 | live HTTP | ✓ |
| Webhook: wrong event type → 200, no mutation | live HTTP | ✓ |
| Webhook: valid `invoice.paid` → txn paid + registration paid | live HTTP + DB read | ✓ |
| Webhook: duplicate `invoice.paid` → idempotent, no double side effect | live HTTP + DB read | ✓ |
| Webhook: unknown invoice id → 200, no mutation | live HTTP + DB read | ✓ |
| Webhook: byl update never touches a qpay row | live HTTP + DB read | ✓ |
| Frontend: single canonical hook, no duplicate fetch logic | code review + `tsc`/build | ✓ |
| Frontend: disabled/unconfigured state surfaced | code review (unchanged toast path) | ✓ |

**Note on the two "not independently exercised" rows:** this repo has no
test framework at all (`package.json` has no test script; no jest/vitest
config; zero `*.test.*` files anywhere), so standing up authenticated HTTP
sessions against `@supabase/ssr`'s cookie format for two rows of pre-existing,
unmodified logic was judged not worth introducing new test infrastructure
for. Both were verified by direct code reading (§5.3) instead. Everything
that changed in this phase (provider value, tournament_id nullability,
webhook idempotency/JSON-safety/provider-scoping) was verified with a live
request or a live DB write, not just read.

## 14. TypeScript / Build / Lint

```
npx tsc --noEmit   → 0 errors
npm run build      → success, all routes compiled (incl. byl/webhook/bonum/qpay)
npm run lint       → 0 new issues (153 pre-existing problems, none in any file this phase touched)
```

## 15. Environment / config state

- `BYL_TOKEN`: not configured (production)
- `BYL_PROJECT_ID`: not configured (production)
- `BYL_WEBHOOK_SECRET`: not configured (production)
- `.env.example` — not a tracked git file in this repo (`git ls-files` confirms
  it was never committed; `.gitignore` excludes `.env*`). Added `BYL_TOKEN` /
  `BYL_PROJECT_ID` / `BYL_WEBHOOK_SECRET` placeholders to the file on disk for
  local reference, but this change will not appear in `git status`/`git diff`
  and needs no commit.
- Route continues to fail closed (503) in production until these three are set.

## 16. Remaining blockers

- No real BYL merchant contract/credentials exist yet — end-to-end payment
  completion against the real byl.mn API cannot be exercised. Everything
  short of that (schema, both routes' logic, webhook security/idempotency,
  frontend) has been repaired and verified against a local stack.
- Bonum route has its own latent `tournament_id` FK bug, structurally
  identical to the one found and fixed in BYL — intentionally left alone,
  out of scope, and currently unreachable from any UI regardless.
- No amount cross-check inside the webhook payload itself (§8) — blocked on
  not having BYL's documented webhook payload schema.

## 17. Git diff summary

```
 src/app/(main)/pricing/checkout/page.tsx     |  65 +++++---------
 src/app/api/payments/byl/route.ts            |  12 ++-
 src/app/api/payments/byl/webhook/route.ts    |  22 +++--
 src/components/tournament/BylPay.tsx         | 127 ---------------------------  (deleted)
 src/components/tournament/OrganizerPanel.tsx |  62 ++++---------
 src/hooks/useBylInvoice.ts                   |  new file
 src/lib/payments/providers.ts                |  new file
 supabase/.gitignore                          |  new file (from `supabase init`)
 supabase/config.toml                         |  new file (from `supabase init`)
 supabase/migrations/20260829120100_add_byl_payment_provider.sql | new file
```

No commit made. No push. Production Supabase not mutated (read-only queries
only). Working tree left for review.
