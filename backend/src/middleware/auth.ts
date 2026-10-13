/**
 * 认证与项目权限中间件。
 * 权限模型（docs/api-spec.md §权限矩阵）：
 * - 工作区角色 owner/admin → 项目与成员管理 + 任务写
 * - 项目角色 lead/member → 任务写；viewer → 只读
 * - 工作区普通 member 且项目无显式成员行 → 隐式 member（可写）
 */
import type { Context, Next } from "hono";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import type { Auth } from "../auth.js";
import { members, projectMembers, projects, type MemberRole, type ProjectRole } from "../db/schema.js";
import { forbidden, notFound, unauthorized, ApiError } from "../lib/errors.js";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthVariables {
  user: SessionUser;
}

export interface ProjectAccess {
  project: typeof projects.$inferSelect;
  member: typeof members.$inferSelect;
  workspaceRole: MemberRole;
  projectRole: ProjectRole;
  canManage: boolean; // 项目设置 / 成员管理（工作区 owner/admin）
  canWrite: boolean; // 任务写操作
}

export type AppDeps = { db: Database; auth: Auth };

/** 会话解析：better-auth cookie → user；失败 401 */
export function requireAuth({ auth }: AppDeps) {
  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) throw unauthorized();
    c.set("user", { id: session.user.id, email: session.user.email, name: session.user.name });
    await next();
  };
}

/** 解析项目访问权限；非工作区成员 404（不暴露项目存在性） */
export async function resolveProjectAccess(
  db: Database,
  projectId: string,
  userId: string,
): Promise<ProjectAccess> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) throw notFound("PROJECT_NOT_FOUND", `项目 ${projectId} 不存在`);

  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.workspaceId, project.workspaceId), eq(members.userId, userId)))
    .limit(1);
  if (!member) throw notFound("PROJECT_NOT_FOUND", `项目 ${projectId} 不存在`);

  const [pm] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.memberId, member.id)))
    .limit(1);

  const canManage = member.role === "owner" || member.role === "admin";
  const projectRole: ProjectRole = (pm?.role as ProjectRole | undefined) ?? "member";
  const canWrite = canManage || projectRole === "lead" || projectRole === "member";
  return { project, member, workspaceRole: member.role, projectRole, canManage, canWrite };
}

export function assertCanWrite(access: ProjectAccess): void {
  if (!access.canWrite) throw forbidden("只读成员（viewer）不能修改任务");
}

export function assertCanManage(access: ProjectAccess): void {
  if (!access.canManage) throw forbidden("仅工作区 owner/admin 可管理项目与成员");
}

export { ApiError };
