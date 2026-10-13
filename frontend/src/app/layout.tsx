import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Collab Platform",
  description: "AI 驱动的项目看板与任务编排平台 —— 任务不只分配给人，也分配给 Agent",
  manifest: "/manifest.json", // PWA：移动端方案（prototype/README.md §四）
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
