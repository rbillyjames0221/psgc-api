import { ApiError, handler, listBody, ok, assertCode, pagination, preflight } from "@/lib/api";
import { getArea, queryAreas } from "@/lib/data";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ code: string }> };

export const GET = handler(async (req: Request, ctx: Ctx) => {
  const code = assertCode((await ctx.params).code);
  if (!(await getArea(code, ["province"]))) throw new ApiError(404, "NOT_FOUND", `Province ${code} not found.`);
  const { page, limit } = pagination(new URL(req.url).searchParams, { limit: 500, max: 500 });
  const r = await queryAreas({ levels: ["city", "municipality"], province: code, page, limit });
  return ok(listBody(r.items, r.total, page, limit, { provinceCode: code }));
});
