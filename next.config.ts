import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [
    { url: "/offline", revision: crypto.randomUUID() },
  ],
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
};

export default withSerwist(nextConfig);
