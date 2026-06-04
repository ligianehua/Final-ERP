import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this folder so the build
  // doesn't wander up to the parent Final-ERP/ Permit project.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
