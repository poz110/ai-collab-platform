/** 启动前数据库迁移（容器入口用，避免依赖 devDependency drizzle-kit） */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "./db/index.js";

await migrate(getDb(), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
console.log("✅ database migrated");
