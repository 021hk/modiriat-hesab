import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // خروجی کاملاً استاتیک — برنامه به‌صورت آفلاین روی گوشی (APK) و وب اجرا می‌شود
  output: "export",
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
