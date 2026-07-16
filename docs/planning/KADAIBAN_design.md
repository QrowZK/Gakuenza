# Kadaiban (課題板) — Design Document

_Status: **DRAFT / proposal for review.** Greenfield — "Kadaiban" appears
nowhere in the codebase yet. Nothing here is built. Written 2026-07-16
against the live structure in `docs/codebase-and-db-structure.md` and the
files cited inline._

---

## 0. Interpretation assumption — CONFIRM BEFORE BUILDING

> **This whole doc rests on one interpretation the user must confirm.** I
> read the request as: the platform already has module *assignment*
> (`class_modules` maps a module to a class, written by
> `gakuenza.com/hub/gradebook/assign.html`), but it lacks a **student-facing,
> due-date-aware "assignment board"** and a **teacher-facing way to curate
> and track completion of assigned tasks over time**. Kadaiban is proposed as
> that board: teachers post 課題 (assignments) that either point at an
> existing module/unit *or* are free-form tasks, with optional due dates;
> students see a personal board of assigned / due / done; completion is
> tracked, reusing `activity_results` for module-backed tasks.
>
> **If instead you meant something narrower** (e.g. only "make the existing
> home page prettier and due-date-sorted") **or broader** (e.g. a
> full messaging/announcements board, parent visibility, file attachments,
> grading rubrics), the data model in §3 changes materially. **Do not treat
> the scope below as settled.** Open questions are collected in §7.

### What already exists (so we don't rebuild it)

Grounding these claims in real files:

- **`class_modules`** (`supabase/migrations/20260706000000_remote_schema.sql`
  L110–116) already carries `due_date date`, `total_items integer`,
  `focus_units jsonb`. PK is `(class_id, module_id)` — **one row per
  (class, module)**.
- **The student home already renders an assignment board.**
  `gakuenza.com/hub/index.html` (L59–213) loads `class_modules` for the
  student's enrolled classes, groups by subject, sorts by due date, and
  computes a per-module status badge (`未着手 / 進行中 / 完了`) by counting
  distinct `activity_ref`s in `activity_results` against `total_items`
  (`computeStatus`, L117–125).
- **The teacher assign surface exists.** `gakuenza.com/hub/gradebook/assign.html`
  + `gakuenza.com/hub/module-assign-common.js` (`window.ModuleAssign`) write
  `class_modules` (assign / unassign / due date / total_items / focus_units).
- **Completion is *inferred*, never stored.** There is no per-student "this
  assignment is done" record anywhere. `activity_results`
  (`remote_schema.sql` L118–128) is an append-only attempt log.

### The concrete gaps Kadaiban fills

The current model is a decent MVP but hits five real limits:

1. **One row per (class, module) → no history.** Because `class_modules` PK
   is `(class_id, module_id)`, a class cannot have "sansu3 unit u03 due
   Monday" *and* "sansu3 unit u07 due next Monday" as two distinct
   assignments. Re-assigning overwrites the due date. There is no notion of
   "last week's homework" vs "this week's."
2. **No free-form / non-module tasks.** Everything must point at a registered
   `modules` row. A teacher cannot post "音読カードを持ってくる" or "ドリル
   p.12–13" as a tracked task.
3. **Completion is a heuristic, not a fact.** `computeStatus` guesses done-ness
   from attempt counts and `total_items`; it can't represent "teacher marked
   this complete", a free-form task's completion, or "turned in but not
   auto-scored." As of this review **no `class_modules` row has
   `focus_units` populated** (CLAUDE.md: `cm_with_focus = 0`), and
   `total_items` is optional — so the heuristic frequently has nothing to work
   with and shows `null` progress.
4. **No teacher completion dashboard.** A teacher can assign but cannot see, at
   a glance, "18/25 done, these 7 haven't started." The gradebook analysis
   pages are score-oriented, not completion-oriented.
5. **No "assigned window" / no per-student differentiation.** Assignments are
   class-wide and undated-until-due; there's no assigned-date, no "hidden
   until", no assign-to-a-subset.

