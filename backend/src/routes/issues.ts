/**
 * 任务与评论（docs/api-spec.md §任务 / §评论）
 * 状态机由 issues/state-machine.ts 强制；看板排序由 lib/position.ts 计算。
 */
import { Hono } from "hono";
import { and, asc, desc, eq, ilike, inArray, isNull, max, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppDeps, AuthVariables } from "../middleware/auth.js";
import { assertCanWrite, resolveProjectAccess, type ProjectAccess } from "../middleware/auth.js";
import { comments, issues, members, type IssueStatus, issueStatusEnum, issuePriorityEnum } from "../db/schema.js";
import { ApiError, notFound } from "../lib/errors.js";
import { assertTransition, allowedTransitions, InvalidTransitionError } from "../issues/state-machine.js";
import { positionBetween, POSITION_STEP } from "../lib/position.js";

type Db = AppDeps["db"];
type IssueRow = typeof issues.$inferSelect;

const labelsSchema = z.array(z.string().min(1).max(30)).max(10);
const dueDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "截止日期格式 YYYY-MM-DD");

const createIssueSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
  priority: z.enum(issuePriorityEnum).default("medium"),
  labels: labelsSchema.default([]),
  dueDate: dueDateSchema.nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

const updateIssueSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).nullable().optional(),
  priority: z.enum(issuePriorityEnum).optional(),
  labels: labelsSchema.optional(),
  dueDate: dueDateSchema.nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  status: z.enum(issueStatusEnum).optional(),
});

const moveSchema = z.object({
  status: z.enum(issueStatusEnum),
  beforeId: z.string().uuid().nullable().optional(),
  afterId: z.string().uuid().nullable().optional(),
});

const commentSchema = z.object({ content: z.string().min(1).max(5000) });

const BOARD_COLUMNS: IssueStatus[] = ["todo", "in_progress", "in_review", "done", "blocked"];

const PRIORITY_ORDER_SQL = sql`case ${issues.priority} when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end`;

/** 校验 assignee 属于项目所在工作区 */
async function assertAssigneeInWorkspace(db: Db, access: ProjectAccess, assigneeId: string): Promise<void> {
  const [m] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.id, assigneeId), eq(members.workspaceId, access.project.workspaceId)))
    .limit(1);
  if (!m) throw new ApiError(400, "VALIDATION_ERROR", "负责人必须是本工作区成员");
}

async function subtaskCounts(db: Db, parentIds: string[]): Promise<Map<string, { total: number; done: number }>> {
  const map = new Map<string, { total: number; done: number }>();
  if (!parentIds.length) return map;
  const rows = await db
    .select({ parentId: issues.parentId, status: issues.status })
    .from(issues)
    .where(inArray(issues.parentId, parentIds));
  for (const r of rows) {
    if (!r.parentId) continue;
    const cur = map.get(r.parentId) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (r.status === "done") cur.done += 1;
    map.set(r.parentId, cur);
  }
  return map;
}

