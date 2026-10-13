# 竞品调研与需求分析报告

> 项目：AI 智能项目协作平台 | 日期：2026-10-14 | 调研人：claude cli（DEV-3）

## 一、竞品功能对比矩阵

### 1.1 总览矩阵

| 维度 | Multica.ai（本平台） | Linear | Notion (Projects + AI) | Asana (AI Studio) | Monday.com (AI) | Jira (Atlassian Intelligence / Rovo) |
|---|---|---|---|---|---|---|
| **产品定位** | AI 原生的项目看板与 Agent 任务编排 | 软件团队的极速 Issue 追踪 | 文档 + 数据库一体化工作区 | 通用工作管理平台 | 可视化 Work OS（低代码） | 企业级敏捷研发管理 |
| **核心功能** | 看板/Issue、Agent 直接作为 assignee、子任务分阶段编排、wakeup 条件触发 | Issue、Cycle、Triage、Roadmap、Git 深度集成 | Wiki、数据库视图、Projects 模板、Sprint | 任务/项目/目标、工作流自动化、工作量管理 | 看板/甘特/表格多视图、Dashboard、自动化 | Scrum/Kanban、Backlog、Advanced Roadmaps、JSM |
| **AI 能力** | Agent 可领取并执行 Issue（写代码、发评论）、条件/事件唤醒、多 Agent 协作 | AI 自动分诊、Coding Sessions（Claude/Codex 写码）、项目进展草稿、Linear MCP | Notion AI 问答/写作、Custom Agents、数据库自动填充 | AI Studio（自然语言建工作流）、AI Teammates、Dash 每日优先级 | Agent Factory（自定义 Agent）、Sidekick 助手、AI Notetaker、AI Blocks | Rovo Search/Chat/Agents/Studio、Agents in Jira、Jira Coding Agent、Teamwork Graph |
| **Agent 自主性** | ★★★★★ Agent 是一等公民，可独立跑完整开发任务并回写结果 | ★★★★ Coding Session 可产出 PR，但围绕 issue 单点 | ★★★ Custom Agents 偏内容/知识自动化 | ★★★ AI Teammates 是预置角色助手，非自主执行者 | ★★★ Agent Factory 场景化 Agent，偏运营侧 | ★★★★ Rovo Agents + Jira Coding Agent，企业内权限体系完整 |
| **集成生态** | GitHub（Repo 检出/PR 联动），规划 Slack/飞书/Jira | GitHub/GitLab/Slack/Figma/Sentry + API/Webhook/MCP | Slack/GitHub/Google Drive/Jira + MCP | 200+ 应用集成 + MCP Server | 200+ 集成 + MCP Block | Atlassian 全家桶 + 3000+ 市场插件 + MCP |
| **定价模式（2026）** | 待定（本报告建议见 §5） | Free / Basic $10 / Business $16 / Enterprise 定制；AI 分诊等锁 Business；Coding Sessions 另购 AI 额度 | AI 已并入 Business：约 $20/席/月（Plus $10 不含完整 AI）；Custom Agents 按用量 | Starter $10.99 / Advanced $24.99；AI Studio 按账户额度（50K–200K 点数/月），Plus 约 $135/账户/月 | Basic $9 / Standard $12 / Pro $19（3 席起）；2026-05 起 AI 点数强制另购（约 $0.01/点） | Standard $9.70 / Premium $19.60（2026-10 调价后）；Rovo 按点数池（25–150 点/席/月），超量 $0.01/点；2026-12 起全面转用量计费 |
| **目标客群** | 希望把 AI Agent 纳入研发流水线的技术团队 | 初创~中型软件团队 | 知识型团队、非研发部门 | 中大型企业的跨部门团队 | 中小企业、运营/营销团队 | 大型企业、强合规研发组织 |

### 1.2 AI 能力深度对比

| 能力项 | Multica | Linear | Notion | Asana | Monday | Jira/Rovo |
|---|---|---|---|---|---|---|
| AI 辅助任务创建/拆分 | ✅ 核心能力 | 部分（分诊建议） | ✅（内容生成强） | ✅ | ✅ | ✅（Rovo Chat） |
| 智能任务分配 | ✅ Agent 可被指派并执行 | 分诊路由（给人） | ❌ | 智能建议 | 部分 | 部分（路由建议） |
| Agent 自主执行交付 | ✅ 完整闭环（执行→评论→状态流转） | ✅ Coding Sessions（代码场景） | ❌（辅助型） | ❌（建议型为主） | 部分（场景化 Agent） | ✅ Jira Coding Agent |
| 进度自动追踪/汇报 | ✅（状态机 + 唤醒驱动） | ✅ 项目更新草稿 | 部分 | ✅ 智能状态摘要 | ✅ Sidekick 图表 | ✅ Rovo 摘要 |
| 异步/条件触发编排 | ✅ wakeup（事件/条件/定时） | ❌ | ❌ | 规则自动化 | 自动化配方 | Automation（按步计费） |
| 多 Agent 协作 | ✅（squad/父子任务链） | ❌ | ❌ | ❌ | 部分 | 部分（多 Rovo Agent） |

