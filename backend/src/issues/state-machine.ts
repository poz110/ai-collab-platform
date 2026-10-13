/**
 * Issue 状态机 —— 对应 docs/design/architecture.md §4.3
 * 纯函数实现，API 层与队列消费者共用，保证迁移规则只有一份。
 */
import type { IssueStatus } from "../db/schema.js";

const TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  todo: ["in_progress", "cancelled"],
  in_progress: ["in_review", "blocked", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  in_review: ["done", "in_progress", "cancelled"], // 打回 in_progress
  done: [],
  cancelled: [],
};

/** Agent 最高可写到 in_review；done 是人类的验收动作（差异化 D1 的信任边界） */
const AGENT_MAX: IssueStatus[] = ["todo", "in_progress", "blocked", "in_review", "cancelled"];

export class InvalidTransitionError extends Error {
  constructor(
    public from: IssueStatus,
    public to: IssueStatus,
    public allowed: IssueStatus[],
  ) {
    super(`INVALID_TRANSITION: ${from} → ${to}; allowed: [${allowed.join(", ")}]`);
  }
}

export function assertTransition(
  from: IssueStatus,
  to: IssueStatus,
  actor: "member" | "agent" | "system",
): void {
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) throw new InvalidTransitionError(from, to, allowed);
  if (actor === "agent" && !AGENT_MAX.includes(to)) {
    throw new InvalidTransitionError(from, to, allowed.filter((s) => AGENT_MAX.includes(s)));
  }
}

export function allowedTransitions(from: IssueStatus, actor: "member" | "agent" | "system"): IssueStatus[] {
  const allowed = TRANSITIONS[from] ?? [];
  return actor === "agent" ? allowed.filter((s) => AGENT_MAX.includes(s)) : allowed;
}
