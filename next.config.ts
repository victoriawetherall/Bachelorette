import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/trivia", destination: "/quiz", permanent: false },
      { source: "/admin/trivia", destination: "/control", permanent: false },
      { source: "/present/trivia", destination: "/display", permanent: false },
    ];
  },
};

export default nextConfig;
