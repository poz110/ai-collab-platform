import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

export function createDb(connectionString?: string): Database {
  const pool = new pg.Pool({
    connectionString:
      connectionString ?? process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:55432/ai_collab",
  });
  return drizzle(pool, { schema });
}

let singleton: Database | null = null;

/** 生产/开发默认连接（懒创建，避免测试 import 时建池） */
export function getDb(): Database {
  if (!singleton) singleton = createDb();
  return singleton;
}

export { schema };
