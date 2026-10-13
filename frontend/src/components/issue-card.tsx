"use client";

import { CalendarDays, CheckSquare, MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PRIORITY_BADGE_CLASS, PRIORITY_LABEL } from "@/lib/status";
import type { Issue } from "@/lib/types";

/** 任务卡片（看板/列表/日历共用视觉元素） */
export function IssueCardBadges({ issue }: { issue: Issue }) {
  return (
    <>
      <Badge className={PRIORITY_BADGE_CLASS[issue.priority]}>
        {PRIORITY_LABEL[issue.priority]}
      </Badge>
      {issue.labels.map((l) => (
        <Badge key={l} className="bg-cyan-50 text-cyan-700">
          {l}
        </Badge>
      ))}
    </>
  );
}

export function IssueCardMeta({ issue }: { issue: Issue }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
      {issue.dueDate ? (
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {issue.dueDate}
        </span>
      ) : null}
      {issue.subtaskCount > 0 ? (
        <span className="inline-flex items-center gap-1">
          <CheckSquare className="h-3 w-3" />
          {issue.subtaskDoneCount}/{issue.subtaskCount}
        </span>
      ) : null}
    </div>
  );
}

export function IssueAssignee({ issue, className }: { issue: Issue; className?: string }) {
  if (!issue.assignee) {
    return <span className={cn("text-[11px] text-zinc-300", className)}>未分配</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] text-zinc-500", className)}>
      <Avatar name={issue.assignee.name} size="sm" />
      <span className="max-w-20 truncate">{issue.assignee.name}</span>
    </span>
  );
}

/** 看板卡片 */
export function IssueCard({
  issue,
  onClick,
  dragging,
}: {
  issue: Issue;
  onClick?: () => void;
  dragging?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg border border-zinc-200 bg-white p-3",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all",
        "hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
        dragging && "rotate-2 opacity-90 shadow-xl",
      )}
    >
      <div className="text-[11.5px] font-semibold tracking-wide text-zinc-400">
        {issue.identifier}
      </div>
      <div className="mt-0.5 mb-2 line-clamp-2 text-[13.5px] font-medium leading-snug text-zinc-900">
        {issue.title}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <IssueCardBadges issue={issue} />
        <span className="ml-auto">
          <IssueAssignee issue={issue} />
        </span>
      </div>
      <div className="mt-2">
        <IssueCardMeta issue={issue} />
      </div>
    </div>
  );
}
