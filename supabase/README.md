# Supabase project tooling

This directory adopts the [Supabase CLI](https://supabase.com/docs/guides/local-development)
so database schema changes become **version-controlled, ordered migrations**
instead of being applied ad-hoc to the live project and hand-mirrored into
`db/*.sql`.

- **Project ref:** `ohnsawydclmsrgphasbn` (Gakuenza.com, region `ap-northeast-1`, Postgres 17)
- `config.toml` — CLI project config (from `supabase init`). Drives the **local**
  stack and `supabase config push`; it is *not* an authoritative mirror of the
  production Auth settings (those are managed in the dashboard).
- `migrations/` — ordered migration files. Empty until the baseline is
  materialized (see below).
- `seed.sql` — local-only fixtures loaded by `supabase db reset`. Never runs
  against production.
- `.env.example` — the credentials the CLI needs; copy to `.env.local` (git-ignored).

## Current state (2026-07-15)

`migrations/` and the production ledger (`supabase_migrations.schema_migrations`)
are reconciled — two tracked migrations, two files, nothing pending:

```
20260706000000_remote_schema                              ← squashed baseline
20260715044642_fix_schools_insert_returning_for_platform_admin
```

**Origin of the baseline.** The base schema (tables, RLS, helper functions,
triggers, views; project created 2026-07-06) and every `db/*.sql` change were
originally applied via the dashboard / management API / `execute_sql`, which
does **not** write to the ledger, so only the schools-fix was tracked. On
2026-07-15 the full current schema was captured into
`20260706000000_remote_schema.sql` by **introspecting the live DB through the
Supabase MCP** (`pg_catalog` / `pg_get_*def`) — not `pg_dump` — and the baseline
version was inserted into the ledger as already-applied so `supabase db push`
never tries to replay it against production. `db/*.sql` remains the
human-readable pre-adoption history; `migrations/` supersedes it going forward.

> **Verify the baseline before relying on a from-zero `db reset`.** The baseline
> is a hand-assembled snapshot, not `pg_dump` output. It replays cleanly for the
> high-risk parts (all 28 RLS policies + both views were create-tested against
> the live tables/functions and rolled back), but when you next have DB
> credentials, run `supabase db pull` on a throwaway/preview branch and diff it
> against the committed baseline to confirm nothing was missed (grants,
> defaults, extension placement). Treat any diff as authoritative. The baseline
> file header carries the same caveat and lists what is intentionally excluded
> (the `cron` schedule, Supabase-managed schemas/event triggers).

## Going-forward workflow — do NOT hand-apply schema changes anymore

**Local / human (preferred, with the CLI):**

```bash
supabase migration new <name>   # creates migrations/<ts>_<name>.sql
#   ...edit the SQL...
supabase start                  # optional: local stack (Docker)
supabase db reset               # replay every migration locally to validate
supabase db push                # apply pending migrations to production
```

**Agent / CI sessions (no CLI, only the Supabase MCP):** apply DDL with the MCP
`apply_migration` tool — it records the change into the production ledger — and
in the **same PR** commit an identical `supabase/migrations/<ts>_<name>.sql`
file so the repo and the ledger stay in lockstep. Do not use `execute_sql` for
schema changes; it bypasses the ledger (that is exactly how the untracked
history above accumulated).

Either way: production holds real student data — validate against a local
`db reset` (or a Supabase preview branch) before pushing.

## Notes

- **Leaked-password protection** (HaveIBeenPwned) is an **Auth** setting, not
  schema — enable it in Dashboard → Authentication → Policies. It cannot be set
  via SQL/migrations.
- The weekly `gradebook_snapshots` rollup runs via **`pg_cron`**
  (`cron.schedule('weekly-gradebook-snapshot', ...)`). `pg_cron` jobs live in
  the `cron` schema, not `public`, so `db pull` will **not** capture the
  schedule — re-create it from `db/2026-07-15_cron_gradebook_snapshots.sql` if
  rebuilding from zero.
- Edge Functions live under `supabase/functions/` and deploy independently of
  migrations (`supabase functions deploy <name>` or the MCP `deploy_edge_function`).
