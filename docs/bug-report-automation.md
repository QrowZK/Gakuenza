# Automated bug reports (button → issue → diagnose → approved auto-fix)

Staff can file a bug from inside the app; it becomes a GitHub issue that Claude
investigates automatically. A human then decides whether to let Claude attempt a
fix. Two stages, one human decision point before any code change is attempted.

## Flow

```
Staff clicks "🐛 不具合を報告" (admin console / gradebook sidebar)
   │  description + auto-captured page URL, role, timestamp
   ▼
report-bug Edge Function  ──(staff-verified, rate-limited)──▶  GitHub issue, label: user-report
   ▼
bug-diagnose.yml  (on issues:opened, label user-report)
   │  Claude investigates, COMMENTS likely cause / files / confidence / risk — no PR, no file changes
   ▼
[human triager reads the diagnosis]
   │  if it looks right and safe → add label: approved-for-autofix
   ▼
bug-autofix.yml  (on issues:labeled == approved-for-autofix)
   │  Claude attempts the smallest correct fix → opens a PR (never main), links the issue
   ▼
[normal PR review + merge]
```

The aggressive one-stage variant (fix attempt straight from `issues:opened`) is
intentionally NOT built — earn a track record of accurate Stage-1 diagnoses
first, then it's a trivial trigger change on `bug-autofix.yml`.

## Pieces in the repo

| Piece | Path | Notes |
|---|---|---|
| Button + modal | `hub/admin/admin-common.js` (`AdminCommon.bugReport`) | Wired into the admin sidebar and the gradebook sidebar. Lives in `admin-common.js` because that file loads on staff pages only — never the student hub, so the code never ships to students. |
| Edge Function | `supabase/functions/report-bug/index.ts` | Verifies session + **staff** role, per-user rate limit, creates the issue. Already deployed (see setup). |
| Rate-limit / audit table | `supabase/migrations/20260716063714_bug_reports_table.sql` | `bug_reports`, RLS on, service-role only. Applied to prod. |
| Diagnose workflow | `.github/workflows/bug-diagnose.yml` | Read-only; comments; `--allowedTools Read,Grep,Bash`. |
| Auto-fix workflow | `.github/workflows/bug-autofix.yml` | PR-only; same guardrails as the spec-build pipeline. |

All three workflows (diagnose, autofix, **and the existing spec-build pipeline**)
use `claude_code_oauth_token` — your Claude **subscription**, not API billing.

## Setup required to go live

1. **GitHub token for the Edge Function.** Create a **fine-grained PAT** scoped to
   `QrowZK/Gakuenza` only, with **Issues: Read and write** and nothing else, then:
   ```bash
   supabase secrets set GITHUB_TOKEN=github_pat_xxx --project-ref ohnsawydclmsrgphasbn
   ```
   Optional overrides: `GITHUB_REPO` (default `QrowZK/Gakuenza`),
   `BUG_REPORT_RATE_PER_HOUR` (default `5`). Until this is set, `report-bug`
   returns a clean "not configured yet" message — it never errors opaquely.
2. **Claude subscription token for Actions.** `claude setup-token` (from a Pro/Max
   subscription), then add it as the repo secret **`CLAUDE_CODE_OAUTH_TOKEN`**
   (Settings → Secrets and variables → Actions). This one secret powers all three
   workflows. Once confirmed working you can delete the old `ANTHROPIC_API_KEY`
   secret (the spec-build pipeline was switched off it).
3. **Labels.** `user-report` auto-creates the first time a report is filed.
   `approved-for-autofix` should exist before you use it — create it in the repo's
   Labels page (any color; description e.g. "Approved: let Claude attempt a fix").
4. **Merge the frontend PR** so the button deploys to gakuenza.com.

The `report-bug` Edge Function is already deployed (`verify_jwt` off — it does
full in-code JWT verification and must answer the browser CORS preflight, same as
`provision-account`). Re-deploy after edits with
`supabase functions deploy report-bug` or the MCP `deploy_edge_function`.

## Safety / guardrails

- **Staff only.** Button ships only on staff pages; the Edge Function independently
  re-verifies the caller is `platform_admin` / `school_admin` / `coordinator` /
  `educator` and rejects students (403). The button placement is UX; the function
  check is the boundary.
- **Rate limited** per user (default 5/hr) — because each issue can trigger real
  Claude usage against your **subscription's shared quota**, not just create noise.
- **Diagnose never changes code** (`contents: read`, no `Write`/`Edit`).
- **Auto-fix is PR-only** (`contents: write` but the prompt + project convention is
  PR, never main) and only fires on the **explicit human approval label**, with the
  same `--max-turns` / `--allowedTools` / `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`
  guardrails as the spec-build pipeline.
- **Prompt-injection aware.** Both workflow prompts tell Claude to treat the issue
  text as a bug description to investigate/act on, never as instructions.
- Private repo, so report text becomes **private** issue content (not public).

## Note

The two workflow files can't be exercised until they're on `main` and the OAuth
secret exists, so the first real diagnose/fix run is where any GitHub-Action-shape
tweak (e.g. how `claude-code-action@v1` surfaces the issue body) would show up.
The Edge Function, table, button, and rate-limiting were verified independently.