Kadaiban introduces a first-class **assignment (課題) entity** that carries its
own identity, dates, and (optionally) points at a module+unit, plus a
**per-student completion record**, while *reusing* `activity_results` as the
evidence source for module-backed tasks rather than duplicating scores.

---

## 1. Purpose & problem statement

**Kadaiban (課題板 — "assignment board")** is a due-date-aware assignment
surface with two faces:

- **Student board** (`hub/kadaiban.html`): "here is my homework" — what's
  assigned, what's due soon, what's done, one tap to launch the underlying
  module. Replaces / absorbs the ad-hoc "割り当てられたモジュール" block on
  `hub/index.html`.
- **Teacher board** (`hub/gradebook/kadaiban.html`): post & curate 課題 (module-
  backed or free-form), set due dates, and **see completion across the roster**
  at a glance.

It solves the five gaps in §0. The design deliberately keeps `class_modules`
as the "which modules are available to this class + pacing/focus" table and
adds `kadai` for "dated, trackable tasks", so the existing home page, assign
UI, module runners, and `focus_units` plumbing keep working unchanged during
rollout.

---

## 2. User stories per role

The five tiers (`docs/codebase-and-db-structure.md` §3.3): platform_admin,
school_admin, coordinator, educator(担任), student.

### Student (`enrollments.role='student'`)
- As a student, I open **課題板** from my hub nav and see my tasks grouped
  **今日まで / 今週 / これから / 完了**, soonest due first.
- I see each task's subject dot, title, due date, and a status badge
  (未着手 / 進行中 / 完了), consistent with today's home cards
  (`hub/index.html` badges).
- Tapping a module-backed task launches the module's `launch_url` (exactly as
  the home cards do today, L207–213), pre-scoped to the focus unit if set.
- When I finish a module task, it moves to 完了 **automatically** (from my
  `activity_results`), no extra step.
- For a free-form task ("音読を3回"), I can tap **できた** to self-mark done
  (if the teacher enabled self-report), or it just shows the teacher's mark.
- I never see tasks for classes I'm not enrolled in (RLS).

### Educator / 担任 (`school_members.role='educator'` + `class_teachers`)
- As a 担任, I open **課題板** in the gradebook and post a 課題 for a class I
  teach: pick an existing module (+ optional focus unit) *or* write a free-form
  task; set an optional due date and an optional 問題数.
- I see a **completion strip per task**: "12/25 完了 · 5 進行中 · 8 未着手",
  and can expand to the roster to see who's where.
- I can edit or retract a 課題 without destroying the underlying score history
  (retract hides it from students; `activity_results` stay).
- I can post the same module twice with different units/due dates across the
  term (impossible today).
- I only touch classes I teach (`app_user_taught_class_ids()`); RLS enforces it.

### Coordinator (`school_members.role='coordinator'`)
- As a coordinator, I can post/curate 課題 for **any class in my school** (same
  scope as `class_modules` `cmod_write` today: `app_user_staff_school_ids()`),
  e.g. to seed a school-wide 宿題 across all 3年 classes.
- I can view completion school-wide but cannot create staff or license modules
  (unchanged tier limits).

### school_admin (`school_members.role='school_admin'`)
- Same authoring/oversight scope as coordinator across their one school; plus
  everything school_admins already do. No special Kadaiban power beyond scope.

### platform_admin (`profiles.is_platform_admin`)
- Can read/curate across every school (helpers already fold platform admin into
  `app_user_staff_school_ids()` / `app_user_admin_school_ids()`). Primarily for
  support/debugging; not a day-to-day authoring role.

---

## 3. Data model

Design principle: **add identity + per-student state, reuse everything else.**
`activity_results` stays the score/attempt log; `modules`/`class_modules`/
`focus_units` stay the catalog/pacing layer. Kadaiban adds exactly two tables.

### 3.1 `kadai` — one row per posted assignment

