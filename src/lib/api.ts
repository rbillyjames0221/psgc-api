import { NextResponse } from "next/server";
import { getMeta } from "./data";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
  "Access-Control-Expose-Headers": "X-PSGC-Version, X-PSGC-Release, X-Total-Count",
};
// PSGC changes quarterly: cache 1h in browsers, 1 day at the CDN, serve stale for a week while revalidating.
export const CACHE_HEADER = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export type ErrorCode = "BAD_REQUEST" | "NOT_FOUND" | "INTERNAL_ERROR" | "SERVICE_UNAVAILABLE";

async function versionHeaders(): Promise<Record<string, string>> {
  try {
    const m = await getMeta();
    return m ? { "X-PSGC-Version": m.version, "X-PSGC-Release": m.releaseId } : {};
  } catch { return {}; }
}

export async function ok(body: unknown, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status: 200, headers: { ...CORS_HEADERS, "Cache-Control": CACHE_HEADER, ...(await versionHeaders()), ...extra } });
}

export function error(status: number, code: ErrorCode, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { status, code, message, ...(details ? { details } : {}) } },
    { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
  );
}

export function preflight() {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "86400" } });
}

export class ApiError extends Error {
  constructor(public status: number, public code: ErrorCode, message: string) { super(message); }
}

/** Wrap a handler with consistent error handling. */
export function handler<C>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try { return await fn(req, ctx); } catch (e) {
      if (e instanceof ApiError) return error(e.status, e.code, e.message);
      console.error(e);
      const msg = (e as Error)?.message ?? "";
      if (/DATABASE_URL|ECONNREFUSED|connect/i.test(msg)) return error(503, "SERVICE_UNAVAILABLE", "Database unavailable.");
      return error(500, "INTERNAL_ERROR", "Unexpected server error.");
    }
  };
}

export function assertCode(code: string, label = "code") {
  if (!/^\d{10}$/.test(code)) throw new ApiError(400, "BAD_REQUEST", `Invalid ${label} '${code}'. PSGC codes are 10 digits, e.g. 1300000000.`);
  return code;
}

export function optCode(sp: URLSearchParams, key: string, allowNone = false) {
  const v = sp.get(key);
  if (v === null || v === "") return null;
  if (allowNone && v === "none") return "none";
  return assertCode(v, key);
}

export function pagination(sp: URLSearchParams, defaults: { limit: number; max: number }) {
  const page = sp.get("page") === null ? 1 : Number(sp.get("page"));
  const limit = sp.get("limit") === null ? defaults.limit : Number(sp.get("limit"));
  if (!Number.isInteger(page) || page < 1) throw new ApiError(400, "BAD_REQUEST", "page must be a positive integer.");
  if (!Number.isInteger(limit) || limit < 1 || limit > defaults.max) throw new ApiError(400, "BAD_REQUEST", `limit must be an integer between 1 and ${defaults.max}.`);
  return { page, limit };
}

export function listBody<T>(items: T[], total: number, page: number, limit: number, extra: Record<string, unknown> = {}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { data: items, meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, ...extra } };
}
