# eigo5 / nh5 — 外国語 5年 (English) — new module build spec

**Issue/roadmap:** MODULE_ROADMAP §3.6. **Status:** ready to build.
Closes the last 外国語 grade gap (nh6 already covers grade 6).

> **Placement note.** In `docs/specs/` (not `pending/`) — hand-assigned to an
> isolated-worktree subagent, matching every prior module wave. Do NOT drop this
> into `pending/` unless the owner wants the unattended spec-builder to fire.

## Module identity
Directory `modules/eigo5/`, key `eigo5`, subject `'english'`,
launch_url `/modules/eigo5/index.html`, name `外国語 5年`, recommended_grades `[5]`.
Grade-5 外国語 in Hakui is **New Horizon Elementary 5 (東京書籍)** — same series
as nh6.

## Design decision to resolve up front
Two viable patterns already exist in the repo — **pick the native generator**
unless there's a strong reason to port:
- **Native vocab/phrase generator (recommended for a fresh build).** A
  nhvocab-style native drill over grade-5 外国語 target vocabulary and key
  sentence patterns, reporting through `HubCommon.reportActivityWithItems` from
  the start. Cleaner than the ported apps — several of those hand-roll the
  `activity_results` insert and are missing item-level rows (CLAUDE.md hard
  rule 2, the exact hole to avoid).
- **Ported-app pattern** (nh6/nhvocab/eiken/letstry1/2): heavier; reuses an
  upstream engine with a report shim. Only if porting a real New Horizon 5 app —
  follow `nh6/README.md` and re-point it at the shared session + `activity_results`.

## Grade-5 外国語 target skills (New Horizon Elementary 5 unit arc — verify against current edition)
Self-introduction/spelling · months & birthdays · subjects & timetable (What do
you want to study) · daily schedule & time (What time do you…) · can/can't
(abilities) · locations & directions (Where is…) · food & prices (What would you
like) · describing a person/hero (Who is…). Build vocabulary + sentence-pattern
drills around these; keep to listening/reading-recognition and word/phrase-choice
question shapes that fit a text drill (this grade is heavily oral in class — the
module supplements, does not replace, that).

## Design
Self-contained `style.css` (hard rule 1 — copy token values literally, never link
root `style.css`). Zen Maru Gothic for display text. Furigana/large targets as
appropriate for 10–11-year-olds.

## Distractor-collision cautions
- **Vocab multiple-choice:** a distractor gloss must never also be a correct
  translation of the prompt word (synonym leakage — e.g. "行く" for both *go* and
  a near-synonym).
- **Sentence-pattern fill-ins:** ensure only one option is grammatical/correct in
  context.

**Standard-scale stress-test** each generator (hundreds–thousands of instances).

## Reporting (hard rule 2 — do NOT repeat the ported-app mistake)
`HubCommon.reportActivityWithItems(sb, {schoolId, classId, moduleId, userId,
activityRef, score, maxScore, payload, items})` with populated `items` from the
start. Never hand-roll the `activity_results` insert. Resolve context via
`enrollments → classes.school_id`, never `profiles.home_school_id` (hard rule 3).

## units.js (optional — English modules aren't unit-scoped today)
If added, ship `modules/eigo5/units.js` self-registering
`window.MODULE_UNITS.eigo5` with a key per New Horizon 5 unit
(`u01_hello`…`u08_hero`), matching internal keys. Otherwise ship **no** `units.js`
at all (its file 404s → `[]`, `focus_units` stays null = all units). **There is
NO shared registry — never edit a common file (deleted in #99); do not recreate
it.**

## Registration migration (hard rule 5 — idempotent)
Update-then-insert-if-absent into `modules`: `key='eigo5'`, `subject='english'`,
`launch_url='/modules/eigo5/index.html'` (absolute — hard rule 4),
`name='外国語 5年'`, `recommended_grades='{5}'`, `publisher='東京書籍'`,
`is_active=true` set explicitly. Apply via MCP `apply_migration` (writes the prod
ledger) **and** commit the matching `supabase/migrations/<ts>_register_eigo5.sql`
in the same PR. Never `execute_sql`/dashboard.

## Testing bar
- **Generators:** stress-test at scale for structural bugs AND distractor
  collisions (a "wrong" option secretly also correct).
- **Flow test:** real headless-browser run through the quiz flow, asserting
  `reportActivityWithItems` was called correctly and `activity_result_items`
  got populated.
- **Migration:** idempotency (run twice, no duplicate row), correct
  `is_active`/`subject`/`launch_url`.

## Copyright (ELEVATED care — §4)
New Horizon 5's dialogues, passages, and character-specific content ARE
copyrighted expression. Build **original** vocabulary and sentence-pattern items
testing the same target language; **never** reproduce the textbook's dialogues,
story text, character names, or specific example sentences. Seeing the source
during research does not make it safe to use — build from the target-skill
structure only.
