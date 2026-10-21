import { NextResponse } from "next/server";
import { authorize, sameOrigin } from "@/lib/admin-auth";
import { reject, ReleaseError } from "@/lib/release/ops";
import { backTo, form, wantsJson } from "../../../_shared";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Reject: discard the staged release (main is untouched). */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!sameOrigin(req)) return NextResponse.json({ error: { status: 403, code: "FORBIDDEN", message: "Cross-origin request refused." } }, { status: 403 });
  const f = await form(req);
  const link = { release: id, exp: f("exp"), sig: f("sig") };
  const mode = await authorize({ ...link, secret: req.headers.get("x-admin-secret") });
  const json = wantsJson(req);
  if (!mode) return json ? NextResponse.json({ error: { status: 401, code: "UNAUTHORIZED", message: "Not authorized." } }, { status: 401 }) : backTo(req, { ...link, err: "Not authorized" });
  try {
    const r = await reject(id, { actor: mode === "link" ? "review-link" : "admin", note: f("note") ?? undefined });
    return json ? NextResponse.json({ data: r }) : backTo(req, { ...link, done: "rejected" });
  } catch (e) {
    const status = e instanceof ReleaseError ? e.status : 500;
    const message = e instanceof ReleaseError ? e.message : "Reject failed.";
    return json ? NextResponse.json({ error: { status, code: "REJECT_FAILED", message } }, { status }) : backTo(req, { ...link, err: message });
  }
}
