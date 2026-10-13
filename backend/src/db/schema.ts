/**
 * 数据模型 —— 对应 docs/design/architecture.md §三
 * Issue 状态机：todo → in_progress → in_review → done（blocked/cancelled 为旁路）
 * done 仅人类可写入（D1 信任边界），API 层强制。
 *
 * DEV-5 增量：better-auth 账号表（user/session/account/verification）、
 * members.userId 关联登录用户、project_members 项目级角色、issues.labels、
 * projects.description / created_by。
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  date,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ---- better-auth 账号表（字段名与 better-auth drizzle adapter 约定一致，勿改） ----

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---- 业务表 ----

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memberRoleEnum = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof memberRoleEnum)[number];

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: memberRoleEnum }).notNull().default("member"),
    skills: jsonb("skills"), // 技能画像 —— 智能分配（N1 后置）预留
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("members_workspace_email_idx").on(t.workspaceId, t.email)],
);

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  runtime: text("runtime").notNull(), // claude-code / codex / ...
  capabilities: jsonb("capabilities"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  key: text("key").notNull().unique(), // Issue 编号前缀，如 ACP
  description: text("description"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projectRoleEnum = ["lead", "member", "viewer"] as const;
export type ProjectRole = (typeof projectRoleEnum)[number];

export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    role: text("role", { enum: projectRoleEnum }).notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("project_members_project_member_idx").on(t.projectId, t.memberId)],
);

export const issueStatusEnum = ["todo", "in_progress", "in_review", "done", "blocked", "cancelled"] as const;
export type IssueStatus = (typeof issueStatusEnum)[number];

export const issuePriorityEnum = ["urgent", "high", "medium", "low"] as const;
export type IssuePriority = (typeof issuePriorityEnum)[number];

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    number: integer("number").notNull(), // 项目内自增 → ACP-42
    parentId: uuid("parent_id").references((): AnyPgColumn => issues.id, { onDelete: "cascade" }), // 子任务树
    stage: integer("stage").notNull().default(0), // 阶段分组（D4 分阶段派发）
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: issueStatusEnum }).notNull().default("todo"),
    priority: text("priority", { enum: issuePriorityEnum }).notNull().default("medium"),
    labels: jsonb("labels").$type<string[]>().notNull().default([]),
    assigneeType: text("assignee_type", { enum: ["member", "agent"] }), // 多态 assignee（D1）
    assigneeId: uuid("assignee_id"),
    position: real("position").notNull().default(0), // 看板小数重排
    dueDate: date("due_date"),
    draftSplit: jsonb("draft_split"), // AI 拆分草稿（未确认不落子任务）
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("issues_project_number_idx").on(t.projectId, t.number)],
);

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"), // 线程
  authorType: text("author_type", { enum: ["member", "agent", "system"] }).notNull(),
  authorId: uuid("author_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  status: text("status", { enum: ["queued", "running", "succeeded", "failed", "cancelled"] })
    .notNull()
    .default("queued"),
  checkpoint: jsonb("checkpoint"), // 中断恢复（DEV-3 风险对策）
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const wakeupRules = pgTable("wakeup_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["event", "condition", "schedule"] }).notNull(), // D3
  spec: jsonb("spec").notNull(), // 条件表达式 / 事件过滤 / cron
  state: text("state", { enum: ["armed", "suspended", "fired"] }).notNull().default("armed"),
  lastError: jsonb("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const issueLinks = pgTable("issue_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["pr", "commit", "branch"] }).notNull(),
  url: text("url").notNull(),
  externalId: text("external_id"),
  snapshot: jsonb("snapshot"), // PR 状态 / checks 快照（对账用）
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const repoBindings = pgTable("repo_bindings", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("github"),
  repoFullName: text("repo_full_name").notNull(),
  authRef: text("auth_ref"), // OAuth token 的 KMS 引用，不落明文
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const costRecords = pgTable("cost_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => agentRuns.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costCents: integer("cost_cents").notNull(), // D5 成本透明
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
