# Kadaiban (課題板) — build-ready architecture & spec

> **Detail layer.** This is the build spec for the Kadaiban feature. The single
> source of truth for roadmap priority/ordering is [`../ROADMAP.md`](../ROADMAP.md)
> — change ordering there, keep the build spec here.

**Status:** Architecture **confirmed by the product owner** (2026-07-16). This
supersedes the earlier interpretation-guess draft. All open interpretation
questions are resolved; what remains below are verified implementation
decisions and a phased build plan. Every "verify before assuming" flag in the
original spec has been checked against the live codebase and database — see
**§2 Verification findings**.

Kadaiban is genuinely new territory: the **first Gakuenza feature to use
Supabase Storage, file uploads, and persisted freehand drawing.** None of that
exists anywhere else in the project today (confirmed — §2).

---

## 1. What this is (confirmed scope)

**Digital ink annotation + submission workflow. NOT OCR, NOT automated
grading.**

```
Teacher scans/photographs a paper worksheet or test
        │  uploads the image(s)
        ▼
Assignable digital object (1+ pages), assigned to a class
        │
        ▼
Student draws / writes on top of the page image  (canvas layer over the image)
        │  autosaves draft strokes → explicit "submit"
        ▼
Teacher reviews the annotated result and grades it MANUALLY
        │  (reads the child's handwriting the same way they would on paper)
        ▼
Grade summary flows into activity_results → same trend lines / 個人カルテ
```

The hard, unsolved "read a child's handwriting automatically" problem is
**deliberately avoided** by keeping the teacher in the grading loop. There is
no recognition, no auto-scoring, no per-question breakdown.

---

## 2. Verification findings (checked against live code + DB, 2026-07-16)

The original spec asked to verify several things "before assuming." Done:

| Flagged assumption | Finding | Consequence for the build |
|---|---|---|
| **Supabase Storage already used?** | **No.** `grep` of app code (excluding the vendored `hub/supabase.js`) finds zero `storage.from(...)` / bucket usage. | Kadaiban stands up Storage from scratch. Bucket creation + Storage RLS is the real new-infra risk (§5). |
| **`activity_results` can hold a non-module row?** | **No.** `activity_results.module_id` is **`NOT NULL`** (FK → `modules.id`). `class_id` is nullable; `score`/`max_score` nullable; `payload` NOT NULL. | Register **one catch-all `kadaiban` module** (subject `misc`) as the FK anchor. All Kadaiban grade rows use its `module_id`; `activity_ref` distinguishes assignments (§6). |
| **Can a teacher write a grade row for a student?** | **Yes, already.** The `ar_insert` policy's first branch is `app_has_role(school_id, ARRAY['educator','school_admin'])` — no `user_id = auth.uid()` restriction. | **No new RLS policy and no Edge Function needed** for grading. The gradebook grade page calls `HubCommon.reportActivityWithItems` directly (§6). |
| **Reuse nh6's `writing.js` for the canvas?** | **Partial.** Its `WritingCanvas` stores `strokes = [[{x,y},…],…]` (already the `canvas_state` shape) with solid mouse/touch/stylus scaling (`_pos`/`_touchPos`), plus `undo`/`clear`/`redraw`/`isEmpty`. But it has **no** serialize/load, **no** background-image layer (it draws handwriting rulings + guide text instead), **no** `toDataURL` flatten, and single-color/no-eraser. | **Fork-and-adapt, not drop-in** (§7). Reuse the stroke-capture + pointer-scaling core; replace ruling/guide rendering with the worksheet image; add serialize/load/flatten. |
| **`class_teachers` scoping helpers exist?** | Yes: `app_user_taught_class_ids()`, `app_user_class_ids()`, `app_user_staff_school_ids()`, `app_class_school(class_id)`, `app_has_role(school_id, roles[])` — all SECURITY DEFINER, used throughout existing RLS. | Reuse verbatim in both table RLS and Storage RLS. |

---

## 3. Data model (confirmed, with annotations)

