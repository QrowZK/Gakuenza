// supabase/functions/student-login/index.ts
//
// Lets a student log in with {school, student_number, password} instead
// of the synthetic email their account actually uses under the hood
// (s{number}@{slug}-{school_id}...students.gakuenza.com) — no
// elementary-age student was ever going to type that correctly. This
// function does the lookup + real sign-in server-side and hands back a
// session; the browser never needs to know the email format exists.
//
// Deliberately PUBLIC (no Authorization header expected) — this IS the
// login mechanism, there's no session yet when it's called. Uses the
// service role only to look up which account matches, then performs the
// actual password check through Supabase's own normal auth flow (an
// anon-key client's signInWithPassword), not a service-role bypass —
// the password itself is still validated the standard way.
//
// Deploy:   supabase functions deploy student-login --no-verify-jwt
//           (--no-verify-jwt is required — Supabase's default JWT check
//           would otherwise reject this endpoint's own unauthenticated
//           callers before the function body ever runs.)
// Secrets:  same three as provision-account.
//
// Contract (POST, JSON, no Authorization header):
//   { class_id, student_number, password }
//   - class_id, not school_id: student_number is only meaningfully
//     unique WITHIN a class for most real schools (numbered per-class,
//     not per-school) — discovered before this shipped, not after.
//     The login page resolves down to a specific class_id via a
//     cascading school -> year -> class picker before this function is
//     ever called; scoping the lookup to that exact class is what
//     actually disambiguates correctly. The "more than one match"
//     defensive check below still stays, as a safety net for any
//     genuine data-integrity problem, not because it's expected to
//     fire in normal operation anymore.
//
// Responses:
//   200 { ok: true, session: { access_token, refresh_token } }
//   4xx { ok: false, error: <human-readable> }
//
// Security note: every failure path (student not found, ambiguous
// match, wrong password) returns the SAME generic message and status —
// deliberately, so this endpoint can't be used to enumerate which
// student numbers are valid in a given class.

import { createClient } from "npm:@supabase/supabase-js@2";

type Body = {
  class_id: string;
  student_number: string;
  password: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const service = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "https://gakuenza.com",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GENERIC_ERROR = "学校・生徒番号・パスワードをご確認ください";

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: "POST only" });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "不正なリクエストです" });
  }
  const { class_id, student_number, password } = body;
  if (!class_id || !student_number || !password) {
    return json(400, { ok: false, error: "必須項目が不足しています" });
  }

  // ── find the matching student, scoped to this exact class ───────────
  // Scoped to class_id, not school_id — student_number is only
  // meaningfully unique WITHIN a class for most real schools (numbered
  // per-class, e.g. every class has its own "1番"), not school-wide.
  // The "more than one match" check below is now a safety net for a
  // genuine data problem (e.g. a duplicate enrollment row), not the
  // normal-case disambiguation it used to have to be.
  const { data: candidates, error: lookupErr } = await service
    .from("profiles")
    .select("id, enrollments!inner(class_id, role)")
    .eq("student_number", student_number)
    .eq("enrollments.role", "student")
    .eq("enrollments.class_id", class_id);

  if (lookupErr || !candidates || candidates.length !== 1) {
    return json(401, { ok: false, error: GENERIC_ERROR });
  }
  const studentId = candidates[0].id;

  // ── resolve their real (synthetic) login email via the Admin API ────
  // Deliberately NOT reconstructing the email format here — that
  // construction logic lives in exactly one place (provision-account),
  // and staying decoupled from its exact string shape means this
  // function keeps working even if that format ever changes.
  const { data: userRes, error: userErr } = await service.auth.admin.getUserById(studentId);
  if (userErr || !userRes?.user?.email) {
    return json(401, { ok: false, error: GENERIC_ERROR });
  }

  // ── the actual password check — through normal GoTrue auth, not a
  //    service-role bypass, so this respects whatever auth policy
  //    (rate limiting etc.) already applies to every other login ──────
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signInData, error: signInErr } = await authClient.auth.signInWithPassword({
    email: userRes.user.email,
    password,
  });

  if (signInErr || !signInData?.session) {
    return json(401, { ok: false, error: GENERIC_ERROR });
  }

  return json(200, {
    ok: true,
    session: {
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    },
  });
});
