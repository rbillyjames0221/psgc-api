import { handler, listBody, ok, optCode, pagination, preflight, ApiError } from "@/lib/api";
import { queryAreas } from "@/lib/data";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export const GET = handler(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const { page, limit } = pagination(sp, { limit: 100, max: 500 });
  const ur = sp.get("urbanRural")?.toUpperCase() ?? null;
  if (ur && ur !== "U" && ur !== "R") throw new ApiError(400, "BAD_REQUEST", "urbanRural must be U or R.");
  const r = await queryAreas({
    levels: ["barangay"], region: optCode(sp, "region"), province: optCode(sp, "province", true),
    cityMunicipality: optCode(sp, "cityMunicipality") ?? optCode(sp, "city"), subMunicipality: optCode(sp, "subMunicipality"),
    urbanRural: ur as "U" | "R" | null, name: sp.get("name"), page, limit,
  });
  return ok(listBody(r.items, r.total, page, limit));
});
