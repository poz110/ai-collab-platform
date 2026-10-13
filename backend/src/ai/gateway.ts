/**
 * LLM Gateway —— 对应 docs/design/architecture.md §5
 * 统一 chat 接口 + 模型路由 + 成本归集；供应商差异收敛在本模块内。
 */
import { db } from "../db/index.js";
import { costRecords } from "../db/schema.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  task: "split" | "insight" | "assignee" | "general";
  schema?: Record<string, unknown>; // tool-use 强制结构化输出（拆分场景）
  runId?: string; // 传入则自动归集成本到该 run
}

export interface ChatResult {
  text: string;
  structured?: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}

/** 按任务类型路由模型（见 tech-selection.md §2.5） */
export function routeModel(task: ChatOptions["task"]): string {
  const complex = process.env.LLM_COMPLEX_MODEL ?? "claude-opus-4-8";
  const def = process.env.LLM_DEFAULT_MODEL ?? "claude-sonnet-4-6";
  switch (task) {
    case "split":
    case "insight":
      return def; // 主力：结构化输出质量与成本的平衡点
    case "assignee":
      return complex; // 复杂编排建议才升级 Opus
    default:
      return def;
  }
}

/** USD → cents 的单价表（每百万 token），随供应商调价更新 */
const PRICE_PER_MTOK: Record<string, { in: number; out: number }> = {
  "claude-sonnet-4-6": { in: 300, out: 1500 },
  "claude-opus-4-8": { in: 1500, out: 7500 },
};

export function estimateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICE_PER_MTOK[model] ?? { in: 300, out: 1500 };
  return Math.ceil((inputTokens * p.in + outputTokens * p.out) / 1_000_000);
}

/**
 * 统一调用入口。MVP 阶段接 Anthropic；OpenAI/国产模型经适配层接入（接口已预留）。
 * TODO(DEV-6): 实现 Anthropic client 调用 + tool-use schema 强制 + 流式转发。
 */
export async function chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
  const model = routeModel(opts.task);
  throw new Error(`LLM Gateway 未实现（DEV-6 范围）。路由结果: model=${model}, task=${opts.task}`);
}

/** 成本归集：每次真实调用后写入（D5 成本透明的基础设施） */
export async function recordCost(result: ChatResult, runId: string): Promise<void> {
  await db.insert(costRecords).values({
    runId,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costCents: result.costCents,
  });
}
