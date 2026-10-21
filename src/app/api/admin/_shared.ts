import { NextResponse } from "next/server";

export function backTo(req: Request, params: Record<string, string | null | undefined>) {
  const u = new URL("/admin/review", req.url);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return NextResponse.redirect(u, 303);
}

export async function form(req: Request) {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return (k: string) => (j[k] === undefined || j[k] === null ? null : String(j[k]));
  }
  const f = await req.formData();
  return (k: string) => (f.get(k) === null ? null : String(f.get(k)));
}

export const wantsJson = (req: Request) => (req.headers.get("accept") ?? "").includes("application/json") || (req.headers.get("content-type") ?? "").includes("application/json");
