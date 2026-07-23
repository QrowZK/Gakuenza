# Gakuenza — Operations & Ownership Runbook

The owner's runbook. Everything you need to keep Gakuenza running as a
free service for the schools that use it, and to hand it to someone else
if you ever stop.

- **What is this system?** → `docs/PROJECT_HANDBOOK.md` (architecture,
  data flow, roles, glossary). Read that first if you're new.
- **How do I stand up a new school?** → `docs/second-school-onboarding.md`
  (step-by-step, non-engineer-followable). This file only summarizes.
- **Where do the live numbers live?** → PROJECT_HANDBOOK §11 is the single
  home for counts (tables, modules, migrations). This file avoids repeating
  them so they can't drift.

Last verified against the live project: **2026-07-23**.

---

## 0. TL;DR — the service in one breath

A static site on DreamHost (`gakuenza.com`) talks directly to a Supabase
Postgres from the browser using the public anon key. **Row-Level Security
(RLS) is the entire security boundary** — there is no application server.
Pushing to `main` on GitHub deploys the site automatically. Schema and the
five privileged Edge Functions are deployed separately, by hand, through
Supabase. There is no build step and no runtime you pay for per-request.

**If you do nothing else, do these:** keep the four accounts in §1 alive,
keep the Supabase project off the "paused" state (§6), and don't hand the
`is_platform_admin` flag or the `service_role` key to anyone (§4, §8).

---

## 1. What you own — the four accounts that ARE the service

Losing any one of these takes the service down. Keep the logins somewhere
your successor can reach (a password manager entry you can transfer).

| # | Account | Holds | If lost |
|---|---------|-------|---------|
| 1 | **Domain registrar** for `gakuenza.com` | DNS → points at DreamHost | Site becomes unreachable; renew on time |
| 2 | **DreamHost** (shared hosting/SFTP) | The static files that get rsync'd | Site 404s; re-deploy needs the SSH target |
| 3 | **Supabase** (org `twkogefkpvbwwplwrsfn`, project `Gakuenza.com` / ref `ohnsawydclmsrgphasbn`, region ap-northeast-1) | The database, auth, storage, edge functions — **all real data** | Total data loss if the project is deleted; this is the crown jewel |
| 4 | **GitHub** (`QrowZK/Gakuenza`) | Source of truth, deploy pipeline, automations | Deploys stop; code history at risk if the repo is deleted |

There is also an **Anthropic Claude subscription** wired to the GitHub
Actions automations (§9) via the `CLAUDE_CODE_OAUTH_TOKEN` secret — optional
to the running service, but the bug-triage/spec-builder workflows go dark
without it.

---

## 2. Deploy — how code goes live

**Frontend (the static site).** Merge to `main` → the
`Deploy to DreamHost` GitHub Action (`.github/workflows/deploy.yml`) rsyncs
`gakuenza.com/` to the host. **Only `gakuenza.com/` deploys** — `docs/`,
`db/`, `supabase/`, and repo-root files are outside the rsync SOURCE and
never ship. `rsync --delete` is used, so a file removed from
`gakuenza.com/` in git is removed from the live site too.

- **Verify a deploy:** GitHub → Actions → the run for your merge commit is
  green. Then hard-reload `https://gakuenza.com` and spot-check the page you
  changed.
- **Roll back:** `git revert` the bad commit (or merge a revert PR) — the
  revert lands on `main` and re-deploys. There's no separate "release."
