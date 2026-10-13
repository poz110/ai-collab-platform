"use client";

import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  addDays,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useListIssues } from "@/hooks/use-issues";
import { ApiError } from "@/lib/api";
import { PRIORITY_BADGE_CLASS, STATUS_COLOR } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Issue } from "@/lib/types";
import { useProjectUiStore } from "@/stores/project-ui";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

/**
 * 日历视图：月历格子，按 dueDate 放置任务 chip。
 * 数据源为 list 端点（board 端点只含顶层任务；日历需要全部任务按截止日期展示）。
 */
export function CalendarView({ projectId }: { projectId: string }) {
  const { filters, openIssue } = useProjectUiStore();
  const [month, setMonth] = React.useState(() => new Date());

  // 日历展示全部筛选后的任务（含子任务），无 dueDate 的不出现
  const list = useListIssues(projectId, { ...filters, sort: "dueDate", order: "asc" });

  const byDate = React.useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const issue of list.data?.data ?? []) {
      if (!issue.dueDate) continue;
      const key = issue.dueDate.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(issue);
      map.set(key, arr);
    }
    return map;
  }, [list.data]);

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const out: Date[] = [];
    let d = start;
    while (d <= end) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [month]);

  if (list.isLoading) {
    return <Skeleton className="h-[480px] w-full" />;
  }
  if (list.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
        日历加载失败：{list.error instanceof ApiError ? list.error.message : "网络错误"}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-900">{format(month, "yyyy 年 M 月")}</h3>
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => setMonth(new Date())}>
            今天
          </Button>
          <Button size="sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-zinc-100 text-center text-xs font-medium text-zinc-400">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const issues = byDate.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          return (
            <div
              key={key}
              className={cn(
                "min-h-24 border-r border-b border-zinc-50 p-1.5 [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-zinc-50/50",
              )}
            >
              <div
                className={cn(
                  "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                  isToday(day)
                    ? "bg-indigo-600 font-bold text-white"
                    : inMonth
                      ? "text-zinc-600"
                      : "text-zinc-300",
                )}
              >
                {format(day, "d")}
              </div>
              <div className="flex flex-col gap-1">
                {issues.slice(0, 3).map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => openIssue(issue.id)}
                    title={`${issue.identifier} ${issue.title}`}
                    className={cn(
                      "flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium",
                      PRIORITY_BADGE_CLASS[issue.priority],
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_COLOR[issue.status] }}
                    />
                    <span className="truncate">{issue.title}</span>
                  </button>
                ))}
                {issues.length > 3 ? (
                  <span className="px-1.5 text-[10px] text-zinc-400">
                    还有 {issues.length - 3} 个…
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
