import { ApiError, handler, ok, optCode, preflight } from "@/lib/api";
import { search } from "@/lib/data";
import { LEVELS, type AreaLevel } from "@/lib/psgc/rows";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const SEARCHABLE: AreaLevel[] = LEVELS.filter((l) => l !== "special-area");

export const GET = handler(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  if (q.length < 2) throw new ApiError(400, "BAD_REQUEST", "q is required (at least 2 characters).");
  if (q.length > 100) throw new ApiError(400, "BAD_REQUEST", "q is too long (max 100 characters).");
  const limit = sp.get("limit") === null ? 20 : Number(sp.get("limit"));
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(400, "BAD_REQUEST", "limit must be an integer between 1 and 100.");
  let levels: AreaLevel[] = SEARCHABLE;
  if (sp.get("level")) {
    levels = sp.get("level")!.split(",").map((s) => s.trim().toLowerCase()) as AreaLevel[];
    const bad = levels.filter((l) => !SEARCHABLE.includes(l));
    if (bad.length) throw new ApiError(400, "BAD_REQUEST", `Unknown level(s): ${bad.join(", ")}. Use: ${SEARCHABLE.join(", ")}.`);
  }
  const r = await search(q, { limit, levels, region: optCode(sp, "region"), province: optCode(sp, "province") });
  return ok({ data: r.results, meta: { query: q, total: r.total, limit, returned: r.results.length } });
});
