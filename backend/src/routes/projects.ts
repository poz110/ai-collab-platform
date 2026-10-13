/** 项目与项目成员（docs/api-spec.md §项目） */
import { Hono } from "hono";
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import type { AppDeps, AuthVariables } from "../middleware/auth.js";
import { assertCanManage, resolveProjectAccess } from "../middleware/auth.js";
import { issues, members, projectMembers, projects, users } from "../db/schema.js";
import { ApiError, notFound } from "../lib/errors.js";

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  key: z
    .string()
    .regex(/^[A-Z]{2,6}$/, "key 须为 2-6 位大写字母（Issue 编号前缀）"),
  description: z.string().max(2000).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
});

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["lead", "member", "viewer"]).default("member"),
});

const updateMemberSchema = z.object({ role: z.enum(["lead", "member", "viewer"]) });

async function listProjectMembers(db: AppDeps["db"], projectId: string) {
  return db
    .select({
      memberId: members.id,
      userId: members.userId,
      name: members.name,
      email: members.email,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(members, eq(members.id, projectMembers.memberId))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(projectMembers.createdAt));
}

export function projectRoutes({ db }: AppDeps) {
  const app = new Hono<{ Variables: AuthVariables }>();

  // 当前用户可见的项目 = 其所有工作区成员身份覆盖的项目
  app.get("/projects", async (c) => {
    const user = c.get("user");
    const rows = await db
      .select({ project: projects, issueCount: count(issues.id) })
      .from(projects)
      .innerJoin(members, eq(members.workspaceId, projects.workspaceId))
      .leftJoin(issues, eq(issues.projectId, projects.id))
      .where(eq(members.userId, user.id))
      .groupBy(projects.id)
      .orderBy(asc(projects.createdAt));
    return c.json(
      rows.map((r) => ({
        id: r.project.id,
        name: r.project.name,
        key: r.project.key,
        description: r.project.description,
        issueCount: Number(r.issueCount),
        createdAt: r.project.createdAt,
      })),
    );
  });

  app.post("/projects", async (c) => {
    const user = c.get("user");
    const body = createProjectSchema.parse(await c.req.json().catch(() => ({})));
    const [membership] = await db
      .select()
      .from(members)
      .where(eq(members.userId, user.id))
      .orderBy(asc(members.createdAt))
      .limit(1);
    if (!membership) throw notFound("MEMBER_NOT_FOUND", "当前用户没有工作区成员身份");

    const dup = await db.select({ id: projects.id }).from(projects).where(eq(projects.key, body.key)).limit(1);
    if (dup.length) throw new ApiError(409, "KEY_CONFLICT", `项目编号前缀 ${body.key} 已被占用`);

    const [project] = await db
      .insert(projects)
      .values({
        workspaceId: membership.workspaceId,
        name: body.name,
        key: body.key,
        description: body.description ?? null,
        createdBy: user.id,
      })
      .returning();
    // 创建者自动成为项目 lead
    await db.insert(projectMembers).values({ projectId: project.id, memberId: membership.id, role: "lead" });
    return c.json(project, 201);
  });

  app.get("/projects/:id", async (c) => {
    const access = await resolveProjectAccess(db, c.req.param("id"), c.get("user").id);
    return c.json({ ...access.project, members: await listProjectMembers(db, access.project.id) });
  });

  app.patch("/projects/:id", async (c) => {
    const access = await resolveProjectAccess(db, c.req.param("id"), c.get("user").id);
    assertCanManage(access);
    const body = updateProjectSchema.parse(await c.req.json().catch(() => ({})));
    const [updated] = await db
      .update(projects)
      .set({ name: body.name, description: body.description === undefined ? undefined : body.description })
      .where(eq(projects.id, access.project.id))
      .returning();
    return c.json(updated);
  });

  app.delete("/projects/:id", async (c) => {
    const access = await resolveProjectAccess(db, c.req.param("id"), c.get("user").id);
    assertCanManage(access);
    await db.delete(projects).where(eq(projects.id, access.project.id)); // issues/comments 级联
    return c.json({ deleted: true });
  });

  // ---- 项目成员 ----

  app.get("/projects/:id/members", async (c) => {
    const access = await resolveProjectAccess(db, c.req.param("id"), c.get("user").id);
    return c.json(await listProjectMembers(db, access.project.id));
  });

  app.post("/projects/:id/members", async (c) => {
    const access = await resolveProjectAccess(db, c.req.param("id"), c.get("user").id);
    assertCanManage(access);
    const body = addMemberSchema.parse(await c.req.json().catch(() => ({})));

    const [targetUser] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (!targetUser) throw notFound("USER_NOT_FOUND", `邮箱 ${body.email} 尚未注册`);

    // 受邀者若不在本工作区，先补工作区成员行（role=member）
    let [member] = await db
      .select()
      .from(members)
      .where(and(eq(members.workspaceId, access.project.workspaceId), eq(members.userId, targetUser.id)))
      .limit(1);
    if (!member) {
      [member] = await db
        .insert(members)
        .values({
          workspaceId: access.project.workspaceId,
          userId: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          role: "member",
        })
        .returning();
    }

    const existing = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, access.project.id), eq(projectMembers.memberId, member.id)))
      .limit(1);
    if (existing.length) throw new ApiError(409, "ALREADY_MEMBER", "该成员已在项目中");

    await db.insert(projectMembers).values({ projectId: access.project.id, memberId: member.id, role: body.role });
    const [created] = await listProjectMembers(db, access.project.id).then((rows) =>
      rows.filter((r) => r.memberId === member.id),
    );
    return c.json(created, 201);
  });

  app.patch("/projects/:id/members/:memberId", async (c) => {
    const access = await resolveProjectAccess(db, c.req.param("id"), c.get("user").id);
    assertCanManage(access);
    const body = updateMemberSchema.parse(await c.req.json().catch(() => ({})));
    const updated = await db
      .update(projectMembers)
      .set({ role: body.role })
      .where(
        and(eq(projectMembers.projectId, access.project.id), eq(projectMembers.memberId, c.req.param("memberId"))),
      )
      .returning();
    if (!updated.length) throw notFound("MEMBER_NOT_FOUND", "项目成员不存在");
    return c.json(updated[0]);
  });

  app.delete("/projects/:id/members/:memberId", async (c) => {
    const access = await resolveProjectAccess(db, c.req.param("id"), c.get("user").id);
    assertCanManage(access);
    const deleted = await db
      .delete(projectMembers)
      .where(
        and(eq(projectMembers.projectId, access.project.id), eq(projectMembers.memberId, c.req.param("memberId"))),
      )
      .returning();
    if (!deleted.length) throw notFound("MEMBER_NOT_FOUND", "项目成员不存在");
    return c.json({ deleted: true });
  });

  return app;
}