```sql
create table kadaiban_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id),
  created_by uuid not null references profiles(id),   -- which teacher assigned it
  title text not null,
  instructions text,
  due_date date,
  page_count int not null default 1,
  created_at timestamptz not null default now()
);

create table kadaiban_assignment_pages (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references kadaiban_assignments(id) on delete cascade,
  page_number int not null,
  source_image_path text not null,                    -- kadaiban-sources bucket path
  unique (assignment_id, page_number)
);

create table kadaiban_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references kadaiban_assignments(id),
  student_id uuid not null references profiles(id),
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','submitted','graded')),
  submitted_at timestamptz,
  score numeric,
  max_score numeric,
  graded_by uuid references profiles(id),
  graded_at timestamptz,
  unique (assignment_id, student_id)
);

create table kadaiban_submission_pages (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references kadaiban_submissions(id) on delete cascade,
  page_number int not null,
  canvas_state jsonb,           -- editable stroke data: [[{x,y,...}],...] in IMAGE space.
                                 -- Lets the student resume/undo a draft. Postgres-side,
                                 -- protected by table RLS (NOT storage).
  rendered_image_path text,      -- flattened PNG snapshot, kadaiban-submissions bucket.
                                 -- Cheap for the teacher's grading view — no re-render.
  updated_at timestamptz not null default now(),
  unique (submission_id, page_number)
);
```

**Multi-page is in the model from day one** (`page_count` / `page_number`,
unique constraints) but **Phase 1 only exercises the single-page path** — see
§10. The columns being present avoids a painful retrofit; the UI simply assumes
1 page in Phase 1.

**Design note — why editable strokes AND a flattened PNG are separate:**
`canvas_state` (jsonb, in Postgres) is the source of truth the student edits
and resumes. `rendered_image_path` (PNG, in Storage) is a write-once snapshot
generated at submit time, so the teacher's grading inbox displays every
submission cheaply without re-rendering strokes over the source image every
time. They are deliberately different surfaces with different RLS.

### 3a. Table RLS (written against the real helpers)

Modeled on the existing `cmod_write` / `ar_insert` self-vs-staff split. RLS ON
for all four tables; anon/authenticated get only what these grant.

```sql
-- kadaiban_assignments -------------------------------------------------------
-- read: staff of the class, or a student enrolled in the class
create policy kadaiban_asg_read on kadaiban_assignments for select using (
  class_id in (select app_user_taught_class_ids())
  or class_id in (select app_user_class_ids())
);
-- write: only a teacher of that class
create policy kadaiban_asg_write on kadaiban_assignments for all using (
  class_id in (select app_user_taught_class_ids())
) with check (
  class_id in (select app_user_taught_class_ids())
  and created_by = auth.uid()
);

-- kadaiban_assignment_pages (scope inherited from parent) ---------------------
create policy kadaiban_asgpage_read on kadaiban_assignment_pages for select using (
  assignment_id in (select id from kadaiban_assignments)   -- parent RLS filters
);
create policy kadaiban_asgpage_write on kadaiban_assignment_pages for all using (
  assignment_id in (select a.id from kadaiban_assignments a
                    where a.class_id in (select app_user_taught_class_ids()))
) with check (
  assignment_id in (select a.id from kadaiban_assignments a
                    where a.class_id in (select app_user_taught_class_ids()))
);

-- kadaiban_submissions -------------------------------------------------------
create policy kadaiban_sub_read on kadaiban_submissions for select using (
  student_id = auth.uid()
  or assignment_id in (select a.id from kadaiban_assignments a
                       where a.class_id in (select app_user_taught_class_ids()))
);
-- student creates/updates their OWN submission (draft + submit)
create policy kadaiban_sub_student_write on kadaiban_submissions for all using (
  student_id = auth.uid()
) with check (
  student_id = auth.uid()
  and assignment_id in (select a.id from kadaiban_assignments a
                        where a.class_id in (select app_user_class_ids()))
);
-- teacher updates grade fields for classes they teach
create policy kadaiban_sub_teacher_grade on kadaiban_submissions for update using (
  assignment_id in (select a.id from kadaiban_assignments a
                    where a.class_id in (select app_user_taught_class_ids()))
) with check (
  assignment_id in (select a.id from kadaiban_assignments a
                    where a.class_id in (select app_user_taught_class_ids()))
);

-- kadaiban_submission_pages (canvas drafts) ----------------------------------
create policy kadaiban_subpage_student on kadaiban_submission_pages for all using (
  submission_id in (select id from kadaiban_submissions where student_id = auth.uid())
) with check (
  submission_id in (select id from kadaiban_submissions where student_id = auth.uid())
);
create policy kadaiban_subpage_teacher_read on kadaiban_submission_pages for select using (
  submission_id in (
    select s.id from kadaiban_submissions s
    join kadaiban_assignments a on a.id = s.assignment_id
    where a.class_id in (select app_user_taught_class_ids()))
);
```

