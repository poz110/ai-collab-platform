# 技术选型决策

> 项目：AI 智能项目协作平台 | 阶段：Stage 2 (DEV-4) | 日期：2026-10-14
> 输入：DEV-3《竞品调研与需求分析》—— MVP 打穿四件事：**看板、AI 拆任务、Agent 执行闭环、GitHub 状态联动**。

## 一、决策总览

| 层 | 选型 | 一句话理由 |
|---|---|---|
| 前端框架 | **Next.js 15 + React 19 + TypeScript** | 生态最大、服务端渲染与流式 UI 原生支持 AI 场景 |
| UI 组件 | **Tailwind CSS v4 + shadcn/ui** | 看板类高度自定义 UI 的最佳性价比组合 |
| 看板拖拽 | **dnd-kit** | 触摸/键盘可访问性最好，React 19 兼容 |
| 前端状态/数据 | **TanStack Query + Zustand** | 服务端状态归 Query，本地 UI 状态归 Zustand，边界清晰 |
| 后端框架 | **Node.js (Bun 运行时) + Hono** | TypeScript 全栈同构，Hono 轻量且边缘可部署 |
| ORM | **Drizzle ORM** | SQL 优先、迁移可控、无 Prisma 的运行时代价 |
| 数据库 | **PostgreSQL 16** | 关系模型 + JSONB + 行级锁，一库打穿 MVP 全部需求 |
| 缓存/队列 | **Redis (BullMQ)** | Webhook 重试、AI 任务排队、wakeup 调度的统一底座 |
| 实时通信 | **SSE (Server-Sent Events)** | 看板更新是单向广播，SSE 比 WebSocket 简单一个量级 |
| AI 服务 | **Anthropic Claude 为主，OpenAI 兜底，国产模型可插拔** | 结构化输出（tool use）质量最稳，适配层屏蔽差异 |
| 认证 | **better-auth** | 邮箱 + OAuth（GitHub）开箱即用，为 DEV-9 SSO 预留扩展点 |
| 部署 | **Docker Compose（MVP）→ 可迁移 K8s** | 单体起步，不做过早微服务 |
| Monorepo | **pnpm workspaces** | 前后端 + 共享类型包，零额外工具链 |

## 二、关键决策详述

### 2.1 前端：React（Next.js）而非 Vue

**决策**：Next.js 15 + React 19。

- AI 场景高度依赖**流式渲染**（AI 拆任务过程逐条出结果），React 的 Suspense + RSC 流式能力是最成熟实现。
- shadcn/ui 事实成为 AI 原生产品的 UI 标准（Linear 类产品的克隆成本最低）。
- 团队画像 P3（AI-native 初创）的二次开发/自托管需求以 React 生态为主。

**放弃的选项**：Vue 3 + Nuxt —— 国内团队友好，但 AI SDK（Vercel AI SDK、LangChain.js）均以 React 为一等公民。

### 2.2 后端：Node.js + Hono，而非 Go / Python

**决策**：TypeScript 全栈，Bun 运行时 + Hono 框架。

- **共享类型是最大杠杆**：前后端共用 Drizzle schema 推导出的类型与 zod 校验器，接口漂移（interface drift）从根上消除。Python/Go 方案需要额外 codegen（OpenAPI → TS），链路长且易腐化。
- AI 编排逻辑（prompt 组装、流式转发、tool-use 循环）在 Node 生态的 SDK 支持最好。
- Hono 比 Express 快且类型安全，比 NestJS 轻两个量级；MVP 不需要 Nest 的框架惯性。
- Bun 运行时带来启动速度与内置测试/打包，但代码保持 Node 兼容，可随时切回。

**放弃的选项**：Go（高并发优势在 MVP 阶段用不上，开发效率低）；Python FastAPI（AI 生态最强但我们不调本地模型，纯 API 编排场景无优势）。

### 2.3 数据库：PostgreSQL，而非 MongoDB

