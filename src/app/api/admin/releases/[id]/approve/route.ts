import { NextResponse } from "next/server";
import { authorize, sameOrigin } from "@/lib/admin-auth";
import { promote, ReleaseError } from "@/lib/release/ops";
import { backTo, form, wantsJson } from "../../../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // copies ~44k rows between databases
type Ctx = { params: Promise<{ id: string }> };

/** Approve: copy the staged release into MAIN in one transaction (keeps previous main for rollback). */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!sameOrigin(req)) return NextResponse.json({ error: { status: 403, code: "FORBIDDEN", message: "Cross-origin request refused." } }, { status: 403 });
  const f = await form(req);
  const link = { release: id, exp: f("exp"), sig: f("sig") };
  const mode = await authorize({ ...link, secret: req.headers.get("x-admin-secret") });
  const json = wantsJson(req);
  if (!mode) return json ? NextResponse.json({ error: { status: 401, code: "UNAUTHORIZED", message: "Not authorized." } }, { status: 401 }) : backTo(req, { ...link, err: "Not authorized" });
  if (f("confirm") !== "yes") return json ? NextResponse.json({ error: { status: 400, code: "BAD_REQUEST", message: "confirm=yes is required." } }, { status: 400 }) : backTo(req, { ...link, err: "Tick the confirmation box to approve." });
  try {
    const r = await promote(id, { actor: mode === "link" ? "review-link" : "admin", acknowledgeWarnings: f("acknowledgeWarnings") === "yes" });
    return json ? NextResponse.json({ data: r }) : backTo(req, { ...link, done: "approved" });
  } catch (e) {
    const status = e instanceof ReleaseError ? e.status : 500;
    const message = e instanceof ReleaseError ? e.message : "Promotion failed; main was not changed.";
    if (!(e instanceof ReleaseError)) console.error(e);
    return json ? NextResponse.json({ error: { status, code: "PROMOTE_FAILED", message } }, { status }) : backTo(req, { ...link, err: message });
  }
}