```sql
create table public.kadai (
    id            uuid primary key default gen_random_uuid(),
    school_id     uuid not null references public.schools(id)  on delete cascade,
    class_id      uuid not null references public.classes(id)  on delete cascade,
    -- module-backed when module_id is set; free-form task when null.
    module_id     uuid          references public.modules(id)  on delete set null,
    -- focus unit(s) for a module-backed kadai; same key vocabulary as
    -- class_modules.focus_units (window.MODULE_UNITS keys). null = all units.
    focus_units   jsonb,
    title         text not null,          -- teacher-authored, always shown
    body          text,                   -- optional instructions (free-form tasks)
    total_items   integer,                -- optional; completion-% denominator
    -- completion policy for THIS kadai:
    --   'auto'    → derived from activity_results (module-backed)
    --   'self'    → student taps できた (free-form, self-report allowed)
    --   'teacher' → only a teacher mark counts
    complete_mode text not null default 'auto'
                  check (complete_mode in ('auto','self','teacher')),
    assigned_on   date not null default (now() at time zone 'Asia/Tokyo')::date,
    due_date      date,                   -- optional (matches class_modules)
    -- soft retract: hidden from students, history preserved. Never hard-delete
    -- a kadai that has completions.
    status        text not null default 'active'
                  check (status in ('active','archived')),
    created_by    uuid not null references auth.users(id),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index kadai_class_status_idx on public.kadai (class_id, status);
create index kadai_due_idx          on public.kadai (due_date);
create index kadai_module_idx       on public.kadai (module_id);
```

Notes / rationale:
- `school_id` is denormalized onto the row (like `activity_results` does,
  `remote_schema.sql` L119) so RLS can check it directly without a
  `classes` join, and a guard trigger enforces `school_id =
  app_class_school(class_id)` (mirrors the `class_modules_guard` /
  `enforce_module_enabled` pattern, L534).
- `module_id ... on delete set null` so a soft-retired/removed module leaves the
  free-text `title` intact rather than cascading away a graded task.
- **Does NOT store scores.** For module-backed `kadai`, the score/attempt truth
  stays in `activity_results`; completion is computed from it (§3.3).

### 3.2 `kadai_completions` — per-student completion state

Only needed for `self`/`teacher` modes and for caching/overriding auto results
(e.g. teacher marks done despite no auto attempt, or excuses a student). For
pure `auto` kadai this table can stay empty and completion is derived live.

```sql
create table public.kadai_completions (
    kadai_id     uuid not null references public.kadai(id) on delete cascade,
    user_id      uuid not null references auth.users(id)   on delete cascade,
    state        text not null default 'done'
                 check (state in ('done','excused')),
    -- who set it: the student (self), or a teacher override.
    source       text not null check (source in ('self','teacher')),
    marked_by    uuid not null references auth.users(id),
    -- optional link to the attempt that satisfied it (module-backed self/teacher
    -- confirmations can cite the evidence row).
    activity_result_id uuid references public.activity_results(id) on delete set null,
    note         text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    primary key (kadai_id, user_id)
);
```

### 3.3 How completion is computed (reuse, don't duplicate)

- **`complete_mode='auto'` (module-backed):** completion is derived exactly like
  `hub/index.html::computeStatus` does today (L117–125), but scoped to the
  kadai's window instead of "any attempt ever." A student is 完了 when they have
  `activity_results` rows for this `module_id`, dated `>= assigned_on`, whose
  distinct `activity_ref` (grouped via `HubCommon.assignmentKeyFromRef`, see
  `hub-common.js` L193–198) count reaches `total_items` (or ≥1 attempt = 進行中
  when `total_items` is null). **No new score storage.** An optional
  `kadai_completions` row only appears if a teacher overrides.
- **`complete_mode='self'`:** student taps できた → `kadai_completions` upsert
  `(source='self')`.
- **`complete_mode='teacher'`:** only a teacher row `(source='teacher')` counts.

This keeps `activity_results` as the single source of score truth (the
CLAUDE.md rule that all module reporting go through
`HubCommon.reportActivityWithItems` is untouched — Kadaiban never writes
`activity_results`).

### 3.4 RLS policies (reusing the existing SECURITY DEFINER helpers)

