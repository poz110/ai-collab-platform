/** 测试基建：PGlite 内存 Postgres + 真实迁移 + 完整应用实例（无需 Docker） */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "../db/schema.js";
import type { Database } from "../db/index.js";
import { createAuth } from "../auth.js";
import { createApp } from "../app.js";

export interface TestContext {
  app: ReturnType<typeof createApp>;
  db: Database;
}

export async function createTestApp(): Promise<TestContext> {
  const client = new PGlite();
  const db = drizzle(client, { schema }) as unknown as Database;
  const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");
  await migrate(db as never, { migrationsFolder });
  const auth = createAuth(db);
  return { app: createApp({ db, auth }), db };
}

/** 注册并返回携带会话 cookie 的请求头工厂 */
export async function signUp(
  app: TestContext["app"],
  user: { name: string; email: string; password: string },
): Promise<{ cookie: string; userId: string }> {
  const res = await app.fetch(
    new Request("http://test.local/api/v1/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(user),
    }),
  );
  if (res.status !== 200) throw new Error(`signUp failed: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("signUp 未返回会话 cookie");
  const body = (await res.json()) as { user: { id: string } };
  return { cookie: setCookie.split(";")[0], userId: body.user.id };
}

export function api(app: TestContext["app"], cookie: string | null, method: string, path: string, body?: unknown) {
  return app.fetch(
    new Request(`http://test.local${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
}
