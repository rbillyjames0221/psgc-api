import { ApiError, handler, ok, assertCode, preflight } from "@/lib/api";
import { getArea } from "@/lib/data";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ code: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const code = assertCode((await ctx.params).code);
  const row = await getArea(code, ["barangay"]);
  if (!row) throw new ApiError(404, "NOT_FOUND", `Barangay ${code} not found.`);
  return ok({ data: row.data });
});
