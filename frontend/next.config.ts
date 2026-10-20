import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La regla conecta el cargador de Tailwind v4 con Turbopack para los archivos CSS.
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
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
