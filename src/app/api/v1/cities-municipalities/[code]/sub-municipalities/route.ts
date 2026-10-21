import { ApiError, handler, listBody, ok, assertCode, preflight } from "@/lib/api";
import { getArea, queryAreas } from "@/lib/data";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ code: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const code = assertCode((await ctx.params).code);
  if (!(await getArea(code, ["city", "municipality"]))) throw new ApiError(404, "NOT_FOUND", `City/municipality ${code} not found.`);
  const r = await queryAreas({ levels: ["sub-municipality"], cityMunicipality: code, page: 1, limit: 100 });
  return ok(listBody(r.items, r.total, 1, 100, { cityMunicipalityCode: code }));
});
