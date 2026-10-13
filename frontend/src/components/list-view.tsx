"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { IssueAssignee, IssueCardBadges } from "@/components/issue-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useListIssues } from "@/hooks/use-issues";
import { ApiError } from "@/lib/api";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Issue } from "@/lib/types";
import { useProjectUiStore } from "@/stores/project-ui";

type SortField = "dueDate" | "priority" | "createdAt";

const COLUMNS: { key: string; label: string; sortable?: SortField; className?: string }[] = [
  { key: "identifier", label: "编号", className: "w-24" },
  { key: "title", label: "标题" },
  { key: "status", label: "状态", className: "w-24" },
  { key: "priority", label: "优先级", sortable: "priority", className: "w-20" },
  { key: "assignee", label: "负责人", className: "w-32" },
  { key: "labels", label: "标签", className: "w-40" },
  { key: "dueDate", label: "截止日期", sortable: "dueDate", className: "w-28" },
  { key: "subtasks", label: "子任务", className: "w-20" },
  { key: "createdAt", label: "创建时间", sortable: "createdAt", className: "w-28" },
];

export function ListView({ projectId }: { projectId: string }) {
  const { filters, setFilters, openIssue } = useProjectUiStore();
  const list = useListIssues(projectId, filters);

  const toggleSort = (field: SortField) => {
    if (filters.sort === field) {
      setFilters({ order: filters.order === "asc" ? "desc" : "asc" });
    } else {
      setFilters({ sort: field, order: "asc" });
    }
  };

  if (list.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (list.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
        列表加载失败：{list.error instanceof ApiError ? list.error.message : "网络错误"}
      </div>
    );
  }

  const rows = list.data?.data ?? [];

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
            {COLUMNS.map((c) => (
              <th key={c.key} className={cn("px-3 py-2.5 font-medium", c.className)}>
                {c.sortable ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(c.sortable!)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-zinc-700",
                      filters.sort === c.sortable && "font-semibold text-indigo-600",
                    )}
                  >
                    {c.label}
                    {filters.sort === c.sortable ? (
                      filters.order === "desc" ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUp className="h-3 w-3" />
                      )
                    ) : null}
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-12 text-center text-zinc-400">
                没有符合条件的任务
              </td>
            </tr>
          ) : (
            rows.map((issue) => (
              <Row key={issue.id} issue={issue} onClick={() => openIssue(issue.id)} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  const isSubtask = !!issue.parentId;
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-zinc-50 transition-colors last:border-0 hover:bg-zinc-50/80"
    >
      <td className="px-3 py-2.5 font-mono text-xs font-semibold text-zinc-400">
        {issue.identifier}
      </td>
      <td className="px-3 py-2.5">
        <span className={cn("font-medium text-zinc-900", isSubtask && "pl-4 text-zinc-600")}>
          {isSubtask ? "└ " : ""}
          {issue.title}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <Badge className={STATUS_BADGE_CLASS[issue.status]}>{STATUS_LABEL[issue.status]}</Badge>
      </td>
      <td className="px-3 py-2.5">
        <IssueCardBadges issue={{ ...issue, labels: [] }} />
      </td>
      <td className="px-3 py-2.5">
        <IssueAssignee issue={issue} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {issue.labels.map((l) => (
            <Badge key={l} className="bg-cyan-50 text-cyan-700">
              {l}
            </Badge>
          ))}
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-zinc-500">{issue.dueDate ?? "—"}</td>
      <td className="px-3 py-2.5 text-xs text-zinc-500">
        {issue.subtaskCount > 0 ? (
          <span>
            {issue.subtaskDoneCount}/{issue.subtaskCount}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-zinc-500">
        {issue.createdAt ? issue.createdAt.slice(0, 10) : "—"}
      </td>
    </tr>
  );
}
