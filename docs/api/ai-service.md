# AI 服务 API 说明（DEV-6 交接）

> 代码：`ai-service/`（包名 `@acp/ai-service`）。本文档给 DEV-5 后端与 Stage 4 集成使用。

## 设计要点

1. **草稿优先**：所有 AI 产出（任务草稿、拆分草稿、分配建议、洞察报告）都不直接落库，
   由用户确认后后端才写正式数据。对应端点 `POST /issues/:id/ai/split` 存 `draft_split`，
   `confirm` 时才批量建子任务。
2. **结构化输出强保证**：所有 schema 输出经 zod 校验，失败时把校验错误反馈给模型重试一次，
   再失败抛 `SchemaValidationError`——调用方永远不会拿到半成品 JSON。
3. **规则先行，LLM 殿后**：智能分配由确定性规则引擎排序（技能匹配 50% + 负载 30% + 历史采纳率 20%），
   LLM 仅生成人类可读解释；进度洞察中规则层检测到的风险（逾期/阻塞）与 LLM 输出合并去重，
   模型无法「说没就没」。
4. **成本硬护栏**：每次调用落 `CostRecord`；`DailyBudgetGuard` 超支即拒（`BudgetExceededError`）。

## 公开入口速查

```ts
createTasksFromText({ gateway, backend, projectId, input, today, feedback? })
  → { drafts: DraftTask[] }                        // 批量自然语言建任务

splitTask({ gateway, backend, issueId, feedback? })
  → SplitDraft                                     // schemaVersion=1，依赖已清洗

suggestAssignee({ backend, issueId, gateway?, topN?, weights?, includeAgents? })
  → { suggestions: AssigneeSuggestion[] }          // 无 gateway 时纯规则引擎

generateProgressInsight({ gateway, backend, projectId, issues, today })
  → ProgressInsight                                // 风险均带 issue key 引用
```

## 准确性验证方式

- 单测 25 个全部基于 `MockProvider` / stub，确定性可复现。
- 真实模型联调：设 `ANTHROPIC_API_KEY` 后对 `createTasksFromText` / `splitTask`
  跑一遍手工用例，用 `InMemoryFeedbackStore.accuracy()` 的口径记录采纳率。
- 反馈循环：用户接受/拒绝每次提案都调 `FeedbackStore.record()`；
  已接受样例自动回流到 prompt few-shot，形成改进闭环。

## 已知边界（风险提示）

- 中文分词基于标点/空白切分，技能匹配对「全二字中文技能标签」效果最好；
  复合技能（如「前端性能优化」）建议拆成多个标签录入成员画像。
- 上下文窗口默认 12k 字符，超限时旧评论压缩为一行摘要——超长讨论串的细节会丢。
- 定价表硬编码在 `gateway/cost.ts`，供应商调价需发版更新（已在表外模型上按 Sonnet 价兜底计费，不会漏记）。
