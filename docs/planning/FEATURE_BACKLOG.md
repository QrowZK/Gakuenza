# Gakuenza — Feature Backlog (scoping)

_Drafted 2026-07-16. A prioritized, grounded proposal of NEW features for the
がくえん座 platform. This is a scoping document only — no code, no migrations.
Every item is written to be concrete enough to become a `docs/specs/pending/`
spec._

> **Detail layer.** This is the deep-dive for product features (F1–F17 +
> recommend-against). The single source of truth for roadmap priority/ordering
> is [`../ROADMAP.md`](../ROADMAP.md) — change ordering there, keep feature
> detail here.

## Grounding assumptions (from the codebase, not invented)

- **Architecture is fixed:** static frontend (plain HTML/CSS/JS, no build),
  browser → Postgres via the public anon key, RLS is the security boundary,
  Edge Functions (service_role) for the few privileged/bulk ops the client
  can't do safely. Every proposal respects this — new privileged or
  cross-tenant-bulk work is an Edge Function, everything else is a
  table + RLS policy + a static page.
- **What already exists (don't re-propose):** student hub (home / modules /
  own grades / settings), 12+ drill modules; educator gradebook (dashboard,
  assign with `focus_units`, roster + bulk password, observation records
  A/B/C + notes, class-level analysis with つまずき Top3 / 得点分布 /
  category heatmap, individual カルテ with grade corrections + weekly trend,
  print worksheet generator); admin console (schools, teachers, students +
  CSV import, class-detail, module catalog/enable + assignment matrix);
  `gradebook_snapshots` weekly rollup (now populated via pg_cron); the
  bug-report automation pipeline.
- **What is entirely absent today** (and therefore where most net-new value
  is): any guardian/parent surface, any announcements/messaging, any
  attendance/健康観察, any student motivation layer beyond raw scores, any
  accessibility settings, any offline resilience, any year-rollover
  (進級・クラス替え) tooling, any admin-level (cross-class/school) analytics,
  any data export.

### Cross-cutting PII / privacy note

Several proposals touch **real student PII and would introduce guardian
(保護者) data — the single most sensitive expansion of the platform's data
footprint.** Any feature marked **[PII]** below must: (a) add its RLS policy
in the *same* migration as the table, reusing the existing helper functions
(`app_user_taught_class_ids()`, `app_user_staff_school_ids()`,
`app_class_school()`) rather than hand-rolling scope; (b) never widen an
existing read policy as a side effect; (c) keep any new personal identifiers
(guardian names, contact details, health/wellbeing notes) in dedicated tables
with the *narrowest* possible read scope, never in `profiles`. Guardian
contact data in particular should be treated as regulated personal
information under Japanese 個人情報保護法 norms — collect the minimum, and
prefer print-based delivery over storing new contactable identifiers where
that satisfies the need.

---

## Theme 1 — Teacher workflow

### F1. 課題の進捗・期限ダッシュボード / Assignment progress & due-date tracking — P0, **in progress**
- **Problem:** `class_modules.due_date` and `total_items` exist and the assign
  UI writes them, but **nothing shows a teacher who has / hasn't completed an
  assigned module, or what's overdue.** Today a teacher must eyeball raw
  results. This is the most direct gap in the core gradebook loop.
- **Roles:** educator (primary), coordinator/school_admin (school-wide view).
  Students get a "あと◯日" due badge on the hub.
- **Data / RLS:** **no new tables.** A read-only aggregation over
  `class_modules` × `enrollments` × `activity_results` (has each enrolled
  student produced a result for this module/assignment since assignment?).
  All within existing read policies.
- **Frontend:** new card on `gradebook/index.html` ("未提出・期限間近"); a
  drill-down list per assignment (reuse roster styling); a small due badge on
  `hub/index.html` assigned-module tiles.
- **Effort:** S–M. **Deps:** none. **Priority justification (P0):** closes an
  existing-but-unusable data path, zero schema risk, immediate daily value.
