// supabase/functions/provision-account/index.ts
//
// The single privileged endpoint of the platform. Creates auth accounts on
// behalf of a school admin — the one operation a static frontend cannot do,
// because it requires the service_role key.
//
// Deploy:   supabase functions deploy provision-account
// Secrets:  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY
//           are injected automatically by the platform.
//
// Contract (POST, JSON, Authorization: Bearer <caller's access token>):
//   Create a student:
//     { kind: "student", school_id, class_id, student_number,
//       display_name, password? }
//   Create a teacher, admin, or coordinator:
//     { kind: "teacher" | "admin" | "coordinator", school_id, email,
//       display_name, password? }
//
// Responses:
//   200 { ok: true, user_id, login: <email or synthetic email>,
//         initial_password: <only if generated>, existing?: true }
//   4xx { ok: false, error: <human-readable, no internals leaked> }
//
// Security model:
//   1. Caller must present a valid JWT (verified via anon client getUser).
//   2. Caller must have an 'admin' row in school_members for the TARGET
//      school — checked with the service client, not trusting any claims.
//   3. All inserts run as service_role (bypasses RLS deliberately), with
//      best-effort rollback of the auth user if a later step fails.
//   4. Synthetic student emails are never real mailboxes:
//        s{student_number}.{class_id}@{school_slug}.students.gakuenza.com
//      student_number is unique only WITHIN a class, so the class id is part
//      of the address — a school-wide s{number}@... collides across grades.
//      email_confirm is set so no confirmation mail is ever attempted.

import { createClient } from "npm:@supabase/supabase-js@2";

// NOTE (2026-07-08): production's school_members.role check constraint
// uses ('school_admin', 'educator', 'student') — not 'admin'/'teacher'.
// The external API of this function keeps the simpler admin/teacher/
// student vocabulary (matches what the frontend and this whole design
// doc use); this map is the one place that translates to the DB's actual
// values, so nothing else in the function needs to know about the split.
// 'coordinator' (added #114) is 1:1 — the DB role constraint already spells
// it 'coordinator', so no rename is needed, unlike admin/teacher.
const DB_ROLE: Record<"admin" | "teacher" | "coordinator", "school_admin" | "educator" | "coordinator"> = {
  admin: "school_admin",
  teacher: "educator",
  coordinator: "coordinator",
};