### 1.3 定价趋势洞察（2026 年关键变化）

- **全面转向"席位 + AI 用量"混合计费**：Atlassian 2026-12 起 Rovo 点数按量收费；Monday 2026-05 起新客强制购买 AI 点数；Linear 的 Coding Sessions 单独购额度。AI 已从"增值插件"变成"独立收入线"。
- **AI 能力分层锁定**：Linear 把 Triage Intelligence 锁在 Business 档；Notion 把完整 AI 锁在 Business（约 $20/席）。免费档普遍只给"尝鲜额度"。
- **普涨**：Linear +14~25%（Basic $8→$10），Jira Cloud +7%，Monday 2026-02 涨约 18%。用户成本敏感度处于高位——**新产品的价格窗口存在**。

## 二、目标用户画像与核心痛点

### 2.1 三类核心画像

**P1：10–50 人软件研发团队负责人（Tech Lead / 工程经理）**
- 痛点：任务拆分和分派占用 30%+ 时间；进度靠人肉追；AI 编码工具（Claude Code/Cursor）产出与任务系统割裂，PR 与 Issue 状态不同步。
- 诉求：让 AI 真正"干活"而不是"提建议"；任务状态自动随代码进展流转。

**P2：50–300 人公司的 PMO / 产品负责人**
- 痛点：跨团队依赖不透明；周报/进展汇报靠手工汇总；Jira 太重、Linear 太研发向。
- 诉求：自动化的进度追踪与汇报，跨项目依赖可视化。

**P3：AI 重度采纳的初创团队（AI-native startup）**
- 痛点：团队里已有多个编码 Agent，但缺乏"任务→Agent→验收"的管理平面；Agent 工作无审计、无状态、无编排。
- 诉求：把 Agent 当团队成员管理——分配、追踪、验收、计成本。

### 2.2 共性痛点排序（按提及频率 × 付费意愿加权）

1. **任务拆分与分派的心智负担**（所有画像共有）
2. **进度状态与实际产出脱节**（状态靠人更新，永远滞后）
3. **AI 工具孤岛**：AI 在编辑器里干活，成果不回写项目管理系统
4. **跨系统信息割裂**：GitHub / Slack / 飞书 / 文档各自为政
5. **AI 成本不可预测**（2026 年点数计费引发的普遍焦虑）

## 三、产品差异化定位建议

### 3.1 定位陈述

> **面向 AI-native 研发团队的任务编排层：任务不只分配给人，也分配给 Agent——平台负责拆分、派发、追踪、验收的完整闭环。**

不与 Linear 比"快"，不与 Notion 比"全"，不与 Jira 比"企业合规"。占据的生态位是：**Agent 劳动力的管理平面（Agent Workforce Management）**。

### 3.2 五个差异化竞争点

| # | 差异化点 | 对标现状 | 为什么成立 |
|---|---|---|---|
| D1 | **Agent 是一等 assignee**：任务直接派给 AI Agent 执行并交付成果（代码/文档/调研），人负责验收 | Linear/Asana 的 AI 是"助手"，任务 owner 永远是人 | 2026 年编码 Agent 已能独立完成中小型任务，缺的是管理平面 |
| D2 | **状态由产出驱动，而非人工更新**：PR merge → issue done；评论到达 → 阻塞解除 | 所有竞品的看板状态都靠人拖 | 消除"看板滞后"这一最大痛点；数据真实可信 |
| D3 | **条件/事件唤醒的异步编排**（wakeup）："PR checks 绿了再叫我""子任务全部完成再推进" | 竞品只有定时自动化规则，无语义条件 | 让长周期 Agent 任务不烧轮询成本，编排能力超出竞品一代 |
| D4 | **AI 辅助拆分 + 分阶段派发**：一个大需求拆成串行/并行子任务链，按 stage 推进 | Asana AI Studio 能建工作流但不能拆任务语义 | 直接命中画像 P1 的第一痛点 |
| D5 | **成本透明**：Agent 每次执行标注 token/成本，按任务归集 | 竞品点数制被普遍抱怨"算不清" | 在点数焦虑时代做"明码标价"，是采购决策的强卖点 |

### 3.3 竞争风险

