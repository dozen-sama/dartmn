# Supabase — DartMN

Live project: `idomtybdmqhsxbuttubk` ("mongol-darts", ap-northeast-1).

## Source of truth

**`supabase/migrations/` is the only source of truth for schema.** As of
2026-08-29 it contains a single clean baseline migration
(`20260829120000_baseline.sql`) that was reconstructed from the live
database's actual `pg_catalog`/`information_schema` state (tables,
constraints, indexes, functions, triggers, RLS policies, grants, the
`province_rankings` view, storage bucket config + policies, and realtime
publication membership) — including the 2026-08-29 security hotfix, which
is already baked in.

- `supabase/migration-archive/` — read-only historical record of the 73
  migrations that were applied to the live project before the baseline
  reset, plus the original security hotfix migration and its rollback
  script (in `migration-archive/security/`). **Never apply anything from
  this directory.** See its own `README.md`.
- `supabase/legacy/schema_pre_baseline.sql` — deprecated, hand-maintained
  schema snapshot that predates the baseline and was never kept in sync.
  Kept for historical reference only. **Never apply it.**
- `src/types/database.ts` — generated TypeScript types. Treat as generated
  output, not a source of truth to hand-edit (see below).

## New DB change — workflow

1. Install the Supabase CLI (or use `npx supabase ...`).
2. Start a local stack: `supabase start` (requires Docker).
3. Create a migration: `supabase migration new <descriptive_name>`.
4. Write the SQL in the generated file under `supabase/migrations/`.
5. Apply it locally: `supabase db reset` (rebuilds local DB from all
   migrations) or restart `supabase start` after adding the file.
6. Test against the local stack (`http://127.0.0.1:54321`, Studio at
   `http://127.0.0.1:54323`).
7. Run advisors and review security implications for anything touching
   RLS, views, `SECURITY DEFINER` functions, or storage policies — see the
   Supabase skill's security checklist.
8. Regenerate types: `supabase gen types typescript --local > src/types/database.ts`
   — but see the note below, this repo's `database.ts` also carries
   hand-written convenience type aliases (`Profile`, `Club`, `Tournament`,
   etc.) at the bottom that must be preserved; only the generated
   `Database`/`Json`/`Tables`/`Views`/`Functions`/`Enums` content should be
   replaced, not the whole file blindly overwritten.
9. Review the migration SQL and the type diff.
10. Apply to production: `supabase db push` (or apply via the Supabase
    dashboard/MCP `apply_migration`) once reviewed.
11. Commit the migration file and the regenerated type changes together in
    the same commit/PR.

## Explicitly forbidden

- **Never** change the live database schema by hand (dashboard SQL editor,
  ad-hoc `execute_sql`) without also committing a matching migration file.
  If you do this in an emergency, immediately follow up with a migration
  that reproduces the change so the migration chain stays authoritative.
- **Never** treat `src/types/database.ts` as hand-editable source of truth
  — it should only change as a direct consequence of a schema migration,
  regenerated from a real database, not edited freeform.
- **Never** re-apply anything under `supabase/migration-archive/` — it is
  historical record only, not part of the active chain.
- **Never** run destructive verification (`db reset`, `restore`, etc.)
  against the live project. Always test locally or on an isolated/temporary
  project first.

## Production database access

- Read-only inspection: Supabase MCP tools (`list_tables`, `execute_sql`
  with `SELECT`s, `get_advisors`, `list_migrations`) or the dashboard.
- Schema changes: migration files applied via `supabase db push` or MCP
  `apply_migration`, never raw `execute_sql` DDL against production.
