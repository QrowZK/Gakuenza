// supabase/functions/lookup-account/index.ts
//
// Gap #4b (roadmap Near-term-debt #9) — "does this email already have an
// account?", the half of the account-lookup feature the frontend cannot do.
// Emails live only in auth.users; the anon key cannot read auth.users, so a
// service_role admin lookup is the only way to answer it.
//
// This is a cross-tenant enumeration tool, so it is PLATFORM-ADMIN ONLY. A
// per-school scope would make it useless for its stated purpose (deduping an
// email across tenants), and handing it to school_admins/coordinators would
// turn it into an account-enumeration oracle across tenants they don't operate.
//
// Deploy:   supabase functions deploy lookup-account
// Secrets:  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY
//           are injected automatically by the platform (same three as
//           provision-account / update-teacher / update-student).
//
// Contract (POST, JSON, Authorization: Bearer <caller's access token>):
//   { email }
//
// Responses:
//   200 { ok: true, exists: boolean,
//         account?: { display_name, schools: [{ school_id, name, role }] } }
//   4xx { ok: false, error: <human-readable, no internals leaked> }
//
// Deliberately minimal projection: only display_name + the target's staff
// school memberships. NEVER the raw auth.users row, NEVER is_platform_admin,
// NEVER any other PII or auth internals. Returning `exists:false` on not-found
// is acceptable BECAUSE the endpoint is platform-admin only — it is not exposed
// to the general enumeration surface that student-login guards with a single
// generic error.

import { createClient } from "npm:@supabase/supabase-js@2";

type Body = { email: string };

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
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json(400, { ok: false, error: "メールアドレスの形式が正しくありません" });
  }

  // ── 3. Authorize: PLATFORM ADMIN ONLY ─────────────────────────────────
  // Cross-tenant lookup. school_admin / coordinator / educator / student /
  // anon are all rejected here, so the endpoint can never be used to
  // enumerate accounts of tenants the caller does not operate.
  const { data: callerProfile } = await service
    .from("profiles").select("is_platform_admin").eq("id", callerId).maybeSingle();
  if (!callerProfile?.is_platform_admin) {
    return json(403, { ok: false, error: "この操作には全校管理者権限が必要です" });
  }

  // ── 4. Look the email up in auth.users via the admin API ──────────────
  // listUsers doesn't accept an exact-email filter across GoTrue versions, so
  // scan a bounded page and match case-insensitively. Staff/coordinator counts
  // are tiny; a single page is more than enough and keeps this cheap.
  const { data: usersPage, error: listErr } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    return json(500, { ok: false, error: "アカウントを照会できませんでした" });
  }
  const match = (usersPage?.users ?? []).find(
    (u: { email?: string | null }) => (u.email ?? "").toLowerCase() === email,
  );
  if (!match) {
    return json(200, { ok: true, exists: false });
  }

  // ── 5. Minimal projection: display_name + staff school footprint ──────
  const { data: prof } = await service
    .from("profiles").select("display_name").eq("id", match.id).maybeSingle();

  const { data: memberships } = await service
    .from("school_members")
    .select("school_id, role, schools(name)")
    .eq("user_id", match.id)
    .in("role", ["school_admin", "coordinator", "educator"]);

  type MemberRow = {
    school_id: string;
    role: string;
    // supabase-js may infer the embedded to-one relation as either an object
    // or a single-element array depending on version; handle both.
    schools?: { name?: string } | { name?: string }[] | null;
  };
  const schools = ((memberships ?? []) as MemberRow[]).map((m: MemberRow) => ({
    school_id: m.school_id,
    name: (Array.isArray(m.schools) ? m.schools[0]?.name : m.schools?.name)
      ?? "(不明な学校)",
    role: m.role,
  }));

  return json(200, {
    ok: true,
    exists: true,
    account: {
      display_name: prof?.display_name ?? "(表示名未設定)",
      schools,
    },
  });
});
