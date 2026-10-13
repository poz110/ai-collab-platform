/**
 * API 组装 —— Hono + zod-openapi（OpenAPI 文档自动生成）
 * 路由契约见 docs/api-spec.md；架构总则见 docs/design/architecture.md §4。
 */
import { OpenAPIHono } from "@hono/zod-openapi";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { ZodError } from "zod";
import type { AppDeps, AuthVariables } from "./middleware/auth.js";
import { requireAuth } from "./middleware/auth.js";
import { ApiError } from "./lib/errors.js";
import { meRoutes } from "./routes/me.js";
import { projectRoutes } from "./routes/projects.js";
import { issueRoutes } from "./routes/issues.js";

export function createApp(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  app.use("*", logger());
  app.use(
    "/api/*",
    cors({
      origin: [process.env.WEB_ORIGIN ?? "http://localhost:3000"],
      credentials: true,
    }),
  );

  // ---- 统一错误格式（docs/api-spec.md §错误格式） ----
  app.onError((err, c) => {
    const requestId = crypto.randomUUID();
    if (err instanceof ApiError) {
      return c.json(
        { error: { code: err.code, message: err.message, details: err.details ?? {}, request_id: requestId } },
        err.status,
      );
    }
    if (err instanceof ZodError) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "请求参数校验失败",
            details: { issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
            request_id: requestId,
          },
        },
        400,
      );
    }
    console.error("unhandled error", requestId, err);
    return c.json(
      { error: { code: "INTERNAL_ERROR", message: "服务器内部错误", request_id: requestId } },
      500,
    );
  });

  app.get("/health", (c) => c.json({ status: "ok", service: "acp-backend", time: new Date().toISOString() }));

  // ---- 认证（better-auth 标准端点，见 docs/api-spec.md §Auth 端点） ----
  app.on(["GET", "POST"], "/api/v1/auth/*", (c) => deps.auth.handler(c.req.raw));

  // ---- 受保护业务路由 ----
  const api = new OpenAPIHono<{ Variables: AuthVariables }>();
  api.use("*", requireAuth(deps));
  api.route("/", meRoutes(deps));
  api.route("/", projectRoutes(deps));
  api.route("/", issueRoutes(deps));
  app.route("/api/v1", api);

  // ---- SSE 事件流骨架（DEV-6/7 随队列基础设施落地；MVP 前端用轮询兜底） ----
  app.get("/api/v1/events", requireAuth(deps), (c) => {
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: "connected", data: JSON.stringify({ ok: true }) });
      await stream.sleep(30_000);
    });
  });

  // ---- GitHub webhook 入口（DEV-7）：验签 + 入队，同步快路径 ----
  app.post("/webhooks/github", async (c) => {
    // TODO(DEV-7): X-Hub-Signature-256 验签 → BullMQ 入队（幂等键 = X-GitHub-Delivery）
    const delivery = c.req.header("x-github-delivery");
    return c.json({ queued: true, delivery }, 202);
  });

  app.doc("/api/v1/openapi.json", {
    openapi: "3.1.0",
    info: { title: "AI Collab Platform API", version: "0.1.0" },
  });

  return app;
}
