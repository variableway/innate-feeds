import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/dsh",
  transpilePackages: ["@innate/ui"],
  // Allow shared/fe-base-themes.css to import fe-base theme files outside this app.
  turbopack: {
    root: path.resolve(__dirname, "../../../.."),
  },
  experimental: {
    // The local Prisma dev Postgres drops connections under heavy parallel
    // prerender load (P1017); serialize static generation onto one worker
    // (one DB connection per process) and retry instead.
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 50,
    staticGenerationRetryCount: 3,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "user-images.githubusercontent.com" },
      { protocol: "https", hostname: "camo.githubusercontent.com" },
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