Helpers verified in `remote_schema.sql` L269–351:
`app_is_platform_admin()`, `app_has_role(school,roles[])`,
`app_class_school(class)`, `app_user_school_ids()`,
`app_user_admin_school_ids()`, `app_user_staff_school_ids()`,
`app_user_class_ids()`, `app_user_taught_class_ids()`.

**`kadai`** — read: enrolled students of the class (active only) + staff/taught.
Write: same boundary as `class_modules::cmod_write` (staff school-wide OR taught
class). Modeled line-for-line on the existing `cmod_read` / `cmod_write`
(L646–657).

```sql
alter table public.kadai enable row level security;

-- Students see active kadai for classes they're enrolled in; staff/teachers
-- see all (incl. archived) for their scope.
create policy kadai_read on public.kadai for select to public
using (
  ( status = 'active'
    and class_id in (select app_user_class_ids()) )
  or class_id in (
      select classes.id from classes
      where classes.school_id in (select app_user_staff_school_ids()) )
  or class_id in (select app_user_taught_class_ids())
);

-- Authoring: staff school-wide OR the taught-class educator (identical boundary
-- to cmod_write). created_by must be the caller; school_id must match the class.
create policy kadai_write on public.kadai for all to public
using (
  class_id in (
      select classes.id from classes
      where classes.school_id in (select app_user_staff_school_ids()) )
  or class_id in (select app_user_taught_class_ids())
)
with check (
  created_by = auth.uid()
  and school_id = app_class_school(class_id)
  and (
    class_id in (
        select classes.id from classes
        where classes.school_id in (select app_user_staff_school_ids()) )
    or class_id in (select app_user_taught_class_ids())
  )
);
```

**`kadai_completions`** — a student may write only their **own** row for a
kadai in a class they're enrolled in, and only when the kadai's `complete_mode`
allows self-report; teachers may write any row in their scope (override /
excuse). Read: own row, or staff/taught scope. This mirrors the `ar_insert`
self-vs-staff split (L662–663) and `result_items_insert_own` (L673–678).

```sql
alter table public.kadai_completions enable row level security;

create policy kadai_comp_read on public.kadai_completions for select to public
using (
  user_id = auth.uid()
  or kadai_id in (
      select k.id from kadai k
      where k.class_id in (
          select classes.id from classes
          where classes.school_id in (select app_user_staff_school_ids()))
         or k.class_id in (select app_user_taught_class_ids()) )
);

-- Student self-report: own row, kadai in an enrolled class, mode allows self,
-- source stamped 'self', marked_by = self.
create policy kadai_comp_self_write on public.kadai_completions for all to public
using (
  user_id = auth.uid() and marked_by = auth.uid() and source = 'self'
)
with check (
  user_id = auth.uid() and marked_by = auth.uid() and source = 'self'
  and kadai_id in (
      select k.id from kadai k
      where k.class_id in (select app_user_class_ids())
        and k.complete_mode in ('self','auto') )
);

-- Teacher override / excuse: any student row within teacher scope.
create policy kadai_comp_staff_write on public.kadai_completions for all to public
using (
  kadai_id in (
      select k.id from kadai k
      where k.class_id in (
          select classes.id from classes
          where classes.school_id in (select app_user_staff_school_ids()))
         or k.class_id in (select app_user_taught_class_ids()) )
)
with check (
  marked_by = auth.uid() and source = 'teacher'
  and kadai_id in (
      select k.id from kadai k
      where k.class_id in (
          select classes.id from classes
          where classes.school_id in (select app_user_staff_school_ids()))
         or k.class_id in (select app_user_taught_class_ids()) )
);
```

> Two separate INSERT/ALL policies (self vs staff) are used because Postgres
> ORs multiple permissive policies — this exactly matches the existing
> `ar_insert` design (student-own path OR staff path) rather than one giant
> `WITH CHECK`.

**Guard trigger** (mirrors `class_modules_guard`, L534): a
`BEFORE INSERT OR UPDATE` trigger on `kadai` that (a) forces
`school_id = app_class_school(class_id)` and (b) — if `module_id` is not null —
enforces the module is enabled for the class's school (reuse the existing
`enforce_module_enabled()` logic, or call it), so a free-form task skips the
check and a module-backed one honors `school_modules`.

