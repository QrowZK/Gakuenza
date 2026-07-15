// supabase/functions/update-student/index.ts
//
// Lets a school admin edit an existing student: display name, student
// number, which class they're in, and/or their password. Needs
// service_role for two reasons a plain client-side update can't cover:
//   1. Setting a password requires the Supabase Auth admin API.
//   2. Changing student_number/class must also update the underlying
//      synthetic login email (built from student_number + class in
//      provision-account) — otherwise the login identifier goes stale
//      the moment an admin fixes a typo or moves a class.
//
// Deploy:   supabase functions deploy update-student
// Secrets:  same three as provision-account.
//
// Contract (POST, JSON, Authorization: Bearer <caller's access token>):
//   { student_id, school_id, class_id, student_number, display_name,
//     password? }
//   - password: optional. Omit/blank to leave the current password
//     unchanged. When provided, admin supplies it directly.
//
// Responses:
//   200 { ok: true, login: <the student's current/new login email> }
//   4xx { ok: false, error: <human-readable, no internals leaked> }

import { createClient } from "npm:@supabase/supabase-js@2";

type Body = {
  student_id: string;
  school_id: string;
  class_id: string;
  student_number: string;
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

function slugify(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "school";
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
  const { student_id, school_id, class_id, display_name } = body;
  const studentNumber = (body.student_number ?? "").trim();
  if (!student_id || !school_id || !class_id || !display_name?.trim()) {
    return json(400, { ok: false, error: "必須項目が不足しています" });
  }
  if (!/^[A-Za-z0-9-]{1,32}$/.test(studentNumber)) {
    return json(400, { ok: false, error: "出席番号の形式が正しくありません" });
  }
  if (body.password !== undefined && body.password !== "" && body.password.trim().length < 8) {
    return json(400, { ok: false, error: "パスワードは8文字以上にしてください" });
  }

  // ── 3. Authorize: platform admin, OR school_admin/coordinator of the
  //      target school, OR a teacher assigned to the target class ───────
  const { data: callerProfile } = await service
    .from("profiles").select("is_platform_admin").eq("id", callerId).maybeSingle();
  const isPlatformAdmin = !!callerProfile?.is_platform_admin;

  let authorized = isPlatformAdmin;

  if (!authorized) {
    const { data: adminRow } = await service
      .from("school_members")
      .select("role")
      .eq("school_id", school_id)
      .eq("user_id", callerId)
      .in("role", ["school_admin", "coordinator"])
      .maybeSingle();
    authorized = !!adminRow;
  }

  if (!authorized) {
    const { data: teacherRow } = await service
      .from("class_teachers")
      .select("class_id")
      .eq("class_id", class_id)
      .eq("user_id", callerId)
      .maybeSingle();
    authorized = !!teacherRow;
  }

  if (!authorized) {
    return json(403, { ok: false, error: "この操作を行う権限がありません" });
  }

  // ── 4. Verify the target class belongs to school_id ─────────────────────
  const { data: targetClass } = await service
    .from("classes").select("id").eq("id", class_id).eq("school_id", school_id).maybeSingle();
  if (!targetClass) {
    return json(400, { ok: false, error: "指定されたクラスが見つかりません" });
  }

  // ── 5. Verify the student actually belongs to this school already ──────
  const { data: currentEnrollment } = await service
    .from("enrollments")
    .select("class_id, classes!inner(school_id)")
    .eq("user_id", student_id)
    .eq("role", "student")
    .eq("classes.school_id", school_id)
    .maybeSingle();
  if (!currentEnrollment) {
    return json(404, { ok: false, error: "この学校に所属する生徒が見つかりません" });
  }

  // ── 6. Profile update (display_name, student_number) ───────────────────
  const { error: profileErr } = await service
    .from("profiles")
    .update({ display_name: display_name.trim(), student_number: studentNumber })
    .eq("id", student_id);
  if (profileErr) {
    return json(500, { ok: false, error: "プロフィールを更新できませんでした" });
  }

  // ── 7. Class reassignment (if different) ────────────────────────────────
  const finalClassId = class_id;
  if (finalClassId !== currentEnrollment.class_id) {
    const { error: enrollErr } = await service
      .from("enrollments")
      .update({ class_id: finalClassId })
      .eq("user_id", student_id)
      .eq("role", "student");
    if (enrollErr) {
      return json(500, { ok: false, error: "クラスを変更できませんでした" });
    }
  }

  // ── 8. Rebuild the synthetic login email (per-CLASS scoped, matching
  //      provision-account) and update auth only when something changed ──
  // student_number is unique only WITHIN a class, so the synthetic email is
  // scoped by class id too: s{number}.{class_id}@{slug}...  A school-wide
  // s{number}@... would collide across grades (every class has its own
  // "1") — which is exactly what broke bulk password-setting before.
  //
  // We ALSO only touch the auth email when it actually changed: a bulk
  // password set passes the student's existing number/class unchanged, so
  // the email stays identical and we must NOT rewrite it (a needless email
  // write is what triggered the cross-grade collisions).
  const { data: school } = await service.from("schools").select("name").eq("id", school_id).single();
  const slug = slugify(school?.name ?? "school") + "-" + school_id.slice(0, 8);
  const classTag = finalClassId.replace(/-/g, "");
  const newEmail = `s${studentNumber.toLowerCase()}.${classTag}@${slug}.students.gakuenza.com`;

  const { data: existingUser } = await service.auth.admin.getUserById(student_id);
  const currentEmail = existingUser?.user?.email ?? null;

  const authUpdate: Record<string, unknown> = {};
  if (newEmail !== currentEmail) {
    authUpdate.email = newEmail;
    authUpdate.email_confirm = true;
  }
  const wantsPasswordChange = !!body.password && body.password.trim().length > 0;
  if (wantsPasswordChange) authUpdate.password = body.password!.trim();

  if (Object.keys(authUpdate).length > 0) {
    const { error: authErr } = await service.auth.admin.updateUserById(student_id, authUpdate);
    if (authErr) {
      const msg = /already|duplicate/i.test(authErr.message ?? "")
        ? "この出席番号は既に使われています"
        : "ログイン情報を更新できませんでした";
      return json(409, { ok: false, error: msg });
    }
  }

  return json(200, { ok: true, login: newEmail });
});
