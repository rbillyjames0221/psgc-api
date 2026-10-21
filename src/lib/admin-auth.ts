import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminSecret, verifyAdminSession, verifyReview } from "./release/token";

export type AuthMode = "session" | "link" | null;

/** Admin session cookie (logged in with ADMIN_SECRET) or a signed review link for this exact release. */
export async function authorize(opts: { release?: string | null; exp?: string | null; sig?: string | null; secret?: string | null }): Promise<AuthMode> {
  if (opts.secret && verifyAdminSecret(opts.secret)) return "session";
  const jar = await cookies();
  if (verifyAdminSession(jar.get(ADMIN_COOKIE)?.value)) return "session";
  if (opts.release && verifyReview(opts.release, opts.exp, opts.sig)) return "link";
  return null;
}

/** Basic CSRF defence for form POSTs: Origin (if sent) must match the host. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch { return false; }
}
