/**
 * 认证 —— better-auth（邮箱+密码），Drizzle adapter 直插业务库。
 * 注册钩子：自动创建默认工作区 + owner member（见 docs/api-spec.md §认证与会话）。
 * DEV-9 SSO 扩展点：better-auth 原生支持 OAuth/SAML 插件，此处不启用。
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "./db/index.js";
import { accounts, members, sessions, users, verifications, workspaces } from "./db/schema.js";

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(db: Database) {
  return betterAuth({
    basePath: "/api/v1/auth",
    secret: process.env.BETTER_AUTH_SECRET ?? "acp-dev-secret-change-in-production",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    trustedOrigins: [process.env.WEB_ORIGIN ?? "http://localhost:3000"],
    databaseHooks: {
      user: {
        create: {
          // 注册即开通：默认工作区 + owner 成员（MVP 单租户简化，多工作区后置）
          after: async (user) => {
            const slug = `ws-${user.id.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;
            const [ws] = await db
              .insert(workspaces)
              .values({ name: `${user.name} 的工作区`, slug })
              .returning();
            await db.insert(members).values({
              workspaceId: ws.id,
              userId: user.id,
              email: user.email,
              name: user.name,
              role: "owner",
            });
          },
        },
      },
    },
  });
}
