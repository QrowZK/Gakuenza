// supabase/functions/report-bug/index.ts
//
// Staff-only in-app bug reporter. Turns a short description + auto-captured
// context (page URL, role, timestamp) into a GitHub issue labeled
// `user-report`, which the bug-diagnose workflow then investigates.
//
// Deploy:   supabase functions deploy report-bug
// Secrets:  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are
//           injected automatically. GITHUB_TOKEN must be set manually — a
//           fine-grained PAT (or GitHub App token) with Issues: write on this
//           repo ONLY, nothing else:
//             supabase secrets set GITHUB_TOKEN=github_pat_xxx
//           Optional: GITHUB_REPO (default "QrowZK/Gakuenza"),
//                     BUG_REPORT_RATE_PER_HOUR (default 5).
//
// Contract (POST, JSON, Authorization: Bearer <caller access token>):
//   { description: string, pageUrl?: string }
//   200 { ok: true, issue_number, issue_url }
//   4xx { ok: false, error: <human-readable JP, no internals> }
//
// Security model (mirrors provision-account):
//   1. Caller must present a valid JWT (verified via anon-client getUser).
//   2. Caller must be STAFF — is_platform_admin, or a school_members row with
//      role in (school_admin, coordinator, educator). Students are rejected.
//   3. Per-user rate limit (default 5/hour) counted from bug_reports, because
//      each issue can trigger real Claude usage against the subscription quota.
//      Platform admins are EXEMPT: they are the owner / trust root, bear that
//      Claude cost themselves, and run QA sweeps that legitimately file many
//      small reports in one sitting. The cap only guards client-school staff.
//   4. The GitHub token lives only here (service-side); never client-exposed.
//   5. Role in the issue body is resolved server-side, not trusted from the
//      client. pageUrl is client context (length-capped, newlines stripped).

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";
const GITHUB_REPO = Deno.env.get("GITHUB_REPO") ?? "QrowZK/Gakuenza";
const RATE_PER_HOUR = Number(Deno.env.get("BUG_REPORT_RATE_PER_HOUR") ?? "5");

const STAFF_ROLES = ["school_admin", "coordinator", "educator"];
const MAX_DESC = 5000;
const MAX_URL = 500;

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

function titleFrom(description: string): string {
  const firstLine = description.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length) ?? "";
  const base = firstLine || "ユーザー報告";
  return base.length > 72 ? base.slice(0, 71) + "…" : base;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: "POST only" });

  // ── 1. Authenticate ───────────────────────────────────────────────────
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { ok: false, error: "認証が必要です" });
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { ok: false, error: "セッションが無効です" });
  const callerId = userData.user.id;

  // ── 2. Authorize: staff only ──────────────────────────────────────────
  const { data: profile } = await service
    .from("profiles").select("is_platform_admin, display_name").eq("id", callerId).maybeSingle();
  let role: string | null = profile?.is_platform_admin ? "platform_admin" : null;
  if (!role) {
    const { data: member } = await service
      .from("school_members").select("role").eq("user_id", callerId).in("role", STAFF_ROLES).limit(1);
    role = member && member.length ? (member[0].role as string) : null;
  }
  if (!role) return json(403, { ok: false, error: "この操作はスタッフのみ利用できます" });

  // ── 3. Rate limit (client-school staff only; platform admins exempt) ──
  // The cap exists to stop a spammy/compromised staff account from burning the
  // Claude subscription quota via auto-triaged issues. The platform admin is
  // the account owner who bears that cost and does legitimate QA sweeps, so
  // they are not throttled.
  if (role !== "platform_admin") {
    const sinceIso = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await service
      .from("bug_reports").select("id", { count: "exact", head: true })
      .eq("reporter_id", callerId).gte("created_at", sinceIso);
    if ((count ?? 0) >= RATE_PER_HOUR) {
      return json(429, { ok: false, error: "報告が多すぎます。しばらくしてからもう一度お試しください。" });
    }
  }

  // ── 4. Validate ───────────────────────────────────────────────────────
  let body: { description?: string; pageUrl?: string };
  try { body = await req.json(); } catch { return json(400, { ok: false, error: "不正なリクエストです" }); }
  const description = (body.description ?? "").trim().slice(0, MAX_DESC);
  if (!description) return json(400, { ok: false, error: "不具合の内容を入力してください" });
  const pageUrl = (body.pageUrl ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, MAX_URL);

  if (!GITHUB_TOKEN) {
    // Deployed but not yet configured — fail clean, don't 500 opaquely.
    return json(503, { ok: false, error: "報告機能はまだ設定されていません（管理者にご連絡ください）。" });
  }

  // ── 5. Create the GitHub issue ────────────────────────────────────────
  const nowIso = new Date().toISOString();
  const issueBody = [
    description,
    "",
    "---",
    `**報告元ページ:** ${pageUrl || "(不明)"}`,
    `**権限:** ${role}`,
    `**報告者:** ${profile?.display_name ?? "(不明)"} (\`${callerId}\`)`,
    `**日時:** ${nowIso}`,
    "",
    "_アプリ内の不具合報告ボタンから送信。`user-report` ラベルで自動トリアージ対象です。_",
  ].join("\n");

  let issueNumber: number | null = null;
  let issueUrl: string | null = null;
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gakuenza-report-bug",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: titleFrom(description), body: issueBody, labels: ["user-report"] }),
    });
    if (!res.ok) {
      console.error("github issue create failed", res.status, await res.text());
      return json(502, { ok: false, error: "報告の送信に失敗しました。時間をおいて再度お試しください。" });
    }
    const issue = await res.json();
    issueNumber = issue.number;
    issueUrl = issue.html_url;
  } catch (err) {
    console.error("github issue create threw", err);
    return json(502, { ok: false, error: "報告の送信に失敗しました。時間をおいて再度お試しください。" });
  }

  // ── 6. Audit / rate-limit row (best-effort; never blocks the response) ─
  await service.from("bug_reports").insert({
    reporter_id: callerId,
    reporter_role: role,
    page_url: pageUrl || null,
    description,
    issue_number: issueNumber,
    issue_url: issueUrl,
  }).then(({ error }) => { if (error) console.error("bug_reports insert failed", error); });

  return json(200, { ok: true, issue_number: issueNumber, issue_url: issueUrl });
});