### 3.5 Relationship to existing tables (what is reused vs new)

```
schools ─1─< kadai >─ classes        (new: dated tasks; parallel to class_modules)
              │  └─(optional)─ modules        (reuse catalog; free-form when null)
              └─< kadai_completions >─ profiles(students)   (new: per-student state)

modules ─1─< activity_results ─1─< activity_result_items    (REUSED unchanged —
              ▲                                                score/attempt truth)
              └── kadai_completions.activity_result_id (optional citation)

class_modules (UNCHANGED — stays "available modules + focus/pacing for a class")
```

- `class_modules` is **not** replaced. It remains what the module runners read
  for `focus_units` (CLAUDE.md: `sansu3` reference impl) and what `hub/index.html`
  reads for the current home block. Kadaiban is additive; §6 phases the home
  page migration.
- `activity_results` / `activity_result_items` are **read** by Kadaiban for
  auto-completion but **never written** by it.

---

## 4. UI

Two surfaces, each following its side's conventions. **Every new page ships a
fully self-contained CSS file** copying the token values literally per CLAUDE.md
hard rule #1 (never linking root `style.css`); Zen Maru Gothic for display text
(loaded from Google Fonts exactly as the existing pages do).

Token block to copy verbatim into each new `*.css`
(from CLAUDE.md / root tokens): `--ink #1c2530`, `--ink-soft #3a4555`,
`--paper #f7f3ea`, `--paper-dim #efe9db`, `--border #d8d2c2`, `--moss #4a6b4f`,
`--moss-deep #34503a`, `--moss-tint #e8ede6`, `--gold #c9a24b`, `--clay #b5572e`,
`--error #a23b2e`.

### 4.1 Student board — `gakuenza.com/hub/kadaiban.html`

- Loads the standard student shell: `hub-shell.css` + a new self-contained
  `kadaiban.css`; scripts `supabase.js → config.js → hub-common.js`, then page
  logic. Uses `HubCommon.requireSession`, `renderSidebar(sb, userId, 'kadaiban')`
  — **add a "課題板" nav item** to `hub-common.js::renderSidebar` `navItems`
  (L100–122), placed between ホーム and モジュール一覧.
- Layout (wireframe):

```
┌ 課題板 ────────────────────────────────────────────┐
│  たろうさん の課題            2026年7月16日(木)      │
├─ 今日まで (2) ───────────────────────────────────── │
│  ● 算数   [u03] 円と球のふくしゅう   期限:7月16日(木)│
│                                       [進行中] ▶ ひらく│
│  ● 国語   音読カード 3かい          期限:7月16日(木)│
│                                    [自己申告] ✔ できた │
├─ 今週 (3) ────────────────────────────────────────  │
│  ● 理科   … 期限:7月19日(日)  [未着手] ▶ ひらく       │
│  …                                                    │
├─ これから (1) ──────────────────────────────────── │
├─ 完了 (5)  ▾ たたむ ─────────────────────────────── │
└──────────────────────────────────────────────────── ┘
```

- Card visuals reuse the existing home vocabulary: subject dot
  (`HubCommon.subjectVar`), status pills (`badge-done`/`badge-progress` already
  in the hub CSS), `HubCommon.formatDueDate`, `HubCommon.progressBar`.
