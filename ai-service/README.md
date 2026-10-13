# @acp/ai-service — AI 任务助手

DEV-6 交付物。平台全部 LLM 能力的唯一入口：LLM Gateway + Prompt 模板库 + 四大 AI 能力。
实现依据：`docs/design/architecture.md` §5（AI 服务集成方案）。

## 能力清单

| 能力 | 入口 | 对应 issue 需求 |
|---|---|---|
| 自然语言建任务（支持批量） | `createTasksFromText()` | §1 AI 辅助创建任务 |
| 任务拆分（draft → confirm） | `splitTask()` | §2 AI 任务拆分 |
| 智能分配（规则引擎 + LLM 解释） | `suggestAssignee()` | §3 智能分配 |
| 进度洞察（风险 + 摘要 + 建议） | `generateProgressInsight()` | §4 AI 进度洞察 |

所有产出均为**草稿/建议**，人工确认后才落库——对应 DEV-3 风险结论「定位为草稿生成器」。

## 快速开始

```bash
pnpm install
pnpm -C ai-service test        # 25 个单测，MockProvider 驱动，无需真实 API key
pnpm -C ai-service typecheck
```

接入真实模型：

```ts
import { AnthropicProvider, OpenAICompatProvider, LLMGateway, InMemoryCostSink } from '@acp/ai-service';

const gateway = new LLMGateway({
  providers: [
    new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! }),
    // 兜底 / 国内部署：任何 OpenAI 兼容端点
    new OpenAICompatProvider({
      apiKey: process.env.OPENAI_API_KEY!,
      providerName: 'openai',
      models: ['gpt-4o-mini'],
    }),
  ],
  costSink: backendCostSink,     // 见「后端集成契约」
  auditSink: backendAuditSink,
  budgetGuard: dailyBudgetGuard, // 单 issue 日配额硬护栏
  context: { issueId, runId },   // 成本三级归集 run → issue → project
});
```

## 架构

```
capabilities/        四大能力（纯函数式编排，无隐藏状态）
  create-task.ts       自然语言 → 结构化任务草稿（批量）
  split-task.ts        issue → 子任务树草稿（schemaVersion + 依赖清洗/破环）
  suggest-assignee.ts  规则引擎打分排序 → LLM 只写解释（冷启动无 ML）
  progress-insight.ts  结构化快照 → 引用 issue key 的报告；规则层风险与 LLM 输出合并去重
gateway/
  gateway.ts           路由 / schema 强校验（失败带反馈重试一次）/ 成本 / 审计 / 预算
  providers/           anthropic.ts · openai.ts（兼容 DeepSeek 等）· mock.ts
  router.ts            按任务类型路由：拆分/洞察 → Sonnet 级；洞察 temperature=0
  cost.ts              定价表 + 成本归集（model/tokens/costCents）
  budget.ts            DailyBudgetGuard（超配额直接拒绝，失败即关闭）
prompts/               版本化模板库：registry + 每个场景一个文件
context/window.ts      滑动窗口：issue 本体 + 父链 + 最近 20 评论，超限压缩
feedback/store.ts      接受/拒绝反馈循环：accepted 样例回流 few-shot，accuracy 支撑准确率评估
```

## 后端集成契约（DEV-5 衔接点）

ai-service **不直接访问数据库**。后端实现三个接口即可接入：

```ts
interface BackendDataProvider {   // src/types.ts
  getIssue(issueId): Promise<IssueRef | null>;
  listRecentIssueTitles(projectId, limit): Promise<string[]>;   // few-shot 风格对齐
  listMembers(projectId): Promise<MemberProfile[]>;             // skills/activeLoad/capacity
  listAgents(projectId): Promise<AgentProfile[]>;
  listRecentComments(issueId, limit): Promise<CommentRef[]>;
}
interface CostSink  { record(entry: CostRecord): void }   // → COST_RECORD 表
interface AuditSink { record(entry: AuditEntry): void }   // → prompt/response 留痕
```

与架构文档 §4.2 端点的映射：

| API 端点 | ai-service 调用 |
|---|---|
| `POST /api/v1/issues`（自然语言模式） | `createTasksFromText` → 草稿 → 用户确认 |
| `POST /api/v1/issues/:id/ai/split` | `splitTask` → 存 `issue.draft_split` |
| `POST .../ai/split/confirm` | 后端批量建子任务（不经过本包） |
| `POST .../ai/suggest-assignee` | `suggestAssignee` |
| `GET /api/v1/projects/:id/insight` | `generateProgressInsight` |

## LLM 集成配置

环境变量（见 `.env.example`）：

| 变量 | 用途 |
|---|---|
| `ANTHROPIC_API_KEY` | 主力模型（Sonnet 交互层 / Opus 复杂拆分） |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` | 兜底及国产模型适配（DeepSeek 等指向兼容端点即可） |
| `AI_DAILY_BUDGET_CENTS_PER_ISSUE` | 单 issue 日配额（默认 50¢） |

## Prompt 模板库规则

- 模板**只增不改**：新版本追加 + 调用方显式 pin；旧版本保留用于审计回放。
- `schemaVersion` 与 `issue.draft_split.split_schema_version` 联动，防止新旧草稿混用。
- 注册表：`listPrompts()` 查看全部模板与版本。

## 成本控制与准确率

- 每次调用记录 `model / input_tokens / output_tokens / cost_cents`（`CostSink`），
  按 run → issue → project 三级归集。
- `DailyBudgetGuard` 在调用前估算并拦截超支；预算查询失败时**拒绝调用**（fail closed）。
- `FeedbackStore.accuracy(target)` 输出各能力采纳率，即「智能分配准确率达可用水平」的度量口径。
