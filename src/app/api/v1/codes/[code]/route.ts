import { ApiError, handler, ok, preflight } from "@/lib/api";
import { lookupCode } from "@/lib/data";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ code: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const code = (await ctx.params).code;
  if (!/^\d{9,10}$/.test(code)) throw new ApiError(400, "BAD_REQUEST", `Invalid code '${code}'. Use a 10-digit PSGC code (or a 9-digit correspondence code).`);
  const r = await lookupCode(code);
  if (!r) throw new ApiError(404, "NOT_FOUND", `Code ${code} not found in the current PSGC release.`);
  return ok({ data: { ...r.data, level: r.level }, ancestry: r.ancestry, fullName: r.fullName });
});
