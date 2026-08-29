# DartMN — Supabase Baseline Recovery Report

Date: 2026-08-29
Live project: `idomtybdmqhsxbuttubk` ("mongol-darts", ap-northeast-1, Postgres 17.6.1.127, `ACTIVE_HEALTHY`)

## 1. Preflight

- Working tree: clean at start.
- Branch: `main`.
- Commits present: `25c444f` (docs: product + Supabase audit), `ac97d52` (fix(security): harden Supabase RPC and storage access).
- Live project confirmed ACTIVE_HEALTHY, matches `.env.local`'s `NEXT_PUBLIC_SUPABASE_URL`.
- Read-only MCP access (`list_tables`, `execute_sql`, `list_migrations`, `list_extensions`) confirmed working.
- Local migration chain at start: exactly one file, `supabase/migrations/20260829_security_hotfix_rpc_storage.sql`, already applied live (confirmed via `list_migrations`, version `20260829091702`).
- No Supabase CLI on `PATH`; used via `npx supabase` instead. Docker available (v29.6.1, 8 CPU / 7.6 GiB), with two unrelated containers already running (`gps-traccar-1`, `gps-postgres-1`) which were never touched.

**Preflight: PASS.**

## 2. Chosen reconciliation strategy

**Option B**, as the spec's default preference, and validated end-to-end: the baseline migration reproduces the current post-hotfix live state directly (all RPC EXECUTE restrictions, storage policies, and `province_rankings security_invoker` are baked into `20260829120000_baseline.sql`). `20260829_security_hotfix_rpc_storage.sql` and its rollback script were moved out of the active migration chain into `supabase/migration-archive/security/`. A fresh empty environment built purely from the baseline (no hotfix file in the chain) was verified to already be in the fully-hardened state — see §9–11.

## 3. Live schema captured

Captured via read-only `pg_catalog`/`information_schema` introspection (no `pg_dump` access to production was available — no DB password is stored in this repo, only the Supabase URL/anon/service-role keys — so DDL was reconstructed using `pg_get_constraintdef`, `pg_get_functiondef`, `pg_get_triggerdef`, `pg_get_viewdef`, and `pg_policies`/`pg_indexes` text, which are exact, not approximations).

Actual live counts (source of truth — the live database, per the spec's priority order — supersede the earlier audit doc's estimates where they differ):

| Object | Audit doc estimate | Actual live count |
|---|---|---|
| Tables (public) | 39 | **39** (match) |
| View | 1 (`province_rankings`) | **1** (match) |
| Custom functions (public, app-owned) | 29 | **30** |
| Triggers (app-owned, public+auth.users) | 18 | **17** |
| Indexes (public, pg_indexes total) | 95 | **103** |
| RLS policies (public + storage) | "~90+" | **86** (78 public + 8 storage) |
| Realtime publication tables | 12 | **12** (match) |
| Storage buckets | 4 | **4** (match) |
| RLS-enabled tables | 39/39 | **39/39** (match) |
| Historical migrations | 75 | **73** |

The small discrepancies (functions, triggers, indexes, policies, migration count) are attributed to the audit doc being a point-in-time estimate; the live counts above are exact (verified by direct `pg_catalog` aggregation, and independently reproduced in the fresh baseline environment — see §10).

## 4. Managed-object exclusions

Not recreated by the baseline (Supabase-managed):
- `auth` schema core tables, `storage` schema core tables, `realtime` schema core tables, `vault`, `supabase_migrations`, internal Supabase roles, `pg_catalog`, `information_schema`.
- Supabase-internal triggers on `storage.buckets`/`storage.objects` (`enforce_bucket_name_length_trigger`, `protect_buckets_delete`, `protect_objects_delete`, `update_objects_updated_at`) and on `realtime.subscription` (`tr_check_filters`) — these are part of the Supabase platform, not DartMN application code.
- `pg_trgm` extension's own SQL functions/operators living in the `public` schema (`show_trgm`, `similarity`, etc. — 31 objects) — excluded from the "app-owned functions" count and from the baseline's function section (the `CREATE EXTENSION pg_trgm` statement recreates them).

