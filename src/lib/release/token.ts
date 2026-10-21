import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed review links: HMAC-SHA256(ADMIN_SECRET, "review:<releaseId>:<expiresAtUnix>").
 * A link is tied to one staged release and stops working once that release is approved,
 * rejected or superseded (the review page/endpoints check the release is still pending),
 * so each link is effectively single-use.
 */
const secret = () => {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) throw new Error("ADMIN_SECRET must be set (at least 16 characters).");
  return s;
};

const mac = (msg: string) => createHmac("sha256", secret()).update(msg).digest("hex");

function safeEq(a: string, b: string) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function signReview(releaseId: string, ttlDays = Number(process.env.REVIEW_LINK_TTL_DAYS ?? 14)) {
  const exp = Math.floor(Date.now() / 1000) + Math.round(ttlDays * 86400);
  return { release: releaseId, exp: String(exp), sig: mac(`review:${releaseId}:${exp}`) };
}

export function verifyReview(releaseId: string | null | undefined, exp: string | null | undefined, sig: string | null | undefined): boolean {
  if (!releaseId || !exp || !sig) return false;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  try { return safeEq(mac(`review:${releaseId}:${exp}`), sig); } catch { return false; }
}

export function reviewUrl(releaseId: string) {
  const base = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const t = signReview(releaseId);
  return `${base}/admin/review?release=${encodeURIComponent(t.release)}&exp=${t.exp}&sig=${t.sig}`;
}

/** Admin session cookie value (set after logging in with ADMIN_SECRET). */
export const ADMIN_COOKIE = "psgc_admin";
export function adminSessionValue(issuedAt = Math.floor(Date.now() / 1000)) {
  return `${issuedAt}.${mac(`admin-session:${issuedAt}`)}`;
}
export function verifyAdminSession(value: string | undefined | null, maxAgeSec = 8 * 3600): boolean {
  if (!value) return false;
  const [ts, sig] = value.split(".");
  if (!ts || !sig || !/^\d+$/.test(ts) || Number(ts) + maxAgeSec < Date.now() / 1000) return false;
  try { return safeEq(mac(`admin-session:${ts}`), sig); } catch { return false; }
}
export function verifyAdminSecret(given: string | null | undefined): boolean {
  if (!given) return false;
  try { return safeEq(given, secret()); } catch { return false; }
}
