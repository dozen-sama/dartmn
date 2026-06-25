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
  // Turbopack is default in Next.js 16 — no webpack config needed
  turbopack: {},
}

export default nextConfig
