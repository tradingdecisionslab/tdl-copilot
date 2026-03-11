import type { NextConfig } from "next";
import { withWhopAppConfig } from "@whop/react/next.config";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ hostname: "**" }],
  },
};

export default withWhopAppConfig(nextConfig);
