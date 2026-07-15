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

The production migration ledger (`supabase_migrations.schema_migrations`) tracks
**exactly one** migration:

```
20260715044642_fix_schools_insert_returning_for_platform_admin
```

Everything else — the **entire base schema** (tables, RLS policies, helper
functions, triggers, views; project created 2026-07-06) **and** every change
recorded under `db/*.sql` — was applied directly via the dashboard / management
API / `execute_sql`, which does **not** write to the ledger. So the ledger alone
cannot rebuild the database, and `db/*.sql` is a hand-kept mirror that nothing
enforces against production (see `docs/codebase-and-db-structure.md` §5).

**Adopting migrations therefore needs a one-time baseline snapshot** of the
current production schema. Until that exists, `migrations/` stays empty and
`db/*.sql` remains the human-readable pre-adoption history.

## Materialize the baseline (one-time, needs DB credentials)

`supabase db pull` introspects the remote with `pg_dump`, writes a single
`migrations/<ts>_remote_schema.sql` capturing the full current schema, and
reconciles the local/remote ledgers so nothing tries to replay history against
production. It needs the DB password and an access token — **neither is
available in the CI/agent sandbox** — so run it locally:

```bash
cp supabase/.env.example supabase/.env.local   # then fill in the two values
export SUPABASE_ACCESS_TOKEN=...                # from .env.local
supabase link --project-ref ohnsawydclmsrgphasbn   # prompts for the DB password
supabase db pull                                # writes migrations/<ts>_remote_schema.sql
git add supabase/migrations && git commit -m "Baseline: capture production schema"
```

After that, `migrations/` is the complete, replayable source of truth and
`supabase db reset` can rebuild a local copy from scratch.

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
