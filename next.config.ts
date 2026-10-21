import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` is a Node-only driver; keep it out of the bundle.
  serverExternalPackages: ["pg", "ws", "@neondatabase/serverless"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] },
      { source: "/api/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
