import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "idomtybdmqhsxbuttubk.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  // Prevent server-side bundling for browser-only packages
  serverExternalPackages: ["html2canvas", "onnxruntime-web"],
  webpack(config) {
    // Enable async WASM imports required by onnxruntime-web
    config.experiments = { ...config.experiments, asyncWebAssembly: true }
    return config
  },
}

export default nextConfig
