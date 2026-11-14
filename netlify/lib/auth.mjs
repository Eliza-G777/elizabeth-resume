import crypto from "node:crypto";

const COOKIE = "et_admin";
const MAX_AGE_SECONDS = 60 * 60 * 8; // admin sessions last 8 hours

const env = (key) => (globalThis.Netlify?.env?.get(key) ?? process.env[key] ?? "");
const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

export function configError() {
  const pw = env("ADMIN_PASSWORD");
  const secret = env("SESSION_SECRET");
  if (!pw || pw.length < 8) return "ADMIN_PASSWORD is not set (needs at least 8 characters).";
  if (!secret || secret.length < 32) return "SESSION_SECRET is not set (needs at least 32 characters).";
  return null;
}

// Changing ADMIN_PASSWORD signs out every existing session.
const sessionVersion = () => sha256("v1:" + env("ADMIN_PASSWORD")).toString("base64url").slice(0, 16);
const hmac = (body) => crypto.createHmac("sha256", env("SESSION_SECRET")).update(body).digest("base64url");

export function checkPassword(input) {
  const a = sha256(input ?? "");
  const b = sha256(env("ADMIN_PASSWORD"));
  return crypto.timingSafeEqual(a, b);
}

export function sessionCookie() {
  const payload = { v: sessionVersion(), exp: Date.now() + MAX_AGE_SECONDS * 1000, n: crypto.randomUUID() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const token = `${body}.${hmac(body)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE_SECONDS}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

function readCookie(req) {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE) return rest.join("=");
  }
  return "";
}

export function isAdmin(req) {
  if (configError()) return false;
  const token = readCookie(req);
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = Buffer.from(hmac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return p.v === sessionVersion() && typeof p.exp === "number" && p.exp > Date.now();
  } catch {
    return false;
  }
}

// Mutating requests must come from the admin page itself: a custom header can't be sent cross-site without CORS.
export function requireAdmin(req) {
  if (!isAdmin(req)) return json({ error: "Your session has ended. Log in again." }, 401);
  if (req.method !== "GET" && req.headers.get("x-admin-request") !== "1") {
    return json({ error: "Request blocked." }, 403);
  }
  return null;
}