- **Progress (2026-07-24, `#176` Phase 1):** the core of this shipped, via a
  new `module_assignments` table rather than `class_modules.due_date` (a
  discrete per-assignment entity, mirroring `kadaiban_assignments`, separating
  "issued as a task" from "enabled for the class"). `gradebook/assign.html`
  now shows each assignment with **inferred** N/M completion (an
  `activity_results` row exists since the assignment's `due_date`/creation);
  `hub/index.html` shows students a due-dated 課題 to-do list. **Still open
  against the original ask:** a cross-class/cross-assignment roll-up card on
  `gradebook/index.html` (today a teacher checks each class's `assign.html`
  separately, not one glance) and **exact** (not inferred) completion via
  `activity_results.assignment_id`, both deferred to `#176` Phase 2 — see
  `docs/specs/SPEC_teacher_assignment_workflow.md`. Recommend keeping F1 open
  at P0 until the roll-up card ships; it's now the smallest remaining piece.

### F2. 所見ドラフト補助 / Report-card comment (所見) evidence & draft helper — P1 [PII]
- **Problem:** Japanese teachers write narrative 所見/あゆみ comments every
  term for every child — a notorious workload spike. The platform already
  holds the evidence (activity results, category strengths/weaknesses,
  observation records) but offers no way to compile it per student per term.
- **Roles:** educator, coordinator/school_admin.
- **Data / RLS:** new `report_comments` (`school_id, class_id, user_id, term,
  subject, draft, finalized bool, updated_by, updated_at`), RLS scoped exactly
  like `observation_records` (taught class or staff school). The *evidence
  panel* is a read-only aggregation; the *draft* is stored text the teacher
  owns and edits. **No third-party AI in scope** — this is
  evidence-compilation + a structured editable draft, not generated prose.
- **Frontend:** extend `gradebook/karte.html` (per student) with a "所見" tab,
  or a dedicated `gradebook/shoken.html`. Term selector reuses the snapshot
  week logic.
- **Effort:** M. **Deps:** observation_records (exists). **Justification:**
  high, seasonal (term-end) workload relief; PII stays within existing staff
  scope. Guardian-facing narrative text = treat drafts as sensitive.

### F3. つまずき → 再指導プリント直結 / Reteaching worksheet from weak categories — P1
- **Problem:** `analysis.html` surfaces "学級のつまずき Top3" and a category
  heatmap; `print.html` generates worksheets — but the two are disconnected.
  A teacher who spots a weak unit must manually rebuild a worksheet for it.
- **Roles:** educator.
- **Data / RLS:** none new. Pass the weak category/unit keys (already computed
  from `activity_result_items.category` + `module-units.js`) into the print
  generator via `focus_units`-style filtering.
- **Frontend:** a "このつまずきでプリントを作る" button on `analysis.html`
  that deep-links to `print.html` pre-scoped to the offending units.
- **Effort:** M. **Deps:** analysis + print generators must expose/accept a
  unit filter. **Justification:** turns insight into action with almost no new
  infrastructure — high pedagogical leverage per unit of effort.

---

## Theme 2 — Student engagement

### F4. がんばりスタンプ & れんぞく記録 / Effort stamps & learning streaks — P1
- **Problem:** Students see raw scores only; nothing rewards consistency or
  effort. Elementary motivation benefits from **non-competitive** progress
  markers (がんばりカード culture).
- **Roles:** student (primary); teacher sees it read-only on カルテ.
- **Data / RLS:** derive from `activity_results` (days-active, attempts). Badge
  definitions live in a small static JS registry; *earned* badges either
  computed on the fly or persisted in `student_achievements`
  (`user_id, badge_key, earned_at`) with self-read + taught-class staff read
  RLS. Persisting avoids recomputation and lets teachers acknowledge effort.
- **Frontend:** `hub/index.html` "きみのがんばり" card; a strip on
  `hub/grades.html`.
- **Effort:** M. **Deps:** none. **Justification:** meaningful for young
  learners; **must be effort/consistency-based and never rank children against
  each other** (see recommend-against R3).

### F5. きょうのおすすめ / Personalized next-drill recommendation — P1
- **Problem:** The hub lists assigned modules but doesn't guide a child to
  *what to do next*. Weak-category data already exists per student.
- **Roles:** student.
- **Data / RLS:** read-only over the student's own `class_modules` (assigned,
  respecting `due_date`) + own `activity_result_items` (weakest categories).
  All within self-read scope. No new tables.
- **Frontend:** "きょうのおすすめ" tile at the top of `hub/index.html`.
- **Effort:** M. **Deps:** F1 helps (due awareness). **Justification:** raises
  meaningful practice time; pure client logic over data the student may
  already read.

### F6. ふりかえり / Post-drill self-reflection check-in — P2
- **Problem:** No signal of how a child *felt* about a drill (むずかしかった?),
  which teachers value alongside the score.
