/**
 * 进程入口 —— 组装 createApp 并监听端口。
 * 应用逻辑在 app.ts（可注入 db/auth 以便测试用 PGlite 起内存实例）。
 */
import { serve } from "@hono/node-server";
import { getDb } from "./db/index.js";
import { createAuth } from "./auth.js";
import { createApp } from "./app.js";

const db = getDb();
const app = createApp({ db, auth: createAuth(db) });

const port = Number(process.env.API_PORT ?? 3001);
serve({ fetch: app.fetch, port });
console.log(`🚀 ACP backend listening on http://localhost:${port} (docs: /api/v1/openapi.json)`);
