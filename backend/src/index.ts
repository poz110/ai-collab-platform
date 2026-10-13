/**
 * API 入口 —— Hono + zod-openapi（代码即契约，OpenAPI 自动生成）
 * 路由契约见 docs/design/architecture.md §4.2
 */
import { OpenAPIHono } from "@hono/zod-openapi";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

const app = new OpenAPIHono();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: [process.env.WEB_ORIGIN ?? "http://localhost:3000"],
    credentials: true,
  }),
);

// ---- 统一错误格式（架构文档 §4.1） ----
app.onError((err, c) => {
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: err.message,
        request_id: crypto.randomUUID(),
      },
    },
    500,
  );
});

app.get("/health", (c) => c.json({ status: "ok", service: "acp-backend", time: new Date().toISOString() }));

// ---- 看板视图：GET /api/v1/projects/:id/issues?view=board ----
// TODO(DEV-5): 接 Drizzle 查询，按 (status, position) 分组返回
const boardQuery = z.object({
  view: z.enum(["board", "list"]).default("board"),
  stage: z.coerce.number().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});
app.get("/api/v1/projects/:id/issues", (c) => {
  const query = boardQuery.parse(c.req.query());
  return c.json({ data: [], next_cursor: null, view: query.view, note: "DEV-5 实现" });
});

// ---- SSE 事件流：GET /api/v1/events?project_id= ----
// 看板变更 / Agent 执行进度 / AI 流式输出的统一广播通道（架构文档 §2.4）
app.get("/api/v1/events", (c) => {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ event: "connected", data: JSON.stringify({ ok: true }) });
    // TODO(DEV-5): 订阅 Redis pub/sub，转发 issue.updated / run.progress 等事件
    await stream.sleep(30_000);
  });
});

// ---- GitHub webhook 入口（DEV-7）：验签 + 入队，同步快路径 ----
app.post("/webhooks/github", async (c) => {
  // TODO(DEV-7): X-Hub-Signature-256 验签 → BullMQ 入队（幂等键 = X-GitHub-Delivery）
  const delivery = c.req.header("x-github-delivery");
  return c.json({ queued: true, delivery }, 202);
});

// ---- OpenAPI 文档 ----
app.doc("/api/v1/openapi.json", {
  openapi: "3.1.0",
  info: { title: "AI Collab Platform API", version: "0.1.0" },
});

const port = Number(process.env.API_PORT ?? 3001);
serve({ fetch: app.fetch, port });
console.log(`🚀 ACP backend listening on http://localhost:${port} (docs: /api/v1/openapi.json)`);
