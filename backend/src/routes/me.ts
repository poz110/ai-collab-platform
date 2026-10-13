/** 当前用户（docs/api-spec.md §当前用户） */
import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AppDeps, AuthVariables } from "../middleware/auth.js";
import { members, users, workspaces } from "../db/schema.js";
import { notFound } from "../lib/errors.js";

const updateMeSchema = z.object({ name: z.string().min(1).max(100) });

export function meRoutes({ db }: AppDeps) {
  const app = new Hono<{ Variables: AuthVariables }>();

  // 主成员身份 = 最早加入的工作区成员行（注册时自动创建的 owner 行）
  app.get("/me", async (c) => {
    const user = c.get("user");
    const [row] = await db
      .select({ member: members, workspace: workspaces })
      .from(members)
      .innerJoin(workspaces, eq(workspaces.id, members.workspaceId))
      .where(eq(members.userId, user.id))
      .orderBy(asc(members.createdAt))
      .limit(1);
    if (!row) throw notFound("MEMBER_NOT_FOUND", "当前用户没有工作区成员身份");
    return c.json({
      user: { id: user.id, email: user.email, name: user.name },
      member: { id: row.member.id, role: row.member.role, workspaceId: row.member.workspaceId },
      workspace: { id: row.workspace.id, name: row.workspace.name, slug: row.workspace.slug },
    });
  });

  app.patch("/me", async (c) => {
    const user = c.get("user");
    const body = updateMeSchema.parse(await c.req.json().catch(() => ({})));
    await db.update(users).set({ name: body.name, updatedAt: new Date() }).where(eq(users.id, user.id));
    await db.update(members).set({ name: body.name }).where(eq(members.userId, user.id));
    return c.json({ user: { id: user.id, email: user.email, name: body.name } });
  });

  return app;
}