> **Guard-trigger note:** mirror the existing `class_modules_guard` pattern with
> a `kadaiban_submissions` trigger so a student's own-row write can't flip
> `status` to `graded` or set `score`/`graded_by` (WITH CHECK can't compare to
> OLD). The teacher grade path (§6) sets those fields; the student path must not.

---

## 4. Three user flows

All three live in **Gradebook** (teacher) and the **student hub** (student).
Kadaiban is a new **section in Gradebook's nav**, not a standalone app shell —
Gradebook already owns class-scoping, the assign flow, and the roster.

### 4a. Teacher — create (`hub/gradebook/kadaiban.html`, create view)
1. New assignment: title, instructions, due date, target class (reuses the
   `Gradebook` class chip / scoping).
2. Upload 1+ page images → each becomes a `kadaiban_assignment_pages` row; the
   file goes to `kadaiban-sources/<assignment_id>/<page_number>.<ext>`.
3. **Upload-time attestation checkbox** (§9): "この教材を自分のクラスで使用する
   権利があります" — recorded, not technically enforced.

### 4b. Student — complete & submit (`hub/kadaiban.html`)
1. Assigned Kadaiban items surface in the student hub **alongside module
   assignments** (see §8 for ordering consistency).
2. Open → canvas over the page image. Draw/write. **Autosave** `canvas_state`
   → `status = 'in_progress'` (multiple short sessions are realistic for this
   age group; never require one sitting).
3. **Submit** → `status = 'submitted'`, `submitted_at = now()`, and **flatten
   each page's canvas to a PNG** into
   `kadaiban-submissions/<assignment_id>/<student_id>/<page>.png` →
   `rendered_image_path`.

### 4c. Teacher — grade (`hub/gradebook/kadaiban.html`, inbox view)
1. Inbox of submissions filtered to assignments the teacher created
   (`app_user_taught_class_ids()` scoping).
2. View the flattened PNG, enter `score` / `max_score`.
3. Submission → `status = 'graded'`, `graded_by`, `graded_at`; **and** write the
   `activity_results` summary row (§6).

---

## 5. Storage design (NET-NEW — its own pass, done here)

Two **private** buckets (never public; student work + teacher materials must
not be world-readable):

| Bucket | Path convention | Holds |
|---|---|---|
| `kadaiban-sources` | `<assignment_id>/<page_number>.<ext>` | teacher-uploaded original worksheet images |
| `kadaiban-submissions` | `<assignment_id>/<student_id>/<page>.png` | flattened PNG snapshots of student work |

Path segments carry the identifiers the policies key on
(`split_part(name,'/',n)`). Storage RLS is a **different surface** than table
RLS — policies live on `storage.objects`, scoped by `bucket_id` + path — but the
same SECURITY DEFINER helpers are callable.

