import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Electron packages the app as a standalone Node server (see electron/server.ts)
  // instead of running `next start` against a full node_modules install.
  output: "standalone",
  // Output file tracing missed @prisma/adapter-pg entirely (confirmed by
  // inspecting .next/standalone/node_modules after a real build — Prisma's
  // generated client requires it in a way static analysis doesn't follow).
  // Without this, the packaged server throws "Cannot find module
  // '@prisma/adapter-pg'" the first time it touches the database.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@prisma/client/**/*", "./node_modules/@prisma/adapter-pg/**/*"],
  },
  // This app has no CDN or remote image host to optimize for — every image
  // (company logos) is a local upload served straight off disk — so Next's
  // sharp-based optimization pipeline buys nothing here, while shipping
  // sharp's native binary would add a whole new cross-platform packaging
  // problem for electron-builder (confirmed by a real installed build
  // logging "Module `sharp` not found" the moment next/image rendered).
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Defense-in-depth for user-uploaded logos: even if a malicious SVG
        // slipped past sanitization, these headers stop it from executing
        // as active content when the URL is opened directly.
        source: "/uploads/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "script-src 'none'; sandbox" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
