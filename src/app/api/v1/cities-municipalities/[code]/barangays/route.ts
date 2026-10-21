import { ApiError, handler, listBody, ok, optCode, assertCode, pagination, preflight } from "@/lib/api";
import { getArea, queryAreas } from "@/lib/data";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ code: string }> };

export const GET = handler(async (req: Request, ctx: Ctx) => {
  const code = assertCode((await ctx.params).code);
  if (!(await getArea(code, ["city", "municipality"]))) throw new ApiError(404, "NOT_FOUND", `City/municipality ${code} not found.`);
  const sp = new URL(req.url).searchParams;
  // Default/max 1000 so even the City of Manila (896 barangays) fits in a single response for dropdowns.
  const { page, limit } = pagination(sp, { limit: 1000, max: 1000 });
  const r = await queryAreas({ levels: ["barangay"], cityMunicipality: code, subMunicipality: optCode(sp, "subMunicipality"), page, limit });
  return ok(listBody(r.items, r.total, page, limit, { cityMunicipalityCode: code }));
});