type Body = {
  kind: "student" | "teacher" | "admin" | "coordinator";
  school_id: string;
  class_id?: string;
  student_number?: string;
  email?: string;
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

function generatePassword(): string {
  // 12 chars, unambiguous alphabet (no 0/O/1/l/I) — teachers read these
  // aloud to young students, so legibility beats maximal entropy here.
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function slugify(name: string): string {
  // ASCII-only slug for the synthetic email domain label.
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
  const { kind, school_id, display_name } = body;
  if (!kind || !school_id || !display_name?.trim()) {
    return json(400, { ok: false, error: "必須項目が不足しています" });
  }
  if (!["student", "teacher", "admin", "coordinator"].includes(kind)) {
    return json(400, { ok: false, error: "不正なアカウント種別です" });
  }

  // ── 3. Authorize: caller must be an admin of the TARGET school ───────
  // Platform admins (profiles.is_platform_admin) are authorized for every
  // school and have no school_members row to check against — added
  // 2026-07-09 alongside migration_platform_admin.sql, same "all schools,
  // present and future" grant, checked here independently rather than
  // trusted from the client for the same reason the school_admin check
  // below is a service-role query, not a client claim.
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
      return json(403, { ok: false, error: "この学校の管理者権限がありません" });
    }
  }

  // ── 4. Resolve identity per kind ──────────────────────────────────────
  let loginEmail: string;
  let studentNumber: string | null = null;
  let classId: string | null = null;

  if (kind === "student") {
    studentNumber = (body.student_number ?? "").trim();
    classId = body.class_id ?? null;
    if (!/^[A-Za-z0-9-]{1,32}$/.test(studentNumber)) {
      return json(400, { ok: false, error: "出席番号の形式が正しくありません" });
    }
    if (!classId) {
      return json(400, { ok: false, error: "クラスを指定してください" });
    }
    // class must belong to the target school (prevents cross-tenant enroll)
    const { data: cls } = await service
      .from("classes").select("id").eq("id", classId).eq("school_id", school_id).maybeSingle();
    if (!cls) return json(400, { ok: false, error: "指定されたクラスが見つかりません" });

    // Idempotent import: student_number is unique only WITHIN a class, so a
    // re-run of a partially-failed CSV would otherwise collide. If this exact
    // (class, student_number) already has a student, treat it as success and
    // do NOT create a duplicate account.
    const { data: dup } = await service
      .from("enrollments")
      .select("user_id, profiles!inner(student_number)")
      .eq("class_id", classId)
      .eq("role", "student")
      .eq("profiles.student_number", studentNumber)
      .limit(1);
    if (dup && dup.length > 0) {
      const existingId = dup[0].user_id as string;
      const { data: eu } = await service.auth.admin.getUserById(existingId);
      return json(200, {
        ok: true,
        user_id: existingId,
        login: eu?.user?.email ?? null,
        existing: true,
      });
    }

    const { data: school } = await service
      .from("schools").select("name").eq("id", school_id).single();
    const slug = slugify(school?.name ?? "school") + "-" + school_id.slice(0, 8);
    // student_number is per-CLASS (every class has its own "1番"), so the
    // synthetic email is scoped by class id too. A school-wide s{number}@...
    // collides across grades; appending the class id makes it unique and
    // stable per (class, number).
    const classTag = classId.replace(/-/g, "");
    loginEmail = `s${studentNumber.toLowerCase()}.${classTag}@${slug}.students.gakuenza.com`;
  } else {
    const email = (body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json(400, { ok: false, error: "メールアドレスの形式が正しくありません" });
    }
    loginEmail = email;
  }

  // ── 5. Create the auth user ───────────────────────────────────────────
  const password = body.password?.trim() || generatePassword();
  const generated = !body.password?.trim();
  if (password.length < 8) {
    return json(400, { ok: false, error: "パスワードは8文字以上にしてください" });
  }

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true, // no confirmation mail — synthetic addresses aren't mailboxes
    user_metadata: { display_name, provisioned_by: callerId },
  });
  if (createErr || !created?.user) {
    const msg = /already/i.test(createErr?.message ?? "")
      ? "このログインIDは既に使われています"
      : "アカウントを作成できませんでした";
    return json(409, { ok: false, error: msg });
  }
  const newUserId = created.user.id;

  // ── 6. Profile + membership/enrollment, with rollback on failure ──────
  const rollback = async () => {
    await service.auth.admin.deleteUser(newUserId).catch(() => {});
  };

  const { error: profileErr } = await service.from("profiles").insert({
    id: newUserId,
    display_name,
    student_number: studentNumber,
    must_change_password: true,
  });
  if (profileErr) {
    await rollback();
    return json(500, { ok: false, error: "プロフィールを作成できませんでした" });
  }

  if (kind === "student") {
    const { error: enrollErr } = await service.from("enrollments").insert({
      user_id: newUserId,
      class_id: classId,
      role: "student",
    });
    if (enrollErr) {
      await rollback();
      return json(500, { ok: false, error: "クラスに登録できませんでした" });
    }
  } else {
    const { error: memberErr } = await service.from("school_members").insert({
      school_id,
      user_id: newUserId,
      role: DB_ROLE[kind as "admin" | "teacher" | "coordinator"], // DB check constraint backstops this too
    });
    if (memberErr) {
      await rollback();
      return json(500, { ok: false, error: "学校メンバーとして登録できませんでした" });
    }
  }

  return json(200, {
    ok: true,
    user_id: newUserId,
    login: loginEmail,
    ...(generated ? { initial_password: password } : {}),
  });
});
