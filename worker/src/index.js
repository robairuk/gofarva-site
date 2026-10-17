/**
 * Go Farva launch newsletter Worker.
 * Only route: POST /api/subscribe (plus CORS preflight).
 * No list/export HTTP endpoints — use export.sh on the box.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const RATE_LIMIT_MAX = 5;

function allowedOrigins(env) {
  const raw = env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "https://gofarva.run";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(origin, allowedList) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && allowedList.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > MAX_EMAIL_LEN) return false;
  if (trimmed.includes("\n") || trimmed.includes("\r")) return false;
  return EMAIL_RE.test(trimmed);
}

export async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(`${ip || "unknown"}|${salt || ""}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function utcHourWindow(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = String(now.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:00:00Z`;
}

export async function handleSubscribe(request, env, opts = {}) {
  const allowedList = allowedOrigins(env);
  const origin = request.headers.get("Origin") || "";
  const cors = corsHeaders(origin, allowedList);

  if (request.method === "OPTIONS") {
    if (origin && !allowedList.includes(origin)) {
      return new Response(null, { status: 403, headers: cors });
    }
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405, cors);
  }

  if (origin && !allowedList.includes(origin)) {
    return json({ ok: false, error: "Origin not allowed." }, 403, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400, cors);
  }

  // Honeypot: silent success so bots think it worked.
  if (body && typeof body.website === "string" && body.website.trim() !== "") {
    return json({ ok: true }, 200, cors);
  }

  const emailRaw = body && body.email;
  if (!isValidEmail(emailRaw)) {
    return json({ ok: false, error: "Please enter a valid email address." }, 400, cors);
  }

  const consent =
    body.consent === true ||
    body.consent === "true" ||
    body.consent === 1 ||
    body.consent === "1";
  if (!consent) {
    return json({ ok: false, error: "Consent is required." }, 400, cors);
  }

  const email = normalizeEmail(emailRaw);
  const consentVersion =
    (typeof body.consent_text_version === "string" && body.consent_text_version.trim()) ||
    env.CONSENT_TEXT_VERSION_DEFAULT ||
    "launch-notify-v1";
  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, 120)
      : "gofarva.run/home";

  const ip =
    opts.ip ||
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown";

  if (!env.DB) {
    return json({ ok: false, error: "Storage unavailable." }, 500, cors);
  }
  if (!env.SALT) {
    return json({ ok: false, error: "Server misconfigured." }, 500, cors);
  }

  const bucketKey = await hashIp(ip, env.SALT);
  const windowStart = utcHourWindow(opts.now ? new Date(opts.now) : new Date());

  const existing = await env.DB.prepare(
    "SELECT hit_count FROM rate_limits WHERE bucket_key = ? AND window_start = ?"
  )
    .bind(bucketKey, windowStart)
    .first();

  const hits = existing ? Number(existing.hit_count) : 0;
  if (hits >= RATE_LIMIT_MAX) {
    return json({ ok: false, error: "Too many requests. Please try again later." }, 429, cors);
  }

  await env.DB.prepare(
    `INSERT INTO rate_limits (bucket_key, window_start, hit_count)
     VALUES (?, ?, 1)
     ON CONFLICT(bucket_key, window_start)
     DO UPDATE SET hit_count = hit_count + 1`
  )
    .bind(bucketKey, windowStart)
    .run();

  const nowIso = (opts.now ? new Date(opts.now) : new Date()).toISOString();

  await env.DB.prepare(
    `INSERT INTO subscribers (email, email_normalized, created_at, updated_at, consent, consent_text_version, source)
     VALUES (?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       email_normalized = excluded.email_normalized,
       updated_at = excluded.updated_at,
       consent = 1,
       consent_text_version = excluded.consent_text_version,
       source = excluded.source`
  )
    .bind(email, email, nowIso, nowIso, consentVersion, source)
    .run();

  return json({ ok: true }, 200, cors);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // Accept /api/subscribe (route pattern) and /subscribe (api.gofarva.run fallback)
    if (path === "/api/subscribe" || path === "/subscribe") {
      return handleSubscribe(request, env);
    }

    return json({ ok: false, error: "Not found." }, 404, {
      "Cache-Control": "no-store",
    });
  },
};