async function assigneeNames(db: Db, ids: (string | null)[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  const map = new Map<string, string>();
  if (!uniq.length) return map;
  const rows = await db.select({ id: members.id, name: members.name }).from(members).where(inArray(members.id, uniq));
  for (const r of rows) map.set(r.id, r.name);
  return map;
}

function serializeIssue(
  row: IssueRow,
  projectKey: string,
  names: Map<string, string>,
  counts: Map<string, { total: number; done: number }>,
) {
  const sc = counts.get(row.id);
  return {
    ...row,
    identifier: `${projectKey}-${row.number}`,
    assignee: row.assigneeId ? { memberId: row.assigneeId, name: names.get(row.assigneeId) ?? null } : null,
    subtaskCount: sc?.total ?? 0,
    subtaskDoneCount: sc?.done ?? 0,
  };
}

async function serializeMany(db: Db, rows: IssueRow[], projectKey: string) {
  const [names, counts] = await Promise.all([
    assigneeNames(db, rows.map((r) => r.assigneeId)),
    subtaskCounts(db, rows.map((r) => r.id)),
  ]);
  return rows.map((r) => serializeIssue(r, projectKey, names, counts));
}

export function issueRoutes({ db }: AppDeps) {
  const app = new Hono<{ Variables: AuthVariables }>();

  // ---- 看板 / 列表视图 ----
  app.get("/projects/:id/issues", async (c) => {
    const access = await resolveProjectAccess(db, c.req.param("id"), c.get("user").id);
    const q = c.req.query();
    const view = q.view ?? "board";

    if (view === "board") {
      const rows = await db
        .select()
        .from(issues)
        .where(and(eq(issues.projectId, access.project.id), isNull(issues.parentId), ne(issues.status, "cancelled")))
        .orderBy(asc(issues.position));
      const serialized = await serializeMany(db, rows, access.project.key);
      const columns: Record<string, unknown[]> = Object.fromEntries(BOARD_COLUMNS.map((s) => [s, []]));
      for (const row of serialized) columns[row.status]?.push(row);
      return c.json({ columns });
    }

    // 列表视图：筛选 + 搜索 + 排序 + cursor 分页（cursor 为不透明的偏移量，MVP 简化）
    const conditions = [eq(issues.projectId, access.project.id)];
    if (q.status) conditions.push(eq(issues.status, q.status as IssueStatus));
    if (q.priority) conditions.push(eq(issues.priority, q.priority as (typeof issuePriorityEnum)[number]));
    if (q.assigneeId) conditions.push(eq(issues.assigneeId, q.assigneeId));
    if (q.label) conditions.push(sql`${issues.labels} @> ${JSON.stringify([q.label])}::jsonb`);
    if (q.q) conditions.push(ilike(issues.title, `%${q.q}%`));

    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 100);
    const offset = Math.max(Number(Buffer.from(q.cursor ?? "", "base64").toString() || 0) || 0, 0);
    const sortCol =
      q.sort === "dueDate" ? issues.dueDate : q.sort === "priority" ? PRIORITY_ORDER_SQL : issues.createdAt;
    const orderFn = q.order === "asc" ? asc : desc;

    const rows = await db
      .select()
      .from(issues)
      .where(and(...conditions))
      .orderBy(orderFn(sortCol as never), asc(issues.id))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return c.json({
      data: await serializeMany(db, page, access.project.key),
      next_cursor: hasMore ? Buffer.from(String(offset + limit)).toString("base64") : null,
    });
  });

  // ---- 创建 ----
  app.post("/issues", async (c) => {
    const body = createIssueSchema.parse(await c.req.json().catch(() => ({})));
    const access = await resolveProjectAccess(db, body.projectId, c.get("user").id);
    assertCanWrite(access);

    if (body.assigneeId) await assertAssigneeInWorkspace(db, access, body.assigneeId);

    if (body.parentId) {
      const [parent] = await db.select().from(issues).where(eq(issues.id, body.parentId)).limit(1);
      if (!parent || parent.projectId !== access.project.id)
        throw notFound("ISSUE_NOT_FOUND", "父任务不存在或不属于该项目");
      if (parent.parentId) throw new ApiError(400, "VALIDATION_ERROR", "子任务不能再有子任务（仅支持两级）");
    }

    const created = await db.transaction(async (tx) => {
      const [{ maxNumber }] = await tx
        .select({ maxNumber: max(issues.number) })
        .from(issues)
        .where(eq(issues.projectId, access.project.id));
      const [{ maxPosition }] = await tx
        .select({ maxPosition: max(issues.position) })
        .from(issues)
        .where(and(eq(issues.projectId, access.project.id), eq(issues.status, "todo")));
      const [row] = await tx
        .insert(issues)
        .values({
          projectId: access.project.id,
          number: (maxNumber ?? 0) + 1,
          parentId: body.parentId ?? null,
          title: body.title,
          description: body.description ?? null,
          priority: body.priority,
          labels: body.labels,
          dueDate: body.dueDate ?? null,
          assigneeType: body.assigneeId ? "member" : null,
          assigneeId: body.assigneeId ?? null,
          position: (maxPosition ?? 0) + POSITION_STEP,
        })
        .returning();
      return row;
    });
    const [serialized] = await serializeMany(db, [created], access.project.key);
    return c.json(serialized, 201);
  });

  // ---- 详情（含子任务与评论） ----
  app.get("/issues/:id", async (c) => {
    const issue = await loadIssue(db, c.req.param("id"));
    const access = await resolveProjectAccess(db, issue.projectId, c.get("user").id);
    const subs = await db
      .select()
      .from(issues)
      .where(eq(issues.parentId, issue.id))
      .orderBy(asc(issues.position));
    const [serialized] = await serializeMany(db, [issue], access.project.key);
    const subtasks = await serializeMany(db, subs, access.project.key);
    const commentRows = await listComments(db, issue.id);
    return c.json({
      ...serialized,
      allowedTransitions: allowedTransitions(issue.status, "member"),
      subtasks,
      comments: commentRows,
    });
  });

  // ---- 更新（含状态迁移） ----
  app.patch("/issues/:id", async (c) => {
    const issue = await loadIssue(db, c.req.param("id"));
    const access = await resolveProjectAccess(db, issue.projectId, c.get("user").id);
    assertCanWrite(access);
    const body = updateIssueSchema.parse(await c.req.json().catch(() => ({})));

    if (body.status && body.status !== issue.status) {
      try {
        assertTransition(issue.status, body.status, "member");
      } catch (e) {
        if (e instanceof InvalidTransitionError)
          throw new ApiError(409, "INVALID_TRANSITION", e.message, { allowed: e.allowed });
        throw e;
      }
    }
    if (body.assigneeId) await assertAssigneeInWorkspace(db, access, body.assigneeId);

    const [updated] = await db
      .update(issues)
      .set({
        title: body.title,
        description: body.description === undefined ? undefined : body.description,
        priority: body.priority,
        labels: body.labels,
        dueDate: body.dueDate === undefined ? undefined : body.dueDate,
        assigneeId: body.assigneeId === undefined ? undefined : body.assigneeId,
        assigneeType: body.assigneeId === undefined ? undefined : body.assigneeId ? "member" : null,
        status: body.status,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issue.id))
      .returning();
    const [serialized] = await serializeMany(db, [updated], access.project.key);
    return c.json(serialized);
  });

  // ---- 删除（子任务与评论经 FK 级联） ----
  app.delete("/issues/:id", async (c) => {
    const issue = await loadIssue(db, c.req.param("id"));
    const access = await resolveProjectAccess(db, issue.projectId, c.get("user").id);
    assertCanWrite(access);
    await db.delete(issues).where(eq(issues.id, issue.id));
    return c.json({ deleted: true });
  });

  // ---- 看板拖拽：状态迁移 + position 重排 ----
  app.post("/issues/:id/move", async (c) => {
    const issue = await loadIssue(db, c.req.param("id"));
    const access = await resolveProjectAccess(db, issue.projectId, c.get("user").id);
    assertCanWrite(access);
    const body = moveSchema.parse(await c.req.json().catch(() => ({})));

    if (body.status !== issue.status) {
      try {
        assertTransition(issue.status, body.status, "member");
      } catch (e) {
        if (e instanceof InvalidTransitionError)
          throw new ApiError(409, "INVALID_TRANSITION", e.message, { allowed: e.allowed });
        throw e;
      }
    }

    // 解析落点上下卡片（须在目标列内）
    const neighbor = async (id: string | null | undefined) => {
      if (!id) return null;
      const [row] = await db.select().from(issues).where(eq(issues.id, id)).limit(1);
      if (!row || row.projectId !== issue.projectId || row.status !== body.status)
        throw new ApiError(400, "VALIDATION_ERROR", "beforeId/afterId 必须指向目标列内的卡片");
      return row;
    };
    const before = await neighbor(body.beforeId);
    const after = await neighbor(body.afterId);

    const position = positionBetween(before?.position ?? null, after?.position ?? null);
    const [updated] = await db
      .update(issues)
      .set({ status: body.status, position, updatedAt: new Date() })
      .where(eq(issues.id, issue.id))
      .returning();
    const [serialized] = await serializeMany(db, [updated], access.project.key);
    return c.json(serialized);
  });

  // ---- 评论 ----
  app.get("/issues/:id/comments", async (c) => {
    const issue = await loadIssue(db, c.req.param("id"));
    await resolveProjectAccess(db, issue.projectId, c.get("user").id);
    return c.json(await listComments(db, issue.id));
  });

  app.post("/issues/:id/comments", async (c) => {
    const issue = await loadIssue(db, c.req.param("id"));
    const access = await resolveProjectAccess(db, issue.projectId, c.get("user").id);
    assertCanWrite(access);
    const body = commentSchema.parse(await c.req.json().catch(() => ({})));
    await db.insert(comments).values({
      issueId: issue.id,
      authorType: "member",
      authorId: access.member.id,
      content: body.content,
    });
    const rows = await listComments(db, issue.id);
    return c.json(rows[rows.length - 1], 201);
  });

  return app;
}

async function loadIssue(db: Db, id: string): Promise<IssueRow> {
  const [issue] = await db.select().from(issues).where(eq(issues.id, id)).limit(1);
  if (!issue) throw notFound("ISSUE_NOT_FOUND", `任务 ${id} 不存在`);
  return issue;
}

async function listComments(db: Db, issueId: string) {
  const rows = await db
    .select({ comment: comments, authorName: members.name })
    .from(comments)
    .leftJoin(members, and(eq(members.id, comments.authorId), eq(comments.authorType, "member")))
    .where(eq(comments.issueId, issueId))
    .orderBy(asc(comments.createdAt));
  return rows.map((r) => ({
    id: r.comment.id,
    authorType: r.comment.authorType,
    authorId: r.comment.authorId,
    authorName: r.authorName,
    content: r.comment.content,
    createdAt: r.comment.createdAt,
  }));
}
