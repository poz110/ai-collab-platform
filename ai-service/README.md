# ai-service（预留目录）

Stage 2 架构决策（见 `docs/design/architecture.md` §一）：**单体优先** —— LLM Gateway 以模块形式实现在 `backend/src/ai/gateway.ts`，不单独起服务。

本目录为后续拆分预留：当 AI 编排逻辑（prompt 模板库、tool-use 循环、长任务调度）增长到需要独立扩缩容时，将 `backend/src/ai/` 整体迁出为本服务。拆分触发条件：

- AI 调用的资源占用影响 API 的 p99 延迟；或
- 需要独立部署国产模型适配层（私有化部署场景）。
