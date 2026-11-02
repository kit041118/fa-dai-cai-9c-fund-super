import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Session cookies and SQLite are request data. Keep API routes dynamic
  // instead of prerendering them under Cache Components.
  serverExternalPackages: ["bcryptjs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
