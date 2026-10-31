import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avatars are served from GitHub's CDN. Only this host is allowed.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
};

export default nextConfig;
