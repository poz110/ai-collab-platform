import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Docker 镜像使用 standalone 输出（frontend/Dockerfile）；monorepo 需指定 tracing 根
  output: "standalone",
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
  async rewrites() {
    // 开发/容器环境代理 API 与 SSE 到 backend（架构文档 §4：/api/v1 前缀）
    const api = process.env.API_ORIGIN ?? "http://localhost:3001";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
    ];
  },
};

export default nextConfig;
