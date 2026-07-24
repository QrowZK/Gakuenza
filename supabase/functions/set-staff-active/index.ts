// supabase/functions/set-staff-active/index.ts
//
// Gap #2b (roadmap Near-term-debt #9) — staff soft-disable, distinct from
// removal. "Remove from this school" (shipped) deletes a school_members row but
// leaves the account fully usable, just unaffiliated. This is the different
// thing: block the account from signing in AT ALL while preserving history and
// the ability to re-enable — without deleting anything.
//
// The honest mechanism is a GoTrue auth-layer ban, not a client-writable
// `disabled` column: a client-enforced flag is not a real security boundary
// (RLS/login is), and the login path does not consult such a flag today.
// `ban_duration: "876000h"` (~100y) disables; `"none"` re-enables.
//
// Deploy:   supabase functions deploy set-staff-active
// Secrets:  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY
//           are injected automatically by the platform (same three as
//           provision-account / update-teacher / update-student).
//
// Contract (POST, JSON, Authorization: Bearer <caller's access token>):
//   { staff_id, school_id, active: boolean }
//   - active:false → disable (ban);  active:true → re-enable (unban).
//
// Responses:
//   200 { ok: true }
//   4xx { ok: false, error: <human-readable, no internals leaked> }
//
// Security model (who MAY / MUST NOT):
//   MAY:     platform admin (any school); school_admin of school_id (own only).
//   MUST NOT: coordinator (rejected even on a direct call, like update-teacher);
//            anyone disabling THEMSELVES (self-lockout) or A PLATFORM ADMIN;
//            anyone acting cross-tenant (the school_admin check is per school_id,
//            and step 4 confirms the target actually belongs to it).
//   Touches auth.users ban state only — never is_platform_admin, never a
//   client-writable column.

import { createClient } from "npm:@supabase/supabase-js@2";

type Body = {
  staff_id: string;
  school_id: string;
  active: boolean;
};

// ~100 years — GoTrue accepts a Go duration string; there is no "forever"
// literal, so this is the conventional "effectively permanent" ban. "none"
// clears it.
const BAN_DURATION_DISABLE = "876000h";
const BAN_DURATION_ENABLE = "none";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const service = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "https://gakuenza.com",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: "POST only" });

  // ── 1. Authenticate the caller ────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { ok: false, error: "認証が必要です" });

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json(401, { ok: false, error: "セッションが無効です" });
  }
  const callerId = userData.user.id;

  // ── 2. Parse + validate body ──────────────────────────────────────────
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "不正なリクエストです" });
  }
  const { staff_id, school_id } = body;
  if (!staff_id || !school_id || typeof body.active !== "boolean") {
    return json(400, { ok: false, error: "必須項目が不足しています" });
  }

  // ── 3. Refuse self-disable (self-lockout guard) ───────────────────────
  // Checked before the authorization query so a caller can never lock
  // themselves out even when they are a legitimate admin of this school.
  if (staff_id === callerId) {
    return json(400, { ok: false, error: "自分自身を利用停止にはできません" });
  }

  // ── 4. Authorize: caller must be a TOP-TIER admin of school_id ─────────
  // school_admin or platform admin ONLY — deliberately NOT the broader
  // staff/coordinator check. Coordinators cannot reach this successfully
  // even calling it directly, not just because the UI hides the button
  // (same posture as provision-account / update-teacher).
  const { data: callerProfile } = await service
    .from("profiles").select("is_platform_admin").eq("id", callerId).maybeSingle();
  const isPlatformAdmin = !!callerProfile?.is_platform_admin;

  if (!isPlatformAdmin) {
    const { data: adminRow } = await service
      .from("school_members")
      .select("role")
      .eq("school_id", school_id)
      .eq("user_id", callerId)
      .eq("role", "school_admin")
      .maybeSingle();
    if (!adminRow) {
      return json(403, { ok: false, error: "この操作には学校管理者権限が必要です" });
    }
  }

  // ── 5. Verify the target is actually staff at this school ──────────────
  const { data: targetRow } = await service
    .from("school_members")
    .select("role")
    .eq("school_id", school_id)
    .eq("user_id", staff_id)
    .in("role", ["school_admin", "coordinator", "educator"])
    .maybeSingle();
  if (!targetRow) {
    return json(404, { ok: false, error: "この学校の教員が見つかりません" });
  }

  // ── 6. Refuse disabling a platform admin ──────────────────────────────
  // A school_admin must never be able to disable a platform operator, even
  // one who happens to hold a school_members row at their school.
  const { data: targetProfile } = await service
    .from("profiles").select("is_platform_admin").eq("id", staff_id).maybeSingle();
  if (targetProfile?.is_platform_admin) {
    return json(403, { ok: false, error: "全校管理者を利用停止にはできません" });
  }

  // ── 7. Apply the ban / unban at the auth layer ────────────────────────
  const { error: banErr } = await service.auth.admin.updateUserById(staff_id, {
    ban_duration: body.active ? BAN_DURATION_ENABLE : BAN_DURATION_DISABLE,
  });
  if (banErr) {
    return json(500, {
      ok: false,
      error: body.active ? "利用を再開できませんでした" : "利用を停止できませんでした",
    });
  }

  return json(200, { ok: true });
});
