# CLAUDE.md — Gakuenza

Standing context, loaded automatically at the start of every session in
this repo. This is not a one-time briefing — treat every rule here as
currently true and load-bearing, not historical trivia.

## What this is

Static-frontend learning platform for Japanese elementary schools
(pilot: 羽咋市立瑞穂小学校, Hakui City, Ishikawa). No build step, no
framework — plain HTML/CSS/JS. Backend is Supabase (Postgres + RLS +
Auth + Edge Functions). The browser talks to Postgres directly via the
public anon key; **RLS is the real security boundary, not client
code.** Deploy is GitHub → Actions → rsync to DreamHost on push to
`main` — commits here go live without further manual steps once
merged.

## Module directory convention

```
gakuenza.com/modules/<key>/
├── index.html
├── <content/generator files>.js
├── <key>-report.js
└── style.css   — fully self-contained, see rule below
```

## Hard rules — each backed by a real shipped bug, not a style preference

1. **Every module's `style.css` copies token values literally and
   never links the shared root `style.css`.** The shared stylesheet's
   generic `button { width:100% }` rule has broken production four
   separate times when a zone depended on it instead of being
   self-contained. Standard tokens to copy:
   ```css
   --ink: #1c2530; --ink-soft: #3a4555; --paper: #f7f3ea;
   --paper-dim: #efe9db; --border: #d8d2c2; --moss: #4a6b4f;
   --moss-deep: #34503a; --moss-tint: #e8ede6; --gold: #c9a24b;
   --clay: #b5572e; --error: #a23b2e;
   ```
   Font: Zen Maru Gothic for display text.

2. **Always use `HubCommon.reportActivityWithItems(sb, {schoolId,
   classId, moduleId, userId, activityRef, score, maxScore, payload,
   items})` for reporting. Never hand-roll the `activity_results`
   insert.** At least three modules in this project did, got the
   column names right, but never wrote to `activity_result_items` —
   meaning the gradebook's per-question analysis has nothing to show
   for them. Live, unfixed, don't repeat it.

3. **Resolve a student's context via `enrollments → classes.school_id`
   — never `profiles.home_school_id`.** That column is real (used in
   the `profiles_read` RLS policy) but is not the right source for a
   module's active class/school context. Caught mid-build once
   already (kokugo3); don't rediscover it.

4. **`launch_url` in any module registration migration is always
   absolute** (`/modules/<key>/index.html`). Relative paths have
   broken registration multiple times.

5. **Registration migrations are idempotent** — update-then-insert-
   if-absent, `is_active = true` set explicitly even though the
   column defaults to true, `subject` matching the real CHECK
   constraint on `modules`.

## Schema notes worth knowing before touching module-adjacent tables

- `class_modules.focus_units` (jsonb) and `modules.recommended_grades`
  (int[]) are **real columns with zero current consumers** — no
  module reads or writes either yet. Building a module that honors
  `focus_units` (foreground listed units, fail soft to "all units" on
  null/malformed) is establishing that pattern, not following one.
- A file called `module-units.js` is referenced in some project
  documentation but does not exist anywhere in this codebase as of
  this writing — verify directly before assuming it exists or trying
  to import it.
- `modules.is_active` genuinely defaults to `true` at the column
  level — the earlier fear that an unset module is invisible by
  default was wrong — but set it explicitly anyway, it's convention.

## Copyright — "reference, don't reproduce"

Every module built against a real textbook builds original content
testing the same skills/facts/structure as the real curriculum unit —
**never** the textbook's actual passages, specific problems, diagrams,
or exact wording, even when the structural pattern gets close to the
source. Prefer independently-verifiable facts (general knowledge,
science, official curriculum structure) over anything that could only
have come from the copyrighted material itself. Seeing copyrighted
text during research does not make it safe to use — build from
structural/factual knowledge only regardless of what turned up in
search.

## Testing bar

- **Generators**: stress-test at real scale (hundreds–thousands of
  generated instances), checking programmatically for structural bugs
  AND the subtler distractor-collision bug (a "wrong" option that's
  secretly also correct). This project's own kanji generator shipped
  this twice — don't assume clean from a handful of manual examples.
- **Flow test**: real headless-browser test through the actual quiz
  flow, asserting the shared reporting helper was called correctly
  and `activity_result_items` actually got populated.
- **Migration**: idempotency (run twice, no duplicate row), correct
  `is_active`/`subject`/`launch_url`.

## Known, currently-unresolved things — don't be surprised by them,
## not your job to fix incidentally

- The admin console (`hub/admin/*.html`) still loads the shared root
  `style.css` with no defense against the button-width bug.
- Educator-facing module assignment doesn't exist yet — admin console
  only, as of this writing.

## For automated/headless runs specifically

If you're running unattended (GitHub Actions), your job is to **build
against an already-written spec in `docs/specs/pending/`**, not to
invent scope. Open a PR, do not push directly to `main`. Move the spec
file from `docs/specs/pending/` to `docs/specs/completed/` as part of
the same PR so it doesn't get picked up again. If the spec is
ambiguous or you'd need to make a real judgment call beyond what it
specifies, stop and note that in the PR description rather than
deciding unilaterally.
