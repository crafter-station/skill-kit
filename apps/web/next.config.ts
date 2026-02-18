import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	serverExternalPackages: ["@takumi-rs/image-response"],
};

export default nextConfig;
