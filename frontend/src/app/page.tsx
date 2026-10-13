/**
 * 落地占位页 —— DEV-5 将按 docs/design/prototype/index.html 实现看板。
 * 本页用于验证开发环境（Next.js 15 + Tailwind v4 + API 代理）可用。
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-4 p-8">
      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
        Stage 2 完成 · 等待 DEV-5 开发
      </span>
      <h1 className="text-3xl font-bold tracking-tight">AI 智能项目协作平台</h1>
      <p className="leading-7 text-zinc-600">
        任务不只分配给人，也分配给 Agent —— 平台负责拆分、派发、追踪、验收的完整闭环。
      </p>
      <ul className="list-inside list-disc space-y-1 text-sm text-zinc-500">
        <li>产品原型：docs/design/prototype/index.html（浏览器直接打开）</li>
        <li>技术架构：docs/design/architecture.md</li>
        <li>技术选型：docs/design/tech-selection.md</li>
        <li>
          后端健康检查：<code className="rounded bg-zinc-100 px-1">/api/…</code> 由 next.config.ts
          代理到 <code className="rounded bg-zinc-100 px-1">localhost:3001</code>
        </li>
      </ul>
    </main>
  );
}
