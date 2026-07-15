# Supabase project tooling

This directory adopts the [Supabase CLI](https://supabase.com/docs/guides/local-development)
so database schema changes become **version-controlled, ordered migrations**
instead of being applied ad-hoc to the live project and hand-mirrored into
`db/*.sql`.

- **Project ref:** `ohnsawydclmsrgphasbn` (Gakuenza.com, region `ap-northeast-1`)
- `config.toml` — CLI project config (scaffolded by `supabase init`).
- `migrations/` — ordered migration files (see "Materialize the baseline").

## Current state (2026-07-15)

The live database already tracks **21 applied migrations** in
`supabase_migrations.schema_migrations` (run `supabase migration list` once
linked to see them). However, the **base schema predates migration tracking**
(the project was created 2026-07-06; the first tracked migration is
2026-07-14), so the migration ledger alone cannot rebuild the DB from zero —
the original tables/functions/policies were never captured as a migration.

The `db/*.sql` files at the repo root are the legacy hand-written mirrors of
individual changes (including this session's cron / retire / RLS-scope work).
They remain as human-readable history; `migrations/` supersedes them going
forward.

## Materialize the baseline (one-time, needs DB credentials)

`supabase db pull` introspects the remote and writes a single migration that
captures the current schema, then reconciles the local/remote ledgers. It
needs the database password (or a pooler connection string) and a Supabase
access token — neither is available in the CI/agent sandbox this scaffold was
created in, so run it locally:

```bash
export SUPABASE_ACCESS_TOKEN=<personal access token>   # supabase.com/dashboard/account/tokens
supabase link --project-ref ohnsawydclmsrgphasbn        # prompts for the DB password
supabase db pull                                        # writes migrations/<ts>_remote_schema.sql
```

After that, `supabase/migrations/` is the complete, replayable source of
truth and `supabase db reset` can rebuild a local copy from scratch.

## Going-forward workflow

Do NOT apply schema changes by hand anymore. Instead:

```bash
supabase migration new <name>     # create migrations/<ts>_<name>.sql
#   ...edit the SQL...
supabase db push                  # apply pending migrations to the linked remote
```

For local iteration, `supabase start` (Docker) runs a full local stack and
`supabase db reset` replays every migration against it — validate there before
`db push` to production, which holds real student data.

## Notes

- Leaked-password protection (HaveIBeenPwned) is an **Auth** setting, not
  schema — enable it in Dashboard → Authentication → Policies. It cannot be
  set via SQL/migrations.
- The weekly `gradebook_snapshots` rollup runs via `pg_cron`
  (`cron.schedule('weekly-gradebook-snapshot', ...)`), installed this session.
  `pg_cron` jobs live in the `cron` schema, not in `public`, so `db pull` will
  not capture the schedule — re-create it from
  `db/2026-07-15_cron_gradebook_snapshots.sql` if rebuilding from zero.
