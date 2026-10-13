"use client";

import { Search, X } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useProjectMembers } from "@/hooks/use-projects";
import type { IssueFilters } from "@/hooks/use-issues";
import { PRIORITY_BADGE_CLASS, PRIORITY_LABEL, PRIORITY_ORDER } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { IssuePriority } from "@/lib/types";
import { useProjectUiStore } from "@/stores/project-ui";

/**
 * 筛选栏（三视图共用）：关键字搜索、优先级多选、负责人下拉、标签输入、排序（仅列表视图）。
 */
export function FilterBar({ projectId }: { projectId: string }) {
  const { view, filters, setFilters, resetFilters } = useProjectUiStore();
  const members = useProjectMembers(projectId);

  const [qInput, setQInput] = React.useState(filters.q ?? "");
  const [labelInput, setLabelInput] = React.useState(filters.label ?? "");

  // 防抖搜索
  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.q ?? "") !== qInput.trim()) {
        setFilters({ q: qInput.trim() || undefined });
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.label ?? "") !== labelInput.trim()) {
        setFilters({ label: labelInput.trim() || undefined });
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelInput]);

  const togglePriority = (p: IssuePriority) => {
    const cur = filters.priority ?? [];
    const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p];
    setFilters({ priority: next.length ? next : undefined });
  };

  const hasFilters =
    !!filters.q ||
    !!filters.label ||
    !!filters.assigneeId ||
    (filters.priority?.length ?? 0) > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <Input
          className="w-48 pl-8"
          placeholder="搜索任务标题…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-1">
        {PRIORITY_ORDER.map((p) => {
          const active = filters.priority?.includes(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => togglePriority(p)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                active
                  ? cn(PRIORITY_BADGE_CLASS[p], "border-current")
                  : "border-zinc-200 bg-white text-zinc-400 hover:text-zinc-600",
              )}
            >
              {PRIORITY_LABEL[p]}
            </button>
          );
        })}
      </div>

      <Select
        className="w-36"
        value={filters.assigneeId ?? null}
        onValueChange={(v) => setFilters({ assigneeId: v ?? undefined })}
        options={(members.data ?? []).map((m) => ({
          value: m.memberId,
          label: m.name,
        }))}
        placeholder="负责人"
        clearable
        clearLabel="全部负责人"
      />

      <Input
        className="w-32"
        placeholder="标签筛选"
        value={labelInput}
        onChange={(e) => setLabelInput(e.target.value)}
      />

      {view === "list" ? (
        <>
          <Select
            className="w-32"
            value={filters.sort ?? null}
            onValueChange={(v) =>
              setFilters({ sort: (v ?? undefined) as IssueFilters["sort"] })
            }
            options={[
              { value: "createdAt", label: "按创建时间" },
              { value: "dueDate", label: "按截止日期" },
              { value: "priority", label: "按优先级" },
            ]}
            placeholder="排序字段"
            clearable
            clearLabel="默认排序"
          />
          <Select
            className="w-24"
            value={filters.order ?? null}
            onValueChange={(v) =>
              setFilters({ order: (v ?? undefined) as IssueFilters["order"] })
            }
            options={[
              { value: "asc", label: "升序" },
              { value: "desc", label: "降序" },
            ]}
            placeholder="顺序"
            clearable
            clearLabel="默认"
          />
        </>
      ) : null}

      {hasFilters ? (
        <button
          type="button"
          onClick={() => {
            resetFilters();
            setQInput("");
            setLabelInput("");
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="h-3 w-3" /> 清除筛选
        </button>
      ) : null}

      {hasFilters && view === "board" ? (
        <Badge className="bg-amber-50 text-amber-600">看板筛选在本地生效</Badge>
      ) : null}
    </div>
  );
}
