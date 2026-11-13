import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  experimental: {
    // Volta para uma aba já visitada sem esperar o servidor: mostra o cache na hora e o
    // RealtimeRefresh busca dados frescos em segundo plano (stale-while-revalidate).
    staleTimes: { dynamic: 300, static: 300 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSerwist(nextConfig);
