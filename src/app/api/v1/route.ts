import { handler, ok, preflight } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export const GET = handler(async (req: Request) => {
  const base = new URL("/api/v1", req.url).toString();
  return ok({
    name: "PSGC API",
    description: "Philippine Standard Geographic Code (PSA) as a REST API.",
    docs: new URL("/docs", req.url).toString(),
    endpoints: [
      "/meta", "/regions", "/regions/{code}", "/regions/{code}/provinces", "/regions/{code}/cities-municipalities",
      "/provinces", "/provinces/{code}", "/provinces/{code}/cities-municipalities",
      "/cities-municipalities", "/cities-municipalities/{code}", "/cities-municipalities/{code}/barangays",
      "/cities-municipalities/{code}/sub-municipalities", "/sub-municipalities", "/barangays", "/barangays/{code}",
      "/search?q=", "/codes/{code}",
    ].map((p) => base + p),
  });
});