Included as "application configuration attached to a managed object" (per the spec's explicit carve-out):
- The `on_auth_user_created` trigger on `auth.users` (calls `public.handle_new_user`).
- `storage.objects` RLS policies for the `clubs`/`tournaments` buckets.
- `storage.buckets` row configuration (public flag, size limits, MIME types) for all 4 buckets.
- `supabase_realtime` publication membership for the 12 app tables.

## 5. Historical 75(73) migration archive

**73 / 73** rows exported read-only from `supabase_migrations.schema_migrations` (`version`, `name`, `statements`) into `supabase/migration-archive/<version>_<name>.sql`, each with the required "HISTORICAL ARCHIVE ONLY / DO NOT APPLY" header, plus `supabase/migration-archive/README.md` explaining the discrepancy with the "75" estimate and the archive's purpose.

Secret scan: every statement was scanned for password/secret/token/API-key-looking literals. **None found — no redaction was necessary.**

## 6. Baseline migration structure

`supabase/migrations/20260829120000_baseline.sql` (timestamp chosen to sort after the hotfix's original `20260829091702` version, and to be self-evidently "the 2026-08-29 baseline"). Ordering:

1. Extensions (`uuid-ossp`, `pgcrypto`, `pg_trgm`)
2. Tables (39, columns only)
3. Constraints (178: 39 PK, 24 UNIQUE, ~35 CHECK, 80 FK — `next_match_id`/`next_loser_match_id` self-referencing FKs preserve `DEFERRABLE INITIALLY DEFERRED`)
4. Indexes (40 non-constraint-backed; the other 63 are PK/UNIQUE-backed and created automatically by step 3)
5. Functions (30, app-owned)
6. Triggers (17: 16 public + `on_auth_user_created` on `auth.users`)
7. RLS enable (all 39 tables)
8. RLS policies (86: 78 public + 8 storage)
9. Grants / RPC EXECUTE restrictions (24 `REVOKE`+`GRANT` pairs, service-role-only)
10. View (`province_rankings`, `security_invoker=true`)
11. Auth trigger attachment (repeated for clarity/ordering — `handle_new_user` must exist before this)
12. Storage bucket configuration (upsert, 4 buckets)
13. Storage policies (8)
14. Realtime publication membership (12 tables) + `REPLICA IDENTITY FULL` on `room_visits` and `local_session_sync`

Every object count in the file was cross-checked by `grep` against the live counts in §3 and matches exactly.

## 7. Security hotfix reconciliation

Moved out of the active chain to `supabase/migration-archive/security/`:
- `20260829_security_hotfix_rpc_storage.sql`
- `20260829_security_hotfix_ROLLBACK.sql` (renamed for consistency)

**A real defect was caught and fixed during verification** (see §9–11): my first draft of the baseline's `REVOKE EXECUTE ... FROM PUBLIC;` statements (24 of them) were insufficient in a fresh environment. Supabase's local Postgres bootstrap (`roles.sql`) sets up `ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role` — so every newly `CREATE FUNCTION`'d object in a fresh database gets **named** `anon`/`authenticated` grants, not just the `PUBLIC` pseudo-role grant. `REVOKE ... FROM PUBLIC` alone does not remove those named-role grants. The live hotfix migration actually used `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated;` (explicit), which is why it worked correctly on the live database (whose functions predate that default-privilege convention) but my initial reconstruction (which only wrote `FROM PUBLIC`) failed identically-shaped fresh-environment testing. Fixed by rewriting all 24 `REVOKE` statements to explicitly include `anon, authenticated`; re-verified clean (§11).

A fresh environment built from the baseline alone (no hotfix file present) reproduces the fully-hardened state — confirmed empirically in §11. No double-apply risk exists.

## 8. Test environment

Local Supabase via Docker (`npx supabase` v2.116.0, images pulled fresh — ~14 minutes on first pull, then fast thereafter). Ran in an isolated scratch directory (`/tmp/.../scratchpad/baseline-test`), never touching the two unrelated pre-existing containers (`gps-traccar-1`, `gps-postgres-1`). No cloud/temporary Supabase project was created — local Docker was sufficient and is fully torn down (`supabase stop --no-backup`) at the end of this session.

## 9. Baseline apply result

**PASS.** `supabase start` (and later `supabase db reset`, after the REVOKE fix) applied `20260829120000_baseline.sql` to a completely empty Postgres instance with **zero SQL errors**, no dependency-ordering errors, and no duplicate policy/function errors. Only benign warning: `no files matched pattern: supabase/seed.sql` (no seed file exists, expected).

## 10. Live vs baseline structural comparison

Every metric matched **exactly** between the live project and the fresh local baseline environment:

| Metric | Live | Baseline (local) |
|---|---|---|
| Tables | 39 | 39 |
| View | 1 | 1 |
| App functions | 30 | 30 |
| Triggers | 17 | 17 |
| Indexes | 103 | 103 |
| Public policies | 78 | 78 |
| Storage policies | 8 | 8 |
| Realtime tables | 12 | 12 |
| Storage buckets | 4 | 4 |
| RLS-enabled tables | 39/39 | 39/39 |

No differences of any kind (expected-managed, environment-generated, or defect) remained after the RPC-grant fix in §7/§11. **No unresolved baseline defects.**

## 11. Security regression

All checks re-verified functionally (not just via `has_function_privilege`, but actual attempted calls/inserts as `anon`/`authenticated`/`service_role` using `SET LOCAL ROLE` + simulated `request.jwt.claim.sub`, inside rolled-back transactions against disposable test fixtures):

| Check | Result |
|---|---|
| `anon` cannot execute `apply_match_result` | ✅ `permission denied for function apply_match_result` |
| `authenticated` cannot execute `apply_match_result` | ✅ `permission denied` |
| `service_role` **can** execute `apply_match_result` | ✅ succeeded |
| `authenticated` cannot execute `advance_tournament_match` | ✅ denied (grant check) |
| `authenticated` cannot execute `start_tournament` | ✅ `permission denied` |
| `authenticated`/`anon` cannot execute `seed_knockout` | ✅ denied (grant check) |
| `check_achievements`/`update_club_score`/`refresh_premium_status` restricted to service_role | ✅ denied for anon/authenticated, allowed for service_role (grant check) |
| Anon tournament-banner storage write | ✅ denied (RLS violation) |
| Non-owner tournament-banner storage write (wrong path) | ✅ denied |
| Owner-path tournament-banner storage write | ✅ allowed |
| Anon club-image storage write | ✅ denied |
| Non-member club-image storage write | ✅ denied |
| Club owner storage write | ✅ allowed |
| Club admin (role='admin' member) storage write | ✅ allowed |
| `province_rankings` uses `security_invoker=true` | ✅ confirmed via `pg_class.reloptions` |

This suite caught the real REVOKE-scope defect described in §7 on the first pass (all 9 sensitive RPCs showed `anon_exec=true, auth_exec=true` before the fix) and confirmed it fixed after correction. **Phase A security posture is fully preserved in the baseline.**

## 12. TypeScript types regeneration

Generated fresh from the verified clean baseline DB (`supabase gen types typescript --local`). Confirmed missing from the previous `src/types/database.ts`, exactly as predicted: `club_subscriptions`, `local_session_sync`, `caller_clips` tables, the `province_rankings` view, and most RPC function signatures in `Functions` (including `apply_match_result`, `advance_tournament_match`, `start_tournament`, `seed_knockout`, `check_achievements`, `update_club_score`, `refresh_premium_status`, `calculate_elo_change`, `club_tier_idx`).

**Updated `src/types/database.ts`.** Note: this file is not a raw CLI passthrough — it also hand-declares convenience type aliases (`Profile`, `Club`, `Tournament`, `OnlineRoom`, etc., derived via `Tables<"tablename">`) that 33 files across the codebase import. A blind full-file overwrite with the raw generated output would have broken all 33 of those imports (the modern CLI output doesn't include those aliases and uses a different helper-generic shape). Instead, only the generated `Database` interface's `public` schema body (Tables/Views/Functions/Enums/CompositeTypes) was spliced in, while preserving the existing `Json` type, the existing simple `Tables<>`/`TablesInsert<>`/`TablesUpdate<>` helper generics, and every convenience type alias — all of which still resolve correctly against the more complete schema.

**Known follow-up (not fixed in this phase, out of scope):** `npx tsc --noEmit` goes from 0 → 7 errors with the updated types. All 7 are genuine, pre-existing latent type gaps that the old, incomplete types were silently masking — e.g. `OrganizerRating.tsx` assigning an untyped `string | null` into what is now correctly known to be a `'paid' | 'unpaid' | null` column (`organizer_ratings.payout_status`), and a few `tournament.status`/`config` literal-typing mismatches. These are real application-code bugs worth fixing, but fixing them is application logic work outside a database-schema-recovery phase's scope, and the spec's completion criteria don't require it. Recommend addressing as a small, separate follow-up PR.

## 13. `schema.sql` handling

Moved to `supabase/legacy/schema_pre_baseline.sql` with a `DEPRECATED — DO NOT USE` header added at the top, redirecting readers to `supabase/migrations/` as the active source of truth. Original content preserved unmodified below the header.

## 14. Migration workflow

Documented in the new `supabase/README.md`: local dev loop (CLI, `migration new`, `db reset`, test, advisors, regenerate types — with the caveat about preserving the hand-written type aliases — review, `db push`, commit migration+types together), plus explicit prohibitions (no manual live-DB changes without a migration, no hand-editing `database.ts` as source of truth, no re-applying archive files).

## 15. Remaining differences/risks

- **7 newly-surfaced (pre-existing) TypeScript errors** from more accurate types — see §12. Recommend a small follow-up PR; not fixed here to keep this phase's diff scoped to schema/type recovery only.
- The historical migration count is **73, not 75** as the earlier audit doc stated — documented in the archive's `README.md` as a live-vs-estimate discrepancy, live count treated as authoritative per the spec's source-of-truth priority.
- Several loose ad-hoc SQL/shell files already existed at `supabase/` root (`drop_notifications_type_check.sql`, `online_rooms_teams.sql`, `apply-email-templates.sh`) whose content appears superseded by formal migrations of the same name now in the archive (e.g. `20260615150457_drop_notifications_type_check.sql`, `20260615135916_online_rooms_teams.sql`). Left untouched — out of this phase's explicit scope, flagging for a future cleanup decision by the user.
- `supabase/functions/` and `supabase/templates/` (email templates) were not touched; not in scope for a schema baseline.

## 16. Git diff

```
$ git status --short
 M src/types/database.ts
RM supabase/schema.sql -> supabase/legacy/schema_pre_baseline.sql
R  supabase/security_hotfix_20260829_ROLLBACK.sql -> supabase/migration-archive/security/20260829_security_hotfix_ROLLBACK.sql
R  supabase/migrations/20260829_security_hotfix_rpc_storage.sql -> supabase/migration-archive/security/20260829_security_hotfix_rpc_storage.sql
?? supabase/README.md
?? supabase/migration-archive/  (73 archived migration .sql files + README.md)
?? supabase/migrations/20260829120000_baseline.sql
?? DARTMN_SUPABASE_BASELINE_REPORT.md  (this file)
```

80 total file changes: 1 modified (`database.ts`), 2 renames (hotfix migration + rollback, `schema.sql`→`legacy/`), 76 new files (73 archived migrations + archive README + new baseline migration + `supabase/README.md`), plus this report at repo root.

**Production DB mutated: No.** All 73 migration statements were read via `execute_sql` SELECT-style queries against `supabase_migrations.schema_migrations`; the live project's actual schema/data was never written to.

**BYL touched: No.** No files under any BYL/`byl.mn`-related path or payment code were read or modified.

## 17. Follow-up: TypeScript errors + ad-hoc SQL cleanup (Phase B.1, 2026-08-29)

### 17.1 Original 7 TypeScript errors

Captured via `npx tsc --noEmit` against the regenerated `src/types/database.ts`. All 7 traced to exactly **2 root causes**, both being the generated types becoming *more accurate*, not regressions:

**Root cause A (5 errors) — `tournaments.status` and `organizer_ratings.payout_status` are CHECK-constrained `text` columns, not Postgres enums.** Supabase's codegen only narrows a column to a literal union when it's backed by a real Postgres `enum` type; a `text` column with a `CHECK (col = ANY (ARRAY[...]))` constraint is honestly typed as plain `string`/`string | null`. The previous hand-adjusted `database.ts` had apparently been narrower, which is what silently made the old indexing/assignment sites compile. Confirmed via live introspection:
- `tournaments_status_check`: `CHECK ((status = ANY (ARRAY['draft','registration','ongoing','completed','cancelled'])))`
- `organizer_ratings_payout_status_check`: `CHECK ((payout_status = ANY (ARRAY['paid','unpaid'])))`

| # | File:Line | Error |
|---|---|---|
| 1 | `src/app/(main)/dashboard/DashboardContent.tsx:64` | TS7053 indexing `mn.tournament.status` (a `readonly {draft,registration,ongoing,completed,cancelled}` object, no index signature) with a plain `string` |
| 2 | `src/app/(main)/tournaments/[id]/TournamentDetail.tsx:145` | same |
| 3 | `src/app/(main)/tournaments/[id]/edit/TournamentEditForm.tsx:261` | same |
| 4 | `src/components/tournament/OrganizerPanel.tsx:143` | same (`newStatus` param) |
| 5 | `src/components/tournament/OrganizerPanel.tsx:220` | same (`tournament.status`) |
| 6 | `src/components/tournament/OrganizerRating.tsx:49` | TS2345 — `mine.payout_status` (`string \| null`) not assignable to local state `"paid" \| "unpaid" \| null` |

**Root cause B (1 error) — `tournament_stages.config` is `jsonb`, typed as `Json` in the generated types, not `Record<string, unknown>`.**

| # | File:Line | Error |
|---|---|---|
| 7 | `src/app/(main)/tournaments/create/CreateTournamentForm.tsx:328` | TS2345 — insert payload's `config: Record<string, unknown>` not assignable to the column's `Json` type |

### 17.2 Fixes

- Added `export type TournamentStatus = "draft" \| "registration" \| "ongoing" \| "completed" \| "cancelled"` to `src/types/database.ts` alongside the other hand-written convenience aliases (matches the live `tournaments_status_check` constraint exactly).
- Added `tournamentStatusLabel(status: string): string` to `src/locales/mn.ts` — a single boundary helper that safely looks up the Mongolian label and falls back to the raw value for any status outside the known set (previously an out-of-range status would have silently rendered `undefined` with no compile-time or runtime signal). Replaced all 5 `mn.tournament.status[...]` call sites (DashboardContent, TournamentDetail, TournamentEditForm, OrganizerPanel ×2) with this helper, and dropped the now-unused `mn` import from TournamentEditForm.tsx and OrganizerPanel.tsx.
- Added `toPayoutStatus(v: string | null): "paid" | "unpaid" | null` as a local runtime type guard in `OrganizerRating.tsx` (matches the live `organizer_ratings_payout_status_check` constraint), used when hydrating `payoutPick` state from a fetched row.
- Changed `CreateTournamentForm.tsx`'s stage-insert payload from `s.config as unknown as Record<string, unknown>` to `s.config as unknown as Json` (imported `type { Json }` from `@/types/database`). `StageConfig` (see `src/lib/tournament/stage-types.ts`) is a union of interfaces whose fields are all plain `string`/`number`/`boolean`/`null` — genuinely JSON-safe data — so this is a narrow, verified cast at the DB-write boundary, not a weakening.
- No `any`, no schema changes, no business-logic changes — every fix is a type-level correction that matches an already-enforced live DB constraint. No error required a product/business-rule decision, so nothing was left BLOCKED.

### 17.3 Final tsc result

`npx tsc --noEmit` → **0 errors** (verified twice, before and after the ad-hoc SQL cleanup below, which touched no `.ts`/`.tsx` files). `npm run build` (full Next.js production build) also completed successfully with no compile errors. `npx eslint` on all 8 changed files → 0 errors, 9 pre-existing warnings (unused icon imports, `<img>` LCP hints) unrelated to these changes.

### 17.4 Ad-hoc SQL files found and disposition

Two loose `.sql` files existed directly under `supabase/` (outside `supabase/migrations/`), both fully superseded by the recovered migration history and already baked into the baseline:

| File | Disposition | Historical migration correspondence |
|---|---|---|
| `supabase/drop_notifications_type_check.sql` | Moved → `supabase/legacy/ad-hoc/drop_notifications_type_check.sql` | `supabase/migration-archive/20260615150457_drop_notifications_type_check.sql`. Content diff: only the comment text differed (root file had a longer, updated comment listing more notification types); the actual SQL statement was byte-identical. |
| `supabase/online_rooms_teams.sql` | Moved → `supabase/legacy/ad-hoc/online_rooms_teams.sql` | Split across **two** archived migrations: `supabase/migration-archive/20260615135916_online_rooms_teams.sql` (the bulk — online_rooms columns, room_players/room_invites/room_visits tables, policies, realtime membership) **and** `supabase/migration-archive/20260618094105_online_tournament_bracket_tables.sql` (the `online_rooms.tournament_match_id` FK column, which this ad-hoc file included as a draft addition but was actually applied live via the later migration, not the original one). Both pieces are present in the baseline (confirmed: `online_rooms_tournament_match_id_fkey` exists in `supabase/migrations/20260829120000_baseline.sql`). |

Each moved file got a "LEGACY / HISTORICAL REFERENCE ONLY — DO NOT APPLY" header explaining the correspondence, with original content preserved unmodified below it.

`supabase/apply-email-templates.sh` was inspected and left in place: it's a shell script (not `.sql`) that pushes Auth email-template content via the Supabase Management API — an operational tool, not a schema/DDL change, and out of scope for this cleanup.

No ad-hoc file contained behavior that was *not* represented in the live schema or historical archive, so nothing needed to be flagged for further review.

### 17.5 Final active migration inventory

```
supabase/migrations/
└── 20260829120000_baseline.sql   (the only active migration)
```

Source-of-truth invariant confirmed unambiguous:
- **Active database source of truth:** `supabase/migrations/20260829120000_baseline.sql` + any future migrations created after it.
- **Historical only (never apply):** `supabase/migration-archive/` (73 recovered migrations + `security/` hotfix reconciliation), `supabase/legacy/` (`schema_pre_baseline.sql` + `ad-hoc/` — 2 files).

### 17.6 Re-verification after cleanup

- `git status --short`: baseline SQL (`20260829120000_baseline.sql`) unchanged — no baseline defect was found or touched in this follow-up.
- Production Supabase (`idomtybdmqhsxbuttubk`): not mutated — only 2 additional read-only `execute_sql` `SELECT ... FROM pg_constraint` calls were made (to confirm the exact CHECK constraints for §17.1), plus a `get_advisors` security check that came back with only pre-existing, unrelated advisories (RLS-enabled-no-policy on `synced_local_sessions`, a handful of `function_search_path_mutable` warnings, `pg_trgm` in public, leaked-password-protection) — none introduced by this work.
- BYL files: not touched (confirmed via `git status --short | grep -i byl` → no match).
- Historical 73 recovered migrations: untouched, still 73.
- Active migrations: still exactly the one baseline file.
- Phase A security state: still fully represented in the unchanged baseline SQL (RPC REVOKE/GRANT block, storage policies, `province_rankings security_invoker` all untouched by this follow-up).
