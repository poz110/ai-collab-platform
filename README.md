# AI 智能项目协作平台

类似 Multica 的 AI 驱动项目看板与任务分配系统，打通公司内部系统。

> **定位**：面向 AI-native 研发团队的任务编排层 —— 任务不只分配给人，也分配给 Agent，平台负责拆分、派发、追踪、验收的完整闭环。（DEV-3 竞品调研结论）

## 项目目标

- **智能任务管理**：AI 辅助任务创建、拆分、分配
- **项目看板**：可视化项目进度，多视图支持
- **系统集成**：打通 GitHub、Slack/飞书/钉钉、公司内部系统
- **AI 助手**：自然语言交互，智能进度洞察

## 项目结构

```
ai-collab-platform/
├── docs/                    # 项目文档
│   ├── research/            # 竞品调研报告 (Stage 1 ✅)
│   ├── design/              # 产品原型与技术架构 (Stage 2 ✅)
│   │   ├── prototype/       #   可交互 HTML 原型（浏览器打开 index.html）
│   │   ├── architecture.md  #   系统架构 / 数据模型 / API 规范 / AI 集成
│   │   └── tech-selection.md#   技术选型决策
│   ├── api/                 # API 文档（开发期由代码生成 OpenAPI）
│   └── deployment/          # 部署运维文档
├── frontend/                # 前端应用：Next.js 15 + React 19 + Tailwind v4
├── backend/                 # 后端服务：Hono + Drizzle + PostgreSQL + BullMQ
├── ai-service/              # （预留）AI 服务拆分目录，MVP 在 backend/src/ai
├── integrations/            # 系统集成模块 (Stage 4)
│   ├── github/              # GitHub 集成
│   ├── chat/                # 通讯工具集成
│   └── internal/            # 内部系统对接
├── tests/                   # 测试代码 (Stage 5)
├── scripts/                 # 工具脚本
└── .github/                 # CI/CD 配置
```

## 开发路线图

| 阶段 | 内容 | 状态 |
|------|------|------|
| Stage 1 | 竞品调研与需求分析 | ✅ 完成（docs/research/） |
| Stage 2 | 产品原型设计 + 技术架构 | ✅ 完成（docs/design/） |
| Stage 3 | MVP 开发（看板 + AI） | 待启动（DEV-5 / DEV-6） |
| Stage 4 | 系统集成 | 等待 Stage 3 |
| Stage 5 | 测试与上线 | 等待 Stage 4 |

## 技术栈（Stage 2 已确认）

| 层 | 选型 |
|---|---|
| 前端 | Next.js 15 + React 19 + TypeScript + Tailwind v4 + shadcn/ui + dnd-kit |
| 后端 | Bun/Node + Hono（zod-openapi，代码即契约） |
| 数据 | PostgreSQL 16 + Drizzle ORM；Redis 7 + BullMQ（队列/调度） |
| 实时 | SSE（单向广播）；协同编辑阶段再引入 WebSocket |
| AI | Anthropic Claude 主力，LLM Gateway 适配层预留 OpenAI/国产模型 |
| 认证 | better-auth（邮箱 + GitHub OAuth，SSO 预留） |

决策理由见 [docs/design/tech-selection.md](docs/design/tech-selection.md)。

## 快速开始

前置：Node ≥ 20（或 Bun ≥ 1.2）、pnpm ≥ 9、Docker Desktop。

```bash
cp .env.example .env            # 按需填写 ANTHROPIC_API_KEY 等
docker compose up -d            # PostgreSQL 16 + Redis 7
pnpm install
pnpm db:generate && pnpm db:migrate   # 数据库迁移（Drizzle Kit）
pnpm dev                        # 并行启动 frontend:3000 与 backend:3001
```

- 前端：http://localhost:3000
- 后端健康检查：http://localhost:3001/health
- OpenAPI 文档：http://localhost:3001/api/v1/openapi.json

## 贡献指南

（待项目正式启动后补充）

## License

MIT
