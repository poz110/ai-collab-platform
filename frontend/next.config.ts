import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // 开发环境代理 API 与 SSE 到 backend（架构文档 §4：/api/v1 前缀）
    const api = process.env.API_ORIGIN ?? "http://localhost:3001";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
    ];
  },
};

export default nextConfig;
