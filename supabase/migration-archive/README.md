# Migration Archive (historical, read-only)

This directory is **not** part of the active Supabase migration chain
(`supabase/migrations/`). Nothing here should ever be re-applied.

## Why this exists

Before the 2026-08-29 baseline recovery, this repo's `supabase/migrations/`
directory did not reflect the real migration history of the live database.
The live project (`idomtybdmqhsxbuttubk`, "mongol-darts") had accumulated
73 migrations directly via `supabase_migrations.schema_migrations`
(applied through the CLI/dashboard over time, not always mirrored back into
this repo) before this repo's schema was reset to a single clean baseline
migration (`supabase/migrations/20260829120000_baseline.sql`).

To avoid losing that history, all 73 rows were exported read-only from
`supabase_migrations.schema_migrations` (version, name, and the exact SQL
`statements` that were run) into individual files here, one per migration,
named `<version>_<sanitized_name>.sql`.

## Source

Read-only export via Supabase MCP `execute_sql` against the live project,
querying `supabase_migrations.schema_migrations`. No data was mutated.
Captured 2026-08-29.

## Count

**73 / 73** historical migrations archived (versions `20260601083156`
through `20260829091702`). This is the live, authoritative count — it
differs from the "75 migrations" estimate in the earlier
`DARTMN_SUPABASE_SCHEMA_AUDIT.md`; the live `schema_migrations` table is
the source of truth per the baseline-recovery spec's priority order.

## Secrets

Every statement was scanned for password/secret/token/API-key-looking
literals before being written to disk. **None were found** — no redaction
was necessary.

## `security/` subdirectory

`security/20260829_security_hotfix_rpc_storage.sql` and
`security/20260829_security_hotfix_ROLLBACK.sql` are the active-chain
security hotfix migration and its rollback script, moved out of
`supabase/migrations/` during baseline recovery (see
`DARTMN_SUPABASE_BASELINE_REPORT.md`, "Security hotfix reconciliation").
The hotfix's effects are already baked into the baseline migration —
re-applying it after the baseline would be redundant (and for some
statements, a no-op that's harmless; for others, e.g. the `REVOKE ... FROM
PUBLIC, anon, authenticated` grants, applying it twice is harmless too, but
there is no reason to carry it in the active chain once its state is part
of the baseline).

## Rules

- **Do not** apply any file in this directory (or `security/`) to any
  database, ever.
- **Do not** add new files here going forward — this is a one-time capture
  of pre-baseline history, not a place for new archived work.
- If you need to understand *why* a particular column/table/function
  exists, these files are useful forensic history. If you need to
  *reproduce* the schema, use `supabase/migrations/` only.