- **Known-benign failure:** an occasional `Deploy to DreamHost` failure is a
  transient SSH/rsync timeout to DreamHost, not a code problem. Re-run the
  job; if it goes green, nothing else is needed (seen and confirmed benign
  on the #95 merge, 2026-07-17).

**Schema and Edge Functions do NOT deploy on push** — see §5 and §7.

---

## 3. Secrets — where they live (never in git)

All deploy secrets are **GitHub → repo Settings → Secrets and variables →
Actions**. Never commit any of these; the site ships the *anon* key only,
which is safe to be public because RLS gates every row.

| Secret | Used by | What it is |
|--------|---------|-----------|
| `SSH_PRIVATE_KEY`, `REMOTE_HOST`, `REMOTE_USER`, `REMOTE_TARGET` | `deploy.yml` | DreamHost SFTP deploy target |
| `CLAUDE_CODE_OAUTH_TOKEN` | the three automation workflows (§9) | Claude subscription auth (NOT API billing) |

**Supabase keys** live in the Supabase dashboard (Project Settings → API),
not GitHub:

- **anon key** — embedded in the shipped frontend (`gakuenza.com/hub/…`).
  Public by design. Safe because RLS.
- **`service_role` key** — bypasses RLS entirely. It exists **only** inside
  the Edge Functions runtime, injected automatically by Supabase. It must
  never appear in the frontend, in git, or in a browser. If it ever leaks,
  rotate it immediately (Supabase dashboard → API → roll key) and redeploy
  the Edge Functions.

---

## 4. The two things that must never happen

These are load-bearing security invariants. Both have a real, previously-
exploitable P0 behind them (see CLAUDE.md).

1. **Never `GRANT UPDATE ON public.profiles` at the table level.** That
   re-includes the `is_platform_admin` column and lets any school admin
   escalate to full platform control via a REST PATCH. Table-level UPDATE
   was revoked and re-granted column-by-column (excluding
   `is_platform_admin`) in migrations `20260717040743` / `20260717040949`.
   The flag is set only via migration or `service_role`.
2. **Never expose the `service_role` key to the client** (§3). Every
   privileged operation goes through an Edge Function that checks the
   caller's authorization first.

When creating a new table in a migration, also `REVOKE TRUNCATE` (and audit
table-level `UPDATE`) from `anon, authenticated` — Supabase re-grants these
by default and `TRUNCATE` bypasses RLS (CLAUDE.md; migration `20260717041107`
had to clean this up for the kadaiban tables).

---

## 5. Database & migrations

- **Project:** ref `ohnsawydclmsrgphasbn`, Postgres 17, region
  ap-northeast-1 (Tokyo — closest to the schools).
- **Schema changes go through `supabase/migrations/`** (see
  `supabase/README.md`). The prod ledger
  (`supabase_migrations.schema_migrations`) is reconciled with that folder.
  - Agent/CI session: apply via the Supabase MCP `apply_migration` (it writes
    the ledger) **and** commit the matching
    `supabase/migrations/<ts>_<name>.sql` in the same PR.
  - CLI session: `supabase migration new` + `supabase db push`.
  - **Never** apply schema via `execute_sql` or the dashboard SQL editor —
    that bypasses the ledger and creates untracked drift.
- **`db/` is a documentation mirror, not an applied migration set.** A file
  existing there does NOT mean it ran. Verify real state against the live DB
  or `docs/codebase-and-db-structure.md`.
- **Backups:** Supabase takes automated daily backups on the project's plan.
  Before any risky migration, take a manual backup / snapshot from the
  dashboard (Database → Backups) so you have a known-good restore point.

---

## 6. Keeping Supabase alive

The single most important recurring task.

- **Don't let the project pause.** Free-tier projects pause after a week of
  inactivity; a paused project = the whole service is down until you restore
  it (Supabase dashboard → Restore). During school terms real traffic keeps
  it warm, but over long breaks (summer, winter) usage drops to near zero —
  check the dashboard occasionally during breaks and restore/unpause if
  needed. (Summer 2026's near-zero drill activity is the expected seasonal
  lull, not a fault.)
- **Watch cost/quota.** From the dashboard's usage page — database size,
  monthly active users, storage (the two kadaiban buckets), and Edge
  Function invocations. The workload is tiny (one pilot school), so this
  should stay well within limits; glance at it when onboarding a new school.

---

## 7. Edge Functions — the only privileged code

Five functions, all in `supabase/functions/<name>/index.ts`. They hold the
`service_role` key and each independently authorizes the caller. They deploy
**separately from the site** — a git push does NOT update them.

| Function | verify_jwt | Purpose |
|----------|:---:|---------|
| `provision-account` | yes | Create student/teacher/admin/**coordinator** accounts (admin-gated) |
| `update-student` | yes | Edit a student (name, number, password reset) |
| `update-teacher` | yes | Edit a teacher/staff member |
| `student-login` | **no** (public) | Resolve `{class, number, password}` → session (this IS login) |
| `report-bug` | **no** (public) | Staff bug button → `bug_reports` table → automation (§9) |

**Deploy a change** (after editing the `index.ts`):

- Agent/MCP session: Supabase MCP `deploy_edge_function`.
- CLI session: `supabase functions deploy <name>` — and for the two public
  ones, `--no-verify-jwt` is required (they take no auth header):
  `supabase functions deploy student-login --no-verify-jwt`.

**Keep the source in git.** These are the only files where a lost local copy
means reverse-engineering deployed code (it happened once —
`update-teacher`/`student-login` sources had to be recovered). The committed
`supabase/functions/` tree is the source of truth; deploy from it.

---

## 8. Onboarding a school & managing accounts

Full runbook: **`docs/second-school-onboarding.md`**. In brief:

1. Create the `schools` row (admin UI: `hub/admin/schools.html`,
   platform-admin only).
2. Create classes (`hub/admin/class-detail.html`).
3. Create staff and students — the admin console calls `provision-account`.
   Students log in with `{school → year → class → 出席番号 + password}`;
   teachers/coordinators/admins log in with email + password.

**Hard rule for real schools:** leave `profiles.home_school_id` **NULL** for
students. Real schools number students per-class, and setting
`home_school_id` hits a duplicate-key violation the moment two classes both
have a "#1". Only synthetic/demo schools have it set. (Full explanation in
the onboarding doc and CLAUDE.md.)

**Roles** (least → most power): student → educator → coordinator →
school_admin → platform_admin. Only platform admins act across schools and
can set `is_platform_admin`. Keep the platform-admin circle to yourself and
whoever you trust to run the whole service.

---

## 9. The GitHub automations (optional, subscription-backed)

Three workflows, all authing with the Claude **subscription** via
`CLAUDE_CODE_OAUTH_TOKEN` (not API billing). Full reference:
`docs/bug-report-automation.md`.

| Workflow | Trigger | Does |
|----------|---------|------|
| `auto-build-module.yml` | a spec in `docs/specs/pending/` | Builds the module, opens a PR, moves the spec to `completed/` |
| `bug-diagnose.yml` | a `user-report` issue (from the in-app bug button) | Investigates, comments — never opens a PR |
| `bug-autofix.yml` | the human-added `approved-for-autofix` label | Attempts a fix, PR-only |

They open PRs; they never push to `main` directly, so a human always reviews
before anything deploys. **To turn them off:** disable the workflows in
GitHub → Actions, or remove the `CLAUDE_CODE_OAUTH_TOKEN` secret. The service
runs fine without them — they're a maintenance convenience, not a dependency.

---

## 10. Monitoring & health checks

No paging, no dashboards to run — just periodic glances:

- **Site up?** Load `https://gakuenza.com` and log in as a test student.
- **Deploys green?** GitHub → Actions.
- **DB advisors:** Supabase dashboard → Advisors (or MCP `get_advisors`).
  Re-check after any schema change. **Current known, accepted findings**
  (2026-07-23), so they don't alarm your successor:
  - The `app_*` RLS helper functions are `SECURITY DEFINER` and callable via
    RPC by `anon`/`authenticated`. **Intended** — they only ever return the
    caller's own scope and are the backbone of the RLS policies.
  - Two `security_definer_view` ERRORs on `public_classes` / `public_schools`
    (the pre-login school/class pickers). Deliberately readable pre-auth;
    revisit if you ever move to `security_invoker` views.
  - `bug_reports` has RLS enabled with no policy — writes come only via the
    `report-bug` Edge Function (`service_role`), so no client policy is
    needed; reads are admin-side.
  - Leaked-password protection (HaveIBeenPwned) is off — fine for young
    students on synthetic passwords; consider enabling for staff.
- **Logs:** Supabase dashboard → Logs (Postgres, Auth, Edge Functions), or
  MCP `get_logs`, when chasing a specific failure.

---

## 11. Incident response — common failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Whole site/data down, dashboard says "paused" | Free-tier inactivity pause (§6) | Restore/unpause in the Supabase dashboard |
| `Deploy to DreamHost` failed | Transient SSH timeout to DreamHost (§2) | Re-run the job; green = done |
| A student/teacher can't see their class data | RLS scope / missing enrollment or `school_members` row | Verify the enrollment/membership; resolve context via `enrollments → classes.school_id`, never `home_school_id` |
| "duplicate key" when importing students | `home_school_id` was set on a real-school student (§8) | Leave it NULL; clear it |
| Login broken after an auth change | Edge Function or auth policy change | Check `student-login` logs; it must stay deployed `--no-verify-jwt` |
| A page's buttons look wrong/full-width | A module linked the shared root `style.css` | Module `style.css` must be self-contained (CLAUDE.md rule 1) |

---

## 12. Bus-factor / handoff checklist

To hand this to someone else and walk away:

- [ ] Transfer or share logins for the four accounts in §1 (registrar,
      DreamHost, Supabase, GitHub).
- [ ] Add them as a **platform admin** (a trusted person sets
      `profiles.is_platform_admin = true` via migration/`service_role`) so
      they can run the admin console across schools.
- [ ] Add them as a GitHub repo admin so they can merge and manage Actions.
- [ ] Point them at this file, then `PROJECT_HANDBOOK.md`, then
      `second-school-onboarding.md`.
- [ ] Confirm they can do one full loop: deploy a trivial site change, apply
      a no-op migration, and provision a test account.
- [ ] Decide whether to keep the Claude automations (§9) — hand over the
      `CLAUDE_CODE_OAUTH_TOKEN` or disable the workflows.

The service is deliberately cheap and low-touch: a static site, a managed
Postgres, and five small functions. Kept alive (§6) and left un-messed-with
(§4), it runs itself.
