import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep production verification from overwriting the running dev server's bundles.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // `pg` must never be bundled into a browser build. It is server-only.
  serverExternalPackages: ["pg", "argon2"],
  async headers() {
    const productionHeaders = process.env.NODE_ENV === "production"
      ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
      : [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...productionHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