- **Roles:** student → educator.
- **Data / RLS:** could ride in `activity_results.payload` (no schema change)
  or a small `activity_reflections` table. Self-write, taught-class staff read.
- **Frontend:** a one-tap mood/difficulty prompt at drill end (shared shim in
  `hub-common.js`); surfaced on カルテ.
- **Effort:** S–M. **Deps:** touches the shared reporting path. **Justification:**
  cheap affective signal; P2 because it's additive, not a gap-closer.

---

## Theme 3 — Guardian / parent communication  [all PII-heavy]

### F7. おうちの人向け がんばりシート（印刷） / Printable guardian progress sheet — P1 [PII]
- **Problem:** Guardians have **zero** window into the platform. The safest
  first step is a **take-home printed sheet** — no guardian accounts, no new
  contactable identifiers stored.
- **Roles:** educator generates; guardian reads on paper.
- **Data / RLS:** none new — reuse the `print.html` infrastructure and the
  same aggregations as カルテ, rendered in plain, jargon-free Japanese.
- **Frontend:** a new target in `print.html` ("おうちの人向け").
- **Effort:** S–M. **Deps:** print generator. **Justification:** delivers the
  guardian-communication value with the *lowest* privacy expansion — nothing
  new is stored, distribution is physical and teacher-controlled. Do this
  **before** F8.

### F8. 保護者アカウント & 進捗ビュー / Guardian login accounts — P2 [PII]
- **Problem:** A real guardian portal (view own child's progress, receive
  announcements) is the eventual ask, but it is a **major** expansion.
- **Roles:** new sixth actor (guardian), linked to one or more students.
- **Data / RLS:** new `guardians` + `guardian_links` (guardian↔student, with
  school scope); a new RLS helper (`app_guardian_student_ids()`) and a
  guardian read policy on results/observations exposing **only their own
  child's** rows and a *curated* subset (never raw item-level answers or other
  children). Account creation must go through a new/extended Edge Function
  (privileged, verified, non-enumerating) — never client-side. Requires a
  **consent/onboarding** flow and a data-minimization review.
- **Frontend:** a guardian-scoped variant of the hub; admin UI to invite/link
  guardians.
- **Effort:** L. **Deps:** F7 (validate the content first), Edge Function work,
  privacy/consent sign-off. **Justification (P2):** high value but the biggest
  PII/auth surface on the roadmap — sequence it after the print-based sheet
  proves the content and after a deliberate privacy review.

### F9. クラスからのお知らせ / Class announcements — P2
- **Problem:** No way for a teacher to post a short note ("あしたは水泳") that
  students (and later guardians) see on login.
- **Roles:** educator → student (and guardian once F8 exists).
- **Data / RLS:** new `announcements` (`class_id, school_id, body, posted_by,
  posted_at, expires_at`), class-scoped read for enrolled students, write for
  taught-class staff.
- **Frontend:** a compose box in the gradebook; a card on `hub/index.html`.
- **Effort:** M. **Deps:** none (guardian delivery deferred to F8).
  **Justification:** useful but not a core-loop gap; watch scope creep toward a
  full messaging system (see R1).

---

## Theme 4 — Analytics / insight

### F10. 学年・学校全体の分析 / Grade-level & school-wide analytics — P1
- **Problem:** `analysis.html` is single-class only. Coordinators and
  school_admins (who already have school-wide read via RLS) have **no roll-up**
  across classes or grades to spot patterns or compare.
- **Roles:** coordinator, school_admin, platform_admin.
- **Data / RLS:** read-only aggregation over `activity_results` +
  `gradebook_snapshots` within existing `app_user_staff_school_ids()` scope.
  No new tables (snapshots already populate).
- **Frontend:** a new page in the admin console (`admin/analytics.html`) or a
  school-scope toggle on `analysis.html`.
- **Effort:** M. **Deps:** gradebook_snapshots (populated). **Justification:**
  unlocks the leadership tier's view with data + scope that already exist.

### F11. 成績データCSVエクスポート / Gradebook CSV export — P1 [PII]
- **Problem:** Schools run their own 校務支援システム; teachers need to get
  data *out*. There is no export anywhere.
- **Roles:** educator (taught classes), coordinator/school_admin (school).
- **Data / RLS:** none new — client-side CSV built from queries the user is
  already authorized to read (scope enforced by RLS, not the button).
