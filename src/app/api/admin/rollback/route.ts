import { NextResponse } from "next/server";
import { authorize, sameOrigin } from "@/lib/admin-auth";
import { rollback, ReleaseError } from "@/lib/release/ops";
import { backTo, form, wantsJson } from "../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // copies ~44k rows between databases

/** Roll MAIN back to the previous snapshot. Admin session or X-Admin-Secret header only (not review links). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: { status: 403, code: "FORBIDDEN", message: "Cross-origin request refused." } }, { status: 403 });
  const f = await form(req);
  const mode = await authorize({ secret: req.headers.get("x-admin-secret") });
  const json = wantsJson(req);
  if (mode !== "session") return json ? NextResponse.json({ error: { status: 401, code: "UNAUTHORIZED", message: "Admin session required." } }, { status: 401 }) : backTo(req, { err: "Admin login required" });
  if (f("confirm") !== "yes") return json ? NextResponse.json({ error: { status: 400, code: "BAD_REQUEST", message: "confirm=yes is required." } }, { status: 400 }) : backTo(req, { err: "Tick the confirmation box to roll back." });
  try {
    const r = await rollback({ actor: "admin" });
    return json ? NextResponse.json({ data: r }) : backTo(req, { done: `rolled back to ${r.to}` });
  } catch (e) {
    const status = e instanceof ReleaseError ? e.status : 500;
    const message = e instanceof ReleaseError ? e.message : "Rollback failed; main was not changed.";
    return json ? NextResponse.json({ error: { status, code: "ROLLBACK_FAILED", message } }, { status }) : backTo(req, { err: message });
  }
}