- **Module-backed** card → launch button navigates to `modules.launch_url`
  (absolute per CLAUDE.md rule #4), passing the focus unit as today's cards do.
- **Free-form self/teacher** card → `できた` button upserts `kadai_completions`
  (self) or is read-only (teacher-mode, shows teacher's mark).
- Buckets by due date: 今日まで / 今週 / これから / 完了, soonest first (reuse
  the `dueRank` lexicographic sort from `hub/index.html` L174–176).

### 4.2 Teacher board — `gakuenza.com/hub/gradebook/kadaiban.html`

- Sits in the gradebook. Reuse `gradebook-common.js` (`window.Gradebook`):
  `requireContext`, `loadClasses`, class chip, `renderSidebar(..., 'kadaiban', ...)`.
  **Add a "課題板" item to the gradebook `NAV`** (`gradebook-common.js`
  L126–134) — likely right after 課題 (assign), or 課題板 *replaces/absorbs*
  the assign page over time (see §6/§7).
- Reuse `window.ModuleAssign.focusUnitsFieldHtml` / `readFocusUnitsField` for the
  unit picker, and `gradeMismatch` for the soft grade warning — all already used
  by `assign.html`.
- Self-contained `gradebook.css` already exists and is the pattern; extend it or
  add page-scoped `<style>` as `assign.html` does (L10–31).
- Layout (wireframe):

```
┌ 課題板  [クラス:3年1組 ▾]          成績簿·Gradebook ┐
│ [＋ 新しい課題]                                       │
├─ 進行中の課題 ─────────────────────────────────────  │
│  円と球のふくしゅう  算数·sansu3 [u03] 期限7/16       │
│    ▓▓▓▓▓▓▓░░░  18/25 完了 · 3 進行中 · 4 未着手       │
│                                    [ロースター] [編集] │
│  音読カード3かい   国語·free  自己申告  期限7/16       │
│    ▓▓▓░░░░░░░   9/25 完了                    [編集]   │
├─ 予定 (assigned_on 未来) ───────────────────────────  │
├─ 完了/アーカイブ  ▾ ─────────────────────────────── │
└──────────────────────────────────────────────────── ┘
   [新しい課題] modal:  ○既存モジュール ▾  / ○自由記述
       タイトル __  本文(任意) __  単元☑… 期限[date] 問題数__
       完了判定: (auto/self/teacher)   [保存]
```

- The **completion strip** is the headline new capability: per kadai, one query
  over `kadai_completions` + a bucketed count of `activity_results` (for auto),
  rendered as done/progress/not-started. Expand → roster list (reuse the roster
  rendering conventions from `hub/gradebook/roster.html`).
- The **new-課題 modal** is the `assign.html` modal generalized: adds a
  module-vs-freeform toggle, `title`/`body`, and `complete_mode`; keeps the
  existing due-date / total_items / focus-unit fields verbatim.

---

## 5. Integration points with existing code

| Existing code | Integration |
|---|---|
| `hub-common.js::renderSidebar` (L100–128) | Add `{ key:'kadaiban', href:'kadaiban.html', label:'課題板' }` to `navItems`. Same file exports `formatDueDate`, `progressBar`, `subjectVar`, `assignmentKeyFromRef` — all reused by the student board. |
| `hub/index.html` (L59–213) | Phase 2: the "割り当てられたモジュール" block becomes a compact "今日の課題" summary that links to 課題板, or is replaced by it. Its `computeStatus` completion logic (L117–125) is lifted into a shared helper used by both the home summary and the board. |
| `gradebook-common.js::NAV` (L126–134) | Add a `kadaiban` nav entry. Reuse `requireContext`, `loadClasses`, `classChipHtml`, `renderSidebar`, `esc`, date helpers as-is. |
| `module-assign-common.js` (`window.ModuleAssign`) | Reuse `focusUnitsFieldHtml`, `readFocusUnitsField`, `gradeMismatch(Message)` in the new-課題 modal. Add `kadai` CRUD helpers to a new `window.Kadaiban` (or extend ModuleAssign) so the two boards can't drift — same extract-don't-copy discipline the file's header preaches. |
| `module-units.js` (`window.MODULE_UNITS`) | `kadai.focus_units` uses the **same** unit-key vocabulary as `class_modules.focus_units`; the picker is the existing one. Keep keys in lockstep (CLAUDE.md schema note). |
| Module runners (e.g. `sansu3`) | **No change required for MVP.** They already read `class_modules.focus_units`. If a kadai should scope the runner to *its* focus unit (not the class's), that's a Phase-3 param passed via the launch URL / query — a real design decision, flagged in §7. Reporting still goes only through `HubCommon.reportActivityWithItems` (unchanged). |
| `activity_results` / `HubCommon.reportActivityWithItems` | Read-only consumer for auto-completion. Kadaiban never writes activity data — preserves the single reporting contract (CLAUDE.md hard rule #2). |
| Migrations | New tables ship via `supabase/migrations/<ts>_kadaiban_schema.sql` per CLAUDE.md (MCP `apply_migration` **and** commit the file same PR). `launch_url` stays absolute; no new module registration needed (Kadaiban is hub infra, not a `modules` row). |

---

## 6. MVP scope vs. later phases

**Phase 1 — MVP (module-backed, auto-completion, class-wide):**
- `kadai` table (module-backed only: `module_id` required in the UI, `title`
  auto-filled from module name, `complete_mode='auto'`) + RLS + guard trigger.
- **No `kadai_completions` yet** — completion derived live from
  `activity_results` (§3.3 auto path), scoped by `assigned_on`.
- Student board `hub/kadaiban.html` (read-only launch board) + sidebar nav.
- Teacher board `hub/gradebook/kadaiban.html`: create/edit/archive module-backed
  kadai + completion strip (counts only, no per-student roster yet).
- This alone delivers the big wins: **multiple dated assignments of the same
  module** and a **teacher completion count** — impossible today.

**Phase 2 — free-form tasks + explicit completion:**
- `kadai_completions` table + self/teacher `complete_mode`; `できた` button;
  free-form (`module_id` null, `body`) tasks.
- Teacher roster expansion (who's done / progress / not started); teacher
  override & excuse.
- Home page (`hub/index.html`) migrates its assignment block to a 課題板 summary.

**Phase 3 — pacing & polish:**
- Kadai-scoped focus units passed into the module runner at launch (vs. the
  class-level `focus_units` the runner reads today) — needs runner changes (§7).
- Assign-to-subset (per-student or group targeting) — would need a
  `kadai_targets` table; deferred until asked for.
- Notifications / "due tomorrow" nudges; snapshot integration (weekly completion
  into `gradebook_snapshots`).
- Possible consolidation: fold `assign.html` into 課題板, or keep `class_modules`
  strictly for `focus_units`/availability and move all dating to `kadai`.

---

## 7. Open questions / decisions for the user

1. **Interpretation (blocking).** Is Kadaiban the assignment/homework board
   described in §0, or something else (announcements, messaging, parent-facing,
   attachments)? Everything downstream depends on this.
2. **`class_modules` vs `kadai` boundary.** Keep both (Kadaiban additive,
   `class_modules` = availability + `focus_units`), or migrate dating entirely
   into `kadai` and shrink `class_modules`? MVP assumes *keep both*.
3. **Does `hub/index.html` keep its own assignment block, or fully defer to
   課題板?** (Affects whether we duplicate the completion logic or share it.)
4. **Auto-completion definition.** Is "完了" = reached `total_items` distinct
   `activity_ref`s since `assigned_on`? Or ≥1 attempt? Or a score threshold?
   `total_items` is often null today — need a sane default (proposal: ≥1 attempt
   ⇒ 進行中, `total_items` reached ⇒ 完了, null `total_items` ⇒ never
   auto-完了, only 進行中). Confirm.
5. **Should a kadai's focus unit override the class-level `focus_units` inside
   the running module?** If yes, module runners need a launch-time param
   (Phase 3, touches every runner — non-trivial, and only `sansu3`+4 others are
   focus-wired today per CLAUDE.md; `rika3` isn't wired at all).
6. **Self-report trust.** For `complete_mode='self'`, is a student's `できた`
   authoritative, or does the teacher still need to confirm? (Affects whether
   the completion strip counts self-marks.)
7. **Retention on retract.** Archiving a kadai hides it from students but keeps
   `activity_results` and `kadai_completions`. Confirm that's the desired
   behavior (matches how `unassign` already warns history is preserved,
   `assign.html` L231–233).
8. **Per-student / group targeting** (differentiated homework) — in scope now,
   or explicitly Phase 3+? Adds a `kadai_targets` table if yes.
9. **Timezone for `assigned_on` / `due_date`.** Proposal uses Asia/Tokyo for
   defaults (school-local); confirm no multi-timezone concern.
```
