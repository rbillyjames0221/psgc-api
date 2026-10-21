import { ApiError, handler, ok, preflight } from "@/lib/api";
import { getMeta } from "@/lib/data";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export const GET = handler(async () => {
  const meta = await getMeta();
  if (!meta) throw new ApiError(503, "SERVICE_UNAVAILABLE", "No approved PSGC release has been published yet.");
  // Short cache so clients notice new releases quickly.
  return ok({ data: meta }, { "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600" });
});
