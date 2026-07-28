import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const development = process.env.NODE_ENV === "development";
const scriptPolicy = `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`;
const contentSecurityPolicy = [
  "default-src 'self'",
  scriptPolicy,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://covers.openlibrary.org https://upload.wikimedia.org https://static.tvmaze.com https://images.openfoodfacts.org https://www.artic.edu https://cdn.myanimelist.net https://media.dev.to https://*.dev.to https://*.mzstatic.com https://cdn.animenewsnetwork.com https://www.animenewsnetwork.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.bigdatacloud.net https://api.open-meteo.com",
  "media-src 'self' blob: https:",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), serial=(), bluetooth=(), geolocation=(self)" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: projectRoot,
  turbopack: { root: projectRoot },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
