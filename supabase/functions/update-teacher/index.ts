// supabase/functions/update-teacher/index.ts
//
// Lets a school_admin (or platform admin) edit an existing teacher/
// school_admin: display name and/or password. Deliberately NOT
// available to coordinators — password reset for staff accounts stays
// a top-tier-only action per product decision 2026-07-09, same as
// creating teachers/admins in the first place (provision-account).
//
// Simpler than update-student in one respect: teachers use their real
// email, which this function never touches — no synthetic-email
// regeneration concern like student_number edits have.
//
// Deploy:   supabase functions deploy update-teacher
// Secrets:  same three as provision-account/update-student.
//
// Contract (POST, JSON, Authorization: Bearer <caller's access token>):
//   { staff_id, school_id, display_name, password? }
//   - school_id: the school the admin is acting as admin of.
//   - password: optional. Omit/blank to leave unchanged. Admin types it
//     directly (matches update-student's edit-flow decision — different
//     from provision-account's auto-generate + one-time-reveal, which is
//     for account CREATION specifically).
//
// Responses:
//   200 { ok: true }
//   4xx { ok: false, error: <human-readable> }

import { createClient } from "npm:@supabase/supabase-js@2";

type Body = {
  staff_id: string;
  school_id: string;
  display_name: string;
  password?: string;
};

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
  const { staff_id, school_id, display_name } = body;
  if (!staff_id || !school_id || !display_name?.trim()) {
    return json(400, { ok: false, error: "必須項目が不足しています" });
  }
  if (body.password !== undefined && body.password !== "" && body.password.trim().length < 8) {
    return json(400, { ok: false, error: "パスワードは8文字以上にしてください" });
  }

  // ── 3. Authorize: caller must be a TOP-TIER admin of school_id ─────────
  // Deliberately app_user_admin_school_ids()-equivalent logic (school_admin
  // or platform admin), NOT the broader staff/coordinator check used
  // elsewhere — coordinators cannot reach this function successfully even
  // if they call it directly, not just because the UI hides the button.
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

  // ── 4. Verify the target is actually staff at this school ──────────────
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

  // ── 5. Profile update ────────────────────────────────────────────────
  const { error: profileErr } = await service
    .from("profiles")
    .update({ display_name: display_name.trim() })
    .eq("id", staff_id);
  if (profileErr) {
    return json(500, { ok: false, error: "プロフィールを更新できませんでした" });
  }

  // ── 6. Password (optional) ──────────────────────────────────────────────
  const wantsPasswordChange = !!body.password && body.password.trim().length > 0;
  if (wantsPasswordChange) {
    const { error: authErr } = await service.auth.admin.updateUserById(staff_id, {
      password: body.password!.trim(),
    });
    if (authErr) {
      return json(500, { ok: false, error: "パスワードを更新できませんでした" });
    }
  }

  return json(200, { ok: true });
});
