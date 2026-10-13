/**
 * 状态机与展示映射 —— 与 backend/src/issues/state-machine.ts 的 TRANSITIONS 保持一致。
 * 非法迁移后端返回 409 INVALID_TRANSITION 并带 allowed 列表，前端据此兜底刷新。
 */
import type { IssuePriority, IssueStatus } from "./types";

export const STATUS_ORDER: IssueStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
];

export const STATUS_LABEL: Record<IssueStatus, string> = {
  todo: "待办",
  in_progress: "进行中",
  in_review: "评审中",
  done: "已完成",
  blocked: "阻塞",
  cancelled: "已取消",
};

export const STATUS_COLOR: Record<IssueStatus, string> = {
  todo: "#a1a1aa",
  in_progress: "#d97706",
  in_review: "#4f46e5",
  done: "#16a34a",
  blocked: "#dc2626",
  cancelled: "#71717a",
};

/** 与后端 state-machine.ts TRANSITIONS 一致（人类视角，含 done） */
export const ALLOWED_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  todo: ["in_progress", "cancelled"],
  in_progress: ["in_review", "blocked", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  in_review: ["done", "in_progress", "cancelled"],
  done: [],
  cancelled: [],
};

export const PRIORITY_LABEL: Record<IssuePriority, string> = {
  urgent: "紧急",
  high: "高",
  medium: "中",
  low: "低",
};

export const PRIORITY_ORDER: IssuePriority[] = ["urgent", "high", "medium", "low"];

/** 优先级徽标样式（对齐原型 tag 配色） */
export const PRIORITY_BADGE_CLASS: Record<IssuePriority, string> = {
  urgent: "bg-red-50 text-red-600",
  high: "bg-amber-50 text-amber-600",
  medium: "bg-indigo-50 text-indigo-600",
  low: "bg-zinc-100 text-zinc-500",
};

export const STATUS_BADGE_CLASS: Record<IssueStatus, string> = {
  todo: "bg-zinc-100 text-zinc-600",
  in_progress: "bg-amber-50 text-amber-600",
  in_review: "bg-indigo-50 text-indigo-600",
  done: "bg-green-50 text-green-600",
  blocked: "bg-red-50 text-red-600",
  cancelled: "bg-zinc-100 text-zinc-400",
};
