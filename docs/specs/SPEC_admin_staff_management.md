# SPEC — Admin-console staff-management: backend-dependent gaps

**Roadmap:** Near-term-debt #9 (admin-console staff-management UX thinness)
**Status:** decisions needed / ready for human-approved, branch-verified build
**Written:** 2026-07-23

> **Placement note (read first).** This deliberately lives in `docs/specs/`,
> **not** `docs/specs/pending/`. The `pending/` path auto-fires
> `auto-build-module.yml`, which builds *learning modules* from a spec — it
> would misread this admin-console + RLS + Edge-Function work as a module to
> generate. Same reasoning and same placement as `SPEC_modules_publisher.md`.
> The task that produced this spec asked for `pending/`; it was moved up one
> level on purpose to avoid mis-triggering the module builder. Hand this to a
> subagent or build it by hand.

> **Why these parts are specced, not shipped.** The companion PR already
> implemented the three gaps that are safe pure-frontend against the CURRENT
> RLS and Edge Functions: staff **role editing** and **remove-from-school**
> (both plain `school_members` writes admitted by the existing
> `members_admin_write` policy), and the **cross-school staff directory**
> (read-only over rows the caller can already SELECT). The gaps below each
> require a NEW backend capability (an RLS policy, or a `service_role` Edge
> Function) and are auth-adjacent, so per project policy they are NOT applied
> autonomously. Each item below states the exact change and the RLS-safety
> reasoning: **who must and must not be able to do it.**

---

## Context the implementer needs

Verified live against project `ohnsawydclmsrgphasbn` on 2026-07-23:

- **`schools`** has SELECT policies (`schools_read`, `schools_read_admin`) and
  one INSERT policy (`schools_platform_admin_insert`, `with check
  (app_is_platform_admin())`). **There is no UPDATE policy** → every client
  `schools.update(...)` is denied by RLS default-deny, regardless of tier.
- **`school_members`** has `members_read` (`school_id in
  app_user_school_ids()`) and `members_admin_write` (`FOR ALL`, USING +
  WITH CHECK `school_id in app_user_admin_school_ids()`).
  `app_user_admin_school_ids()` = every school for a platform admin, or the
  caller's own `school_admin` schools; **coordinators are excluded**. This is
  why role-edit / remove ship as frontend-only.
- **`profiles.is_platform_admin`** is not client-writable (table-level UPDATE
  revoked, column excluded from the safe-column regrant — migrations
  `20260717040743`/`20260717040949`). Nothing in this spec may reopen that.
- **No `disabled`/`active`/`banned` flag exists on `profiles` or
  `school_members`** for staff. There is no soft-disable mechanism today.
- **Emails live only in `auth.users`**, never in `profiles`. The anon key
  cannot read `auth.users`. Any "does this email already have an account"
  lookup needs a `service_role` query, i.e. an Edge Function.
- Edge Functions that already exist and are the pattern to copy:
  `provision-account` (create), `update-teacher` (edit name/password),
  `update-student`. All authorize the caller with a `service_role` query
  against the **target** school, never trusting client claims, and pin CORS to
  `https://gakuenza.com`.

---

## Gap #3 — School edit / status editor on `schools.html`

**Today:** `schools.html` can create a school and shows `status` as a
read-only badge (`active`/`suspended`/`pending`). Name, kana, code, and status
cannot be edited after creation.

**Backend change required: one RLS policy. No Edge Function.**

A school-edit is a plain column update on `schools`. The only reason it fails
today is the missing UPDATE policy. Add the symmetric counterpart to the
existing INSERT policy — **platform-admin only**:

```sql
-- Migration: <applied_ts>_schools_platform_admin_update.sql
-- Apply via MCP apply_migration (writes the ledger); commit the file named to
-- the applied ledger version in the same PR.
create policy schools_platform_admin_update on public.schools
  for update
  to public
  using (app_is_platform_admin())
  with check (app_is_platform_admin());
```

**RLS-safety reasoning — who may / may not:**
- **Must:** platform admin only. School lifecycle (rename, re-code,
  suspend/activate) is a platform-global operation. `schools.html` is already
  platform-admin-gated in the UI, `schools_platform_admin_insert` is already
  platform-admin only, and `app_is_platform_admin()` reads `profiles` (not
  `schools`), so it is non-circular and covers the row being updated (no
  RETURNING self-violation like the insert path once hit —
  `20260715044642`).
- **Must NOT:** school_admin or coordinator. Do **not** widen to
  `app_user_admin_school_ids()`. A school_admin flipping their own school's
  `status` from `suspended` back to `active` would let a suspended tenant
  un-suspend itself — status is precisely the lever a platform operator uses
  *over* a tenant, so it cannot be tenant-writable. Renaming/re-coding is
  likewise a cross-tenant-namespace concern (unique `code`).
- The `schools_status_check` CHECK (`active`/`suspended`/`pending`) already
  backstops the value; the frontend `<select>` must offer exactly those three.
- No PII, no `is_platform_admin` interaction — this policy touches only the
  `schools` table.

**Frontend wiring (`schools.html`, after the policy exists):**
- Add an "編集" button to each school row (already platform-admin-only page).
- Add an edit modal mirroring the existing create-school modal (`ac-modal`,
  `ac-field`, same token classes — no root `style.css`), pre-filled with
  `name` / `name_kana` / `code`, **plus** a `status` `<select>`
  (`active`=稼働中 / `suspended`=停止中 / `pending`=準備中).
- Submit: `sb.from('schools').update({ name, name_kana, code, status })
  .eq('id', schoolId)`. Handle the duplicate-`code` unique violation with the
  same message the create flow uses ("このコードは既に使われています。").