**决策**：PostgreSQL 16。

- 领域模型是强关系的：Issue 树（父子/阶段）、assignee（人/Agent 多态）、PR 关联、成本归集——全部是 join 与事务场景。
- 看板排序需要可靠的 `position` 小数重排 + 行级锁，关系库天然支持。
- JSONB 兜底半结构化数据（AI 拆分的原始输出、wakeup 条件表达式），不需要引入第二个数据库。
- `pgvector` 扩展为后续语义搜索/智能分配预留路径，无需新增基础设施。

**放弃的选项**：MongoDB —— Issue 层级与多态关联用文档模型表达反而更绕。

### 2.4 实时通信：SSE，而非 WebSocket

**决策**：SSE 为主，WebSocket 后置。

- MVP 的实时需求是**单向广播**：看板卡片移动、Agent 执行进度、AI 流式输出——全部是服务器 → 客户端。
- SSE 基于 HTTP，天然穿过代理/网关，自带断线重连（`Last-Event-ID`），Hono 原生支持。
- WebSocket 留到协同编辑（多人同时编辑 issue 描述）阶段再引入，届时用 Yjs + ws。

### 2.5 AI 服务集成

**决策**：主用 Anthropic Claude（最新 Sonnet 做交互层、最新 Opus 做复杂拆分），OpenAI 兼容层兜底，通过适配层支持国产模型（DeepSeek / 通义）以满足国内部署需求。

- **结构化输出是核心诉求**：AI 拆任务要求稳定输出符合 JSON Schema 的子任务树，Claude 的 tool-use 强制 schema 是最稳实现。
- **适配层（LLM Gateway）**：统一 `chat(messages, schema, tools)` 接口，按任务类型路由模型，按 issue 归集 token 成本（差异化点 D5 的技术基础）。
- **成本控制**：拆分/摘要走 Sonnet 级模型，仅在复杂编排建议时升级；所有调用记录 `model / input_tokens / output_tokens / cost_cents`。

### 2.6 为什么不用 tRPC（尽管全栈 TS）

API 是对外产品能力（DEV-7~9 的集成、未来 MCP Server 都需要公开 REST API）。采用 **OpenAPI 优先的 REST**（Hono + zod-openapi 自动生成 spec 与类型），tRPC 仅内部联调快但不产出公共契约。

## 三、风险评估

| 风险 | 等级 | 对策 |
|---|---|---|
| Bun 运行时个别原生依赖兼容问题 | 低 | 代码保持 Node 兼容，CI 双跑 Bun/Node |
| Next.js 版本激进（React 19） | 低 | 锁定 minor 版本，升级走单独迭代 |
| LLM 成本失控 | 中 | 每 issue 成本归集 + 每日配额 + 拆分结果人工确认后才入库 |
| SSE 在企业代理下被截断 | 低 | 客户端降级为 5s 轮询（TanStack Query refetchInterval） |
| LLM 供应商锁定 | 中 | LLM Gateway 适配层，模型以配置切换 |

## 四、开发环境

```
Node ≥ 20（或 Bun ≥ 1.2） / pnpm ≥ 9 / Docker Desktop（Postgres + Redis）
```

- `docker compose up -d` 起 PostgreSQL 16 + Redis 7
- `pnpm install && pnpm dev` 并行启动 frontend(3000) 与 backend(3001)
- 数据库迁移：`pnpm -C backend db:migrate`（Drizzle Kit）

## 五、待评审确认项

1. Bun 运行时是否接受，还是保守用 Node + tsx？（建议：接受 Bun，代码 Node 兼容）
2. LLM 是否首期就接入国产模型适配？（建议：接口预留，MVP 只接 Anthropic，国内部署迭代再接）
3. 前端是否需要 PWA（移动端方案依赖此决策，见 prototype/README.md §移动端）？（建议：MVP 做响应式 + PWA manifest，不做原生壳）