```sql
-- SOURCES: teacher of the assignment's class may write; teacher OR enrolled
-- student may read (a student must see the worksheet to draw on it).
create policy kadaiban_src_write on storage.objects for all to authenticated using (
  bucket_id = 'kadaiban-sources'
  and exists (select 1 from public.kadaiban_assignments a
              where a.id = split_part(name,'/',1)::uuid
                and a.class_id in (select app_user_taught_class_ids()))
) with check (
  bucket_id = 'kadaiban-sources'
  and exists (select 1 from public.kadaiban_assignments a
              where a.id = split_part(name,'/',1)::uuid
                and a.class_id in (select app_user_taught_class_ids()))
);
create policy kadaiban_src_read on storage.objects for select to authenticated using (
  bucket_id = 'kadaiban-sources'
  and exists (select 1 from public.kadaiban_assignments a
              where a.id = split_part(name,'/',1)::uuid
                and (a.class_id in (select app_user_taught_class_ids())
                     or a.class_id in (select app_user_class_ids())))
);

-- SUBMISSIONS: student writes/reads only their OWN (student_id path segment =
-- auth.uid()); teacher of the assignment's class may read.
create policy kadaiban_subm_student_write on storage.objects for all to authenticated using (
  bucket_id = 'kadaiban-submissions'
  and split_part(name,'/',2)::uuid = auth.uid()
) with check (
  bucket_id = 'kadaiban-submissions'
  and split_part(name,'/',2)::uuid = auth.uid()
  and exists (select 1 from public.kadaiban_assignments a
              where a.id = split_part(name,'/',1)::uuid
                and a.class_id in (select app_user_class_ids()))
);
create policy kadaiban_subm_read on storage.objects for select to authenticated using (
  bucket_id = 'kadaiban-submissions'
  and (split_part(name,'/',2)::uuid = auth.uid()
       or exists (select 1 from public.kadaiban_assignments a
                  where a.id = split_part(name,'/',1)::uuid
                    and a.class_id in (select app_user_taught_class_ids())))
);
```

**Access pattern:** private buckets → the client fetches images via short-lived
**signed URLs** (`createSignedUrl`), gated by these policies. Never public URLs.

**Bucket creation is an infra step**, not a SQL migration — create the two
buckets (private) via the Supabase dashboard or the Storage API, then apply the
`storage.objects` policies via migration. Document both in the PR.

---

## 6. Reporting integration (confirmed decision)

On grade, write **one summary row** to `activity_results` so Kadaiban appears in
the same trend lines / 個人カルテ as everything else — a teacher shouldn't check
two places for a student's full picture.

- `module_id` = the catch-all **`kadaiban`** module (registered once; subject
  `misc`; `is_active=false` so it does not render as a launchable tile in the
  student hub module grid — it's a reporting anchor, not an app).
- `activity_ref` = `kadaiban/<assignment_id>/<graded_timestamp>`.
- `score` / `max_score` = the teacher's manual grade.
- `payload` = `{ "title": <assignment title>, "kind": "kadaiban" }` (for the
  gradebook label helpers).
- **Do NOT write `activity_result_items`** — a holistically-graded worksheet has
  no per-question granularity; forcing items would misrepresent it. Consistent
  with the project treating `activity_result_items` as optional-but-standard.

The write uses `HubCommon.reportActivityWithItems(sb, { schoolId, classId,
moduleId, userId: studentId, activityRef, score, maxScore, payload })` (no
`items`). The `ar_insert` policy already permits an educator/school_admin to
insert for another `user_id` (§2), so this runs client-side from the grade
page — no Edge Function.

---

## 7. Canvas implementation (fork nh6, adapt)

Base: `gakuenza.com/modules/nh6/writing.js` `WritingCanvas`. **Reuse** the stroke
model (`strokes` = array of point-arrays), pointer/touch scaling, `undo`,
`clear`, `redraw`, `isEmpty`. **Replace/add:**

1. **Image-space coordinates.** Size the drawing bitmap to the **source image's
   native pixel dimensions** (fixed), display scaled via CSS. Then stored stroke
   coords are image-space → reload and flatten are exact, and no resize
   invalidates saved coords. (nh6's `resizeTo` changes the bitmap size — do NOT
   do that after load here.)
2. **Background layer.** In `redraw()`, draw the worksheet image first, then the
   strokes on top (drop the handwriting rulings/guide-text rendering).
3. **Persistence.** `serialize()` → `JSON.stringify(strokes)` into
   `canvas_state`; `load(json)` → set `strokes` + `redraw()`. Autosave on
   stroke-end (debounced) → `kadaiban_submission_pages`.
4. **Flatten.** At submit, composite image + strokes onto an export canvas at
   **source resolution** and `toDataURL('image/png')` → upload → `rendered_image_path`.
5. **Tools.** Phase 1 = one pen color + undo. Phase 2 = eraser + color select.

---

## 8. Student-hub ordering consistency

Kadaiban items appear in the student hub next to module assignments. Today
`hub/index.html` renders an ad-hoc assigned-modules block. When the due-date-
aware assignment dashboard (see `FEATURE_BACKLOG.md` F1) is built, it must treat
Kadaiban assignments (`due_date` on `kadaiban_assignments`) **consistently** with
quiz-module assignments — same sort, same "due soon" styling, one unified list —
rather than a separate Kadaiban silo. Flagged so the two features converge.

---

## 9. Copyright / use-rights (different from curriculum modules)

This is **teachers uploading their own materials**, not Gakuenza reproducing
textbook content — so the "reference, don't reproduce" discipline that governs
curriculum modules does **not** apply the same way. Responsibility shifts to the
teacher's own right to use what they upload (same as photocopying a worksheet
for class already does). Implement a **simple attestation at upload time**
("I have the right to use this material with my class") — not technical
enforcement, which this project can't do for an arbitrary image and shouldn't
pretend to.