- Reuse `loadSchools()` to refresh. No new Edge Function call.

---

## Gap #2b — Staff deactivation (soft-disable), distinct from removal

**Shipped in the companion PR:** *remove from this school* — deletes the
`school_members` row (account + profile preserved), gated to
`canManageStaff`, self-lockout-guarded. That covers "this person no longer
staffs this school."

**Not shipped, needs backend:** a *soft-disable* that blocks the account from
logging in at all while preserving history and the ability to re-enable —
different from removal (which keeps the account fully usable, just unaffiliated)
and from deletion (destructive). There is no disable flag or auth-ban path the
client can reach today.

**Recommended design: a `service_role` Edge Function `set-staff-active`.**
Do **not** add a client-writable `disabled` column — a client-enforced flag is
not a real security boundary (RLS/login is), and the login path
(`student-login` / GoTrue) does not consult such a flag today. Banning at the
auth layer is the honest mechanism.

```
POST /functions/v1/set-staff-active   (verify_jwt: required)
Body: { staff_id, school_id, active: boolean }
200 { ok: true } | 4xx { ok: false, error }
```

Function logic (copy `update-teacher`'s skeleton):
1. Authenticate caller via anon-client `getUser()`.
2. Authorize: caller is platform admin **or** `school_admin` of `school_id`
   (the exact check `update-teacher` uses — **not** the broader
   staff/coordinator check). Coordinators must be rejected even on a direct
   call.
3. Verify `staff_id` has a `school_members` row at `school_id` with role in
   `('school_admin','coordinator','educator')`.
4. **Refuse if `staff_id === callerId`** (no self-disable / self-lockout).
5. **Refuse if the target is a platform admin** (`profiles.is_platform_admin`)
   — a school_admin must never be able to disable a platform operator.
6. Apply via `service.auth.admin.updateUserById(staff_id, { ban_duration })`:
   `"876000h"` (~100y) to disable, `"none"` to re-enable. (GoTrue ban is the
   supported soft-disable; it blocks sign-in without deleting anything.)

**RLS-safety reasoning — who may / may not:**
- **Must:** platform admin (any school); school_admin (own school only).
- **Must NOT:** coordinator (excluded, like `provision-account` /
  `update-teacher`); anyone disabling **themselves** or **a platform admin**;
  anyone acting cross-tenant (the school_admin check is per `school_id`, and
  step 3 confirms the target actually belongs to it).
- Touches `auth.users` ban state only — never `is_platform_admin`, never a
  client-writable column.

**Frontend wiring (`teachers.html`):** add a "利用停止 / 利用再開" toggle in the
edit-teacher modal's danger section (next to the shipped remove button), shown
only when `admin.canManageStaff` and the row is not the caller's own. Reflect
state with a badge on the staff card (needs the function to also return, or a
follow-up read of, ban state — GoTrue exposes `banned_until` via
`admin.getUserById`, so a small addition to the teachers list load can surface
it, or defer the badge until the toggle is proven).

---

## Gap #4b — Account lookup by email (the part of #4 that isn't frontend)

**Shipped in the companion PR:** the cross-school staff **directory**
(`staff-directory.html`) — every staff `school_members` row the caller can
SELECT, grouped per person into a footprint (which schools + roles), with
name/school search. That answers "show me a coordinator's full footprint."

**Not shipped, needs backend:** "does this email already have an account?"
(the enumeration-y half of #4). `profiles` has no email column and the anon key
cannot read `auth.users`, so this is impossible without `service_role`.

**Recommended design: a `service_role` Edge Function `lookup-account`.**

```
POST /functions/v1/lookup-account   (verify_jwt: required)
Body: { email }
200 { ok: true, exists: boolean,
       account?: { display_name, schools: [{ school_id, name, role }] } }
4xx { ok: false, error }
```

Function logic:
1. Authenticate caller.
2. **Authorize: platform admin only.** A cross-school "is this email taken /
   whose account is it" probe is a platform-operator tool; scoping it to a
   single school would make it useless for its stated purpose (deduping across
   tenants) and handing it to school_admins/coordinators would turn it into an
   account-enumeration oracle across tenants they don't administer.
3. Look up the auth user by email with the `service_role` admin API. If found,
   return **only** `display_name` and the caller-visible school memberships —
   never the raw `auth.users` row, never `is_platform_admin`, never other
   PII.
4. On not-found, return `{ ok: true, exists: false }` — this is acceptable
   *because the endpoint is platform-admin only*; it is not exposed to the
   general enumeration surface the way `student-login` is (which is why that
   one returns a single generic error).

**RLS-safety reasoning — who may / may not:**
- **Must:** platform admin only.
- **Must NOT:** school_admin, coordinator, educator, student, anon — all
  rejected at step 2, so the endpoint cannot be used to enumerate accounts of
  tenants the caller doesn't operate.
- Returns a deliberately minimal projection; no `is_platform_admin`, no email
  echo of other accounts, no auth internals.

**Frontend wiring:** add an email field + "確認" button to `staff-directory.html`
(platform-admin-only nav already), showing exists/owner-footprint or "未登録".
Optionally pre-check from the create-teacher modal in `teachers.html` before
calling `provision-account`, to warn on an already-registered email.

---

## Out of scope / explicitly deferred
- **Full staff account deletion** (destroying the `auth.users` row): a separate
  `service_role` Edge Function if ever needed; "remove from school" +
  soft-disable cover the practical cases without a destructive irreversible op.
- **Role edit / remove-from-school / staff directory**: already shipped as
  frontend-only in the companion PR — nothing backend-side is owed for them.
