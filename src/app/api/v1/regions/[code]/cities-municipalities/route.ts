import { ApiError, handler, listBody, ok, optCode, assertCode, pagination, preflight } from "@/lib/api";
import { getArea, queryAreas } from "@/lib/data";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ code: string }> };

export const GET = handler(async (req: Request, ctx: Ctx) => {
  const code = assertCode((await ctx.params).code);
  if (!(await getArea(code, ["region"]))) throw new ApiError(404, "NOT_FOUND", `Region ${code} not found.`);
  const sp = new URL(req.url).searchParams;
  const { page, limit } = pagination(sp, { limit: 2000, max: 2000 });
  const r = await queryAreas({ levels: ["city", "municipality"], region: code, province: optCode(sp, "province", true), page, limit });
  return ok(listBody(r.items, r.total, page, limit, { regionCode: code }));
});