---

## 10. Phasing (do NOT attempt both at once)

**Phase 1 — prove the new infrastructure in isolation.**
- Single-page assignments only.
- Basic pen tool (one color, undo), manual grading.
- Stand up **Storage + Storage RLS** for both buckets — *the real new-infra
  risk*; validate it end-to-end before adding complexity.
- The four tables + table RLS + guard trigger.
- Catch-all `kadaiban` module registration + `activity_results` integration.
- Lives in Gradebook; student surface in the hub.

**Phase 2 — richness once the foundation is proven.**
- Multi-page support (the model already carries it).
- Richer tools: eraser, color selection.
- Draft-autosave polish.
- Due-date-aware ordering integration on the student side (§8, converge with F1).

---

## 11. Remaining open questions / risks

1. **Storage enablement & limits.** Confirm Storage is enabled on the project;
   decide a max upload size / allowed MIME (image/png, image/jpeg) and enforce
   it (bucket file-size limit + client check). Large scans → downscale on upload?
2. **Image orientation / EXIF.** Phone photos carry EXIF rotation; normalize on
   upload so the canvas overlay aligns.
3. **Offline during drawing.** Autosave needs the network; a dropped Chromebook
   Wi-Fi mid-worksheet shouldn't lose strokes. Minimum: keep `canvas_state` in
   memory + retry; consider a localStorage fallback (ties into
   `FEATURE_BACKLOG.md` F16 offline-resilient submission).
4. **Coordinator grading.** `ar_insert` allows `educator`+`school_admin` but not
   `coordinator`; confirm whether coordinators grade Kadaiban and, if so, widen
   the grade path accordingly.
5. **Delete/cleanup.** Deleting an assignment should remove its source images
   and all submission snapshots from Storage (no FK cascade reaches Storage —
   needs explicit cleanup, ideally an Edge Function or a scheduled sweep).

---

## Build order (Phase 1, concrete)

1. Migration: 4 tables + table RLS + guard trigger + catch-all `kadaiban`
   module registration (idempotent; MCP `apply_migration` **and** committed
   `supabase/migrations/<ts>_kadaiban.sql`).
2. Infra: create the two private buckets; apply `storage.objects` policies
   (migration). Verify a signed-URL round-trip end-to-end.
3. Teacher create view (`hub/gradebook/kadaiban.html`) + nav entry; source
   upload; attestation.
4. Student view (`hub/kadaiban.html`): forked canvas over the image, autosave,
   submit + flatten/upload.
5. Teacher grade inbox: PNG view, score entry, status → graded, `activity_results`
   write via `reportActivityWithItems`.
6. Flow test (headless): teacher upload → student draw/persist/submit → teacher
   grade → assert `activity_results` row + no `activity_result_items` + Storage
   RLS denies cross-student/cross-class access.
