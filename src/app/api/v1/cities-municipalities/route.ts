import { handler, listBody, ok, optCode, pagination, preflight, ApiError } from "@/lib/api";
import { queryAreas } from "@/lib/data";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const TYPES: Record<string, { levels: ("city" | "municipality")[]; cityClass?: string }> = {
  city: { levels: ["city"] }, municipality: { levels: ["municipality"] },
  huc: { levels: ["city"], cityClass: "HUC" }, icc: { levels: ["city"], cityClass: "ICC" }, cc: { levels: ["city"], cityClass: "CC" },
};

export const GET = handler(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const { page, limit } = pagination(sp, { limit: 2000, max: 2000 });
  const t = sp.get("type")?.toLowerCase();
  const type = t ? TYPES[t] : { levels: ["city", "municipality"] as ("city" | "municipality")[] };
  if (!type) throw new ApiError(400, "BAD_REQUEST", "type must be one of: city, municipality, huc, icc, cc.");
  const r = await queryAreas({ levels: type.levels, cityClass: type.cityClass, region: optCode(sp, "region"),
    province: optCode(sp, "province", true), name: sp.get("name"), page, limit });
  return ok(listBody(r.items, r.total, page, limit));
});
