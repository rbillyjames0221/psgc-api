import { handler, listBody, ok, optCode, pagination, preflight } from "@/lib/api";
import { queryAreas } from "@/lib/data";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export const GET = handler(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const { page, limit } = pagination(sp, { limit: 100, max: 100 });
  const r = await queryAreas({ levels: ["sub-municipality"], cityMunicipality: optCode(sp, "cityMunicipality"), page, limit });
  return ok(listBody(r.items, r.total, page, limit));
});
