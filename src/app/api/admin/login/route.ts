import { cookies } from "next/headers";
import { sameOrigin } from "@/lib/admin-auth";
import { ADMIN_COOKIE, adminSessionValue, verifyAdminSecret } from "@/lib/release/token";
import { backTo, form } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const f = await form(req);
  const keep = { release: f("release"), exp: f("exp"), sig: f("sig") };
  if (!sameOrigin(req) || !verifyAdminSecret(f("secret"))) {
    await new Promise((r) => setTimeout(r, 500)); // slow down guessing
    return backTo(req, { ...keep, err: "Invalid admin secret" });
  }
  (await cookies()).set(ADMIN_COOKIE, adminSessionValue(), {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 3600,
  });
  return backTo(req, keep);
}
