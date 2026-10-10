import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // A bun.lock in the home directory otherwise makes Next treat ~ as the project root.
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    // Quiz images use a neutral .asset extension; all of them are normalized PNGs.
    return [{ source: "/images/quiz/:file*", headers: [{ key: "Content-Type", value: "image/png" }] }];
  },
  async redirects() {
    return [
      { source: "/trivia", destination: "/quiz", permanent: false },
      { source: "/admin/trivia", destination: "/control", permanent: false },
      { source: "/present/trivia", destination: "/display", permanent: false },
      { source: "/quiz/liv", destination: "/quiz", permanent: false },
    ];
  },
};

export default nextConfig;