- **Frontend:** an export button on `analysis.html` / `karte.html` / roster.
- **Effort:** S. **Deps:** none. **Justification:** small, high-utility, but
  **[PII]** — a CSV is a portable pile of student data; UTF-8 BOM for Excel,
  staff-only, and log/rate-limit if it ever moves server-side.

### F12. モジュール利用状況 / Module adoption & usage dashboard — P2
- **Problem:** No one can see which of the 12+ modules are actually used,
  where engagement is dead, or which licensed-but-idle.
- **Roles:** school_admin, platform_admin.
- **Data / RLS:** aggregation over `activity_results` × `school_modules` ×
  `class_modules`; existing staff scope.
- **Frontend:** extend `admin/modules.html` with a usage column / mini-chart.
- **Effort:** S–M. **Deps:** none. **Justification:** informs licensing and
  content investment; not urgent.

---

## Theme 5 — Admin / ops

### F13. 進級・クラス替え（年度更新）ツール / Year-rollover & class re-assignment — P1 [PII]
- **Problem:** Japanese schools reset every April: students advance a grade and
  are re-sorted into new classes (クラス替え). Today this is manual
  enrollment/CSV surgery across `classes`/`enrollments`/`class_teachers` —
  error-prone and destructive if done wrong. **Seasonally critical.**
- **Roles:** school_admin, coordinator.
- **Data / RLS:** primarily an **Edge Function** (bulk, transactional,
  service_role) that: creates the new year's classes, moves students into new
  enrollments, reassigns teachers, and **archives** the prior year (keep
  historical results intact — do not delete). Consider an `academic_years` /
  archival flag rather than mutating in place. Must be authorized against the
  target school and audited.
- **Frontend:** a guided wizard in `admin/` (preview → confirm), never a raw
  bulk button.
- **Effort:** L. **Deps:** careful design of archival vs. historical
  `activity_results` continuity. **Justification:** without it, the platform is
  painful to carry across school years — the biggest ops cliff on the horizon.
  **[PII]** bulk student movement demands preview + audit + rollback.

### F14. 管理操作の監査ログ / Admin action audit log — P2
- **Problem:** `grade_corrections` audits score edits, but password resets,
  account creation, licensing, and rollovers leave no queryable trail.
- **Roles:** school_admin, platform_admin.
- **Data / RLS:** new `admin_audit` (`actor, school_id, action, target,
  detail jsonb, at`), written by the Edge Functions (service_role) that
  already perform these ops; read scoped to staff of the school.
- **Frontend:** a read-only log view in `admin/`.
- **Effort:** M. **Deps:** hooks into `provision-account`/`update-*` Edge
  Functions. **Justification:** accountability + incident forensics; P2 until
  the privileged-op surface grows (F13 raises the case for it).

---

## Theme 6 — Accessibility

### F15. よみやすさ設定（ふりがな・文字サイズ・UDフォント・配色） / Readability settings — P1
- **Problem:** Elementary learners span reading levels; many kanji aren't yet
  taught by grade. There is no furigana toggle, text-size control,
  UD/dyslexia-friendly font option, or high-contrast mode anywhere.
- **Roles:** student (primary), staff benefit too.
- **Data / RLS:** per-user preferences (small JSON in a `user_preferences`
  table or existing settings storage), self-scoped. The heavy lift is
  *applying* prefs consistently across the hub **and every module's
  self-contained page** — respect Hard Rule #1 (each module owns its CSS), so
  this is a shared, token-driven mechanism modules opt into, not a global
  stylesheet.
- **Frontend:** `hub/settings.html` controls + a shared applier in
  `hub-common.js`; module pages honor the prefs.
- **Effort:** M (breadth across surfaces). **Deps:** touches many pages.
  **Justification:** genuine inclusion value for the actual user population;
  furigana in particular is grade-appropriateness, not a nicety.

---

## Theme 7 — Offline / reliability

### F16. 結果送信のオフライン耐性・自動リトライ / Offline-resilient result submission — P0
- **Problem:** School Wi-Fi is flaky. If the `activity_results` insert at the
  end of a drill fails (dropped connection), **the child's completed work is
  silently lost** — the single worst data-integrity failure mode in the core
  loop, and it runs through one shared path.