- **Linear 正在逼近**：Coding Sessions + MCP 已覆盖 D1 的代码场景，但仅锁代码、无编排概念。窗口期约 6–12 个月。
- **Atlassian 生态碾压**：Rovo 绑定 Jira 存量客户，我们抢不动大企业，应聚焦其够不着的中小 AI-native 团队。
- **护城河思考**：编排语义（wakeup/stage/squad）+ 执行审计数据，是竞品短期内难以复制的结构性资产。

## 四、MVP 功能优先级排序

### Must-have（P0，MVP 必需）

| 编号 | 功能 | 依据 |
|---|---|---|
| M1 | Issue 看板（创建/拆分/父子任务/优先级/状态机） | 一切的基础 |
| M2 | **Agent assignee**：Agent 领取任务、执行、回写评论、流转状态 | 差异化核心 D1 |
| M3 | AI 辅助任务创建与拆分（一句话需求 → 子任务树） | 第一痛点 + D4 |
| M4 | GitHub 集成（Repo 检出、PR 关联、PR 状态回写 issue） | D2 的最小闭环 |
| M5 | 评论/线程 + 状态流转 + 完成通知 | 协作最小闭环 |

### Nice-to-have（P1，MVP 后 1–2 个迭代）

| 编号 | 功能 | 依据 |
|---|---|---|
| N1 | wakeup 条件/事件唤醒（PR checks、子任务完成、指定人回复） | D3，技术已验证但可后置 |
| N2 | 进度自动追踪面板（按项目/迭代聚合 Agent 与人的进展） | 画像 P2 的核心诉求 |
| N3 | Agent 执行成本统计（token/时长按 issue 归集） | D5 |
| N4 | Slack/飞书通知集成 | 国内落地刚需（飞书优先于 Slack） |
| N5 | 迭代（Cycle/Sprint）管理 | 研发团队工作节奏 |

### Later（P2，验证 PMF 后）

- 多 Agent 编排（squad、串行链、阶段闸门的完整编排语法）
- Jira/Linear 导入器（迁移是转化的关键杠杆）
- MCP Server 开放（接入客户自有 AI 工具）
- 智能分配建议（基于历史负载与技能画像）
- 企业能力：SSO、审计日志、私有化

### MVP 核心范围（一句话）

> **一个看板 + AI 拆任务 + 任务派给 Agent + GitHub 联动回写状态** —— 四件事打穿，其余皆可后置。

## 五、技术可行性初步评估

| 方向 | 评估 | 风险与对策 |
|---|---|---|
| AI 任务拆分 | **可行**。LLM 结构化输出（JSON Schema）+ 人工确认门槛即可达到可用质量 | 拆分质量不稳定 → 必须保留人工编辑环节，定位为"草稿生成器" |
| Agent 执行闭环 | **可行**。编码 Agent CLI（Claude Code 等）已支持 headless 模式 + 结构化回写 | 长任务的中断恢复 → 需要 checkpoint/审计日志设计 |
| GitHub 状态联动 | **可行**。Webhook + Checks API 成熟，Linear 已验证该体验 | Webhook 可靠性 → 需重试队列与对账任务 |
| 条件唤醒（wakeup） | **中等复杂度**。本质是规则引擎 + 调度器，事件驱动架构 | 条件风暴（高频触发）→ 需防抖与配额设计 |
| 飞书/Slack 集成 | **可行但工作量分散**。飞书开放平台消息/卡片/审批 API 完整 | 国内企业需求碎片化 → MVP 只做通知，不做双向操作 |
| 智能分配 | **后置**。需要数据积累（技能画像、历史负载），冷启动无解 | 先用规则（标签匹配）而非 ML |

**总体结论**：M1–M5 全部为成熟技术组合，无研究级风险；最大技术不确定性在 Agent 长任务的稳定性（中断恢复、成本控制），建议 MVP 阶段限制单任务时长并强制人工验收节点。

## 六、结论与建议

1. **定位**：不做"又一个带 AI 的项目管理工具"，做"AI Agent 劳动力的任务编排与管理平面"。
2. **客群优先级**：P3（AI-native 初创）> P1（中型研发团队）> P2（PMO）。P3 痛点最尖锐、决策链最短。
3. **MVP 打穿四件事**：看板、AI 拆分、Agent 执行闭环、GitHub 状态联动。
4. **定价策略建议**：席位费对标 Linear 略低 + **Agent 执行按量明码标价**（不做黑盒点数），把"成本透明"作为获客卖点。
5. **时间窗口**：Linear 与 Atlassian 都在向 Agent 化演进，差异化窗口约 6–12 个月，建议 MVP 在 8–10 周内可演示。

---

*主要信息来源：Linear/Atlassian/Notion/Asana/Monday 官方定价页及 2026 年第三方评测（ones.com、breeze.pm、zapier.com、usecarly.com 等）；Multica 能力基于本平台实际功能梳理。*