- **Roles:** student (data integrity); teacher (trustworthy gradebook).
- **Data / RLS:** none new. Queue unsent results in IndexedDB/localStorage in
  `HubCommon.reportActivityWithItems`, retry on reconnect/next login, dedupe on
  `activity_ref`. RLS unchanged (same inserts, just deferred).
- **Frontend:** all changes live in the shared reporting helper; a tiny "未送信"
  indicator when a queue is pending.
- **Effort:** M. **Deps:** the shared reporting helper is the natural
  chokepoint — **but note the five modules that hand-roll their insert
  (`nh6`, `nhvocab`, `letstry1`, `letstry2`, `shakai3`) bypass it and won't get
  this for free.** Fixing those to use the helper (already a standing want per
  Hard Rule #2) is a prerequisite for full coverage. **Justification (P0):**
  protects the platform's primary data against routine network conditions in a
  real school building.

### F17. 健康観察 / きょうのようす — daily wellbeing check-in — P2 [PII]
- **Problem:** Japanese homerooms do daily 健康観察 (health/mood check). The
  platform could offer a light morning check-in and a class board for the
  teacher.
- **Roles:** student → educator.
- **Data / RLS:** new `daily_checkins` (`user_id, class_id, date, condition,
  mood, note`) — **health-adjacent personal data**, so the narrowest scope:
  self-write, taught-class staff read only, and a short retention policy.
- **Frontend:** a morning prompt on `hub/index.html`; a class board in the
  gradebook.
- **Effort:** M. **Deps:** none. **Justification:** fits real classroom ritual,
  but **[PII]** health/mood data raises the sensitivity bar; P2 pending a
  deliberate decision to hold wellbeing data at all (schools may prefer this
  stay on paper).

---

## Priority summary

| Tier | Features |
|---|---|
| **P0 (now)** | F1 assignment progress/due dashboard · F16 offline-resilient result submission |
| **P1 (soon)** | F2 所見 helper · F3 reteaching-worksheet link · F4 effort stamps/streaks · F5 next-drill recommendation · F7 printable guardian sheet · F10 school-wide analytics · F11 CSV export · F13 year-rollover tool · F15 readability settings |
| **P2 (later)** | F6 self-reflection · F8 guardian accounts · F9 announcements · F12 module usage dashboard · F14 admin audit log · F17 daily wellbeing check-in |

Rough sequencing logic: P0 items close/protect the *existing* core loop with
minimal schema risk. Among P1, F3/F5/F10/F11 are cheap wins on data that
already exists; F13 is seasonally urgent but large; F7 is the safe on-ramp to
guardian communication (must precede F8). P2 items are either additive (F6,
F12), the heavier privacy expansions (F8, F17), or gated on a prior feature.

---

## Recommend AGAINST (considered and rejected)

### R1. 児童間ダイレクトメッセージ / Student-to-student direct messaging or chat
A DM/chat system for elementary children is a **safeguarding and moderation
liability** far outside a drill-and-gradebook platform's purpose — it demands
moderation tooling, abuse reporting, and guardian consent, and creates
child-to-child unsupervised communication the school becomes liable for. Even
F9 (announcements) is deliberately **one-way, teacher→student**. Do not build
peer messaging.

### R2. 児童向けAIチューター/チャットボット / Student-facing AI tutor chatbot
An LLM chatbot answering children's questions in free text means: sending
child input to a third-party model (PII + cost against a shared subscription
quota), plus hallucination risk delivered directly to young learners with no
teacher in the loop. It also breaks the platform's clean static/RLS model. The
platform's strength is *bounded, verifiable* drills with a teacher-owned
gradebook — keep AI assistance on the **teacher side** (F2 is evidence
compilation, explicitly not generated prose to children).

### R3. 公開ランキング / 児童間の順位表・リーダーボード
Public inter-student score ranking is culturally inappropriate for Japanese
elementary schools and a wellbeing risk (it pathologizes the slower learner
and pressures the class). This is exactly why F4 is framed as **effort- and
consistency-based, non-comparative** stamps. Individual progress: yes;
ranking children against each other: no.

### R4. ネイティブモバイルアプリ / A native mobile app (also considered)
Building a native iOS/Android app would abandon the deliberate no-build,
static-frontend architecture and add app-store release friction for a school
audience that reaches the site through shared classroom devices/browsers.
If mobile ergonomics become a need, a **PWA/responsive** pass on the existing
static site (offline via F16, installable) delivers most of the value without
forking the stack — not a separate app.
