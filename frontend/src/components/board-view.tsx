"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import * as React from "react";
import { IssueCard } from "@/components/issue-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBoardIssues, useMoveIssue, type IssueFilters } from "@/hooks/use-issues";
import { ApiError } from "@/lib/api";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { BoardColumns, BoardResponse, Issue, IssueStatus } from "@/lib/types";

/** 看板列（不含 cancelled —— 已取消任务不上看板，与后端 board 端点一致） */
type BoardStatus = keyof BoardColumns;
const BOARD_STATUSES = STATUS_ORDER as BoardStatus[];
import { toast } from "@/stores/toast";
import { useProjectUiStore } from "@/stores/project-ui";

/** 看板本地过滤（board 端点不支持筛选参数，前端过滤） */
export function filterIssues(issues: Issue[], filters: IssueFilters): Issue[] {
  return issues.filter((i) => {
    if (filters.q && !i.title.toLowerCase().includes(filters.q.toLowerCase())) return false;
    if (filters.priority?.length && !filters.priority.includes(i.priority)) return false;
    if (filters.assigneeId && i.assigneeId !== filters.assigneeId) return false;
    if (filters.label && !i.labels.some((l) => l.includes(filters.label!))) return false;
    return true;
  });
}

function SortableCard({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { issue },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <IssueCard issue={issue} onClick={onClick} />
    </div>
  );
}

function Column({
  status,
  issues,
  onCardClick,
  onCreate,
}: {
  status: BoardStatus;
  issues: Issue[];
  onCardClick: (id: string) => void;
  onCreate: (status: BoardStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}`, data: { status } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-68 shrink-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50/60 p-2.5",
        isOver && "outline-2 -outline-offset-2 outline-dashed outline-indigo-500",
      )}
    >
      <div className="flex items-center gap-2 px-1.5 pt-0.5 pb-2.5">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: STATUS_COLOR[status] }}
        />
        <span className="text-[13px] font-semibold text-zinc-800">{STATUS_LABEL[status]}</span>
        <span className="text-xs text-zinc-400">{issues.length}</span>
        <button
          type="button"
          onClick={() => onCreate(status)}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700"
          aria-label={`在「${STATUS_LABEL[status]}」新建任务`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-16 flex-1 flex-col gap-2">
          {issues.map((issue) => (
            <SortableCard key={issue.id} issue={issue} onClick={() => onCardClick(issue.id)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function BoardView({
  projectId,
  onCreateIssue,
}: {
  projectId: string;
  onCreateIssue: (status: BoardStatus) => void;
}) {
  const qc = useQueryClient();
  const board = useBoardIssues(projectId);
  const moveIssue = useMoveIssue(projectId);
  const { filters, openIssue } = useProjectUiStore();
  const [activeIssue, setActiveIssue] = React.useState<Issue | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const queryKey = ["projects", projectId, "issues", "board"];

  const columns = React.useMemo(() => {
    const data = board.data?.columns;
    const result = {} as Record<BoardStatus, Issue[]>;
    for (const s of BOARD_STATUSES) {
      result[s] = filterIssues(data?.[s] ?? [], filters);
    }
    return result;
  }, [board.data, filters]);

  function findColumnOf(issueId: string): BoardStatus | null {
    for (const s of BOARD_STATUSES) {
      if ((board.data?.columns[s] ?? []).some((i) => i.id === issueId)) return s;
    }
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    const issue = (e.active.data.current as { issue?: Issue } | undefined)?.issue;
    setActiveIssue(issue ?? null);
  }

  function onDragOver(_e: DragOverEvent) {
    // 跨列视觉反馈由列的 useDroppable isOver 处理；实际数据变更在 onDragEnd 一次性提交
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveIssue(null);
    const issueId = String(e.active.id);
    const over = e.over;
    if (!over || !board.data) return;

    const fromStatus = findColumnOf(issueId);
    if (!fromStatus) return;

    // 落点：可能是某张卡片，也可能是列容器
    const overId = String(over.id);
    let toStatus: BoardStatus;
    let overIssueId: string | null = null;
    if (overId.startsWith("col-")) {
      toStatus = overId.slice(4) as BoardStatus;
    } else {
      const col = findColumnOf(overId);
      if (!col) return;
      toStatus = col;
      overIssueId = overId;
    }

    const targetList = board.data.columns[toStatus] ?? [];

    // 计算 beforeId / afterId（目标列内落点前后卡片）
    let beforeId: string | undefined;
    let afterId: string | undefined;

    // 目标列表中排除自己（同列拖动时）
    const targetWithoutSelf = targetList.filter((i) => i.id !== issueId);

    if (overIssueId) {
      const overIndex = targetWithoutSelf.findIndex((i) => i.id === overIssueId);
      if (overIndex === -1) {
        // 找不到（异常情况），追加到末尾
        afterId = targetWithoutSelf[targetWithoutSelf.length - 1]?.id;
      } else {
        // 判断插到落点卡片之前还是之后：同列时用原位置比较，跨列时默认插到落点之前
        const activeIndexInSource = (board.data.columns[fromStatus] ?? []).findIndex(
          (i) => i.id === issueId,
        );
        const overIndexInSource = (board.data.columns[fromStatus] ?? []).findIndex(
          (i) => i.id === overIssueId,
        );
        const insertAfter =
          fromStatus === toStatus &&
          activeIndexInSource !== -1 &&
          overIndexInSource !== -1 &&
          activeIndexInSource < overIndexInSource;

        if (insertAfter) {
          beforeId = overIssueId;
          afterId = targetWithoutSelf[overIndex + 1]?.id;
        } else {
          afterId = overIssueId;
          beforeId = targetWithoutSelf[overIndex - 1]?.id;
        }
      }
    } else {
      // 落在列空白处 → 追加到末尾
      afterId = targetWithoutSelf[targetWithoutSelf.length - 1]?.id;
    }

    // 同列且位置未变 → 不请求
    if (
      fromStatus === toStatus &&
      targetList.length > 0 &&
      // 如果拖动后前后邻居没变，视为无操作
      (() => {
        const idx = targetList.findIndex((i) => i.id === issueId);
        const prev = idx > 0 ? targetList[idx - 1]?.id : undefined;
        const next = idx < targetList.length - 1 ? targetList[idx + 1]?.id : undefined;
        return prev === beforeId && next === afterId;
      })()
    ) {
      return;
    }

    // 乐观更新：把卡片插入目标列的正确位置
    const prevData = qc.getQueryData<BoardResponse>(queryKey);
    qc.setQueryData<BoardResponse>(queryKey, (old) => {
      if (!old) return old;
      const moving = old.columns[fromStatus].find((i) => i.id === issueId);
      if (!moving) return old;
      const newColumns = { ...old.columns };
      newColumns[fromStatus] = old.columns[fromStatus].filter((i) => i.id !== issueId);
      const moved: Issue = { ...moving, status: toStatus };
      const list = [...(newColumns[toStatus] ?? [])];
      let insertAt = list.length;
      if (afterId) {
        const idx = list.findIndex((i) => i.id === afterId);
        if (idx !== -1) insertAt = idx;
      } else if (beforeId) {
        const idx = list.findIndex((i) => i.id === beforeId);
        if (idx !== -1) insertAt = idx + 1;
      }
      list.splice(insertAt, 0, moved);
      newColumns[toStatus] = list;
      return { columns: newColumns };
    });

    try {
      await moveIssue.mutateAsync({
        id: issueId,
        body: { status: toStatus, beforeId, afterId },
      });
    } catch (err) {
      // 回滚
      if (prevData) qc.setQueryData(queryKey, prevData);
      if (err instanceof ApiError) {
        if (err.code === "INVALID_TRANSITION") {
          toast(
            `无法移动到「${STATUS_LABEL[toStatus]}」：状态机不允许该迁移`,
            "error",
          );
        } else {
          toast(err.message, "error");
        }
      } else {
        toast("移动失败，已恢复原位置", "error");
      }
    }
  }

  if (board.isLoading) {
    return (
      <div className="flex gap-3.5 overflow-x-auto pb-4">
        {BOARD_STATUSES.map((s) => (
          <Skeleton key={s} className="h-96 w-68 shrink-0" />
        ))}
      </div>
    );
  }

  if (board.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
        看板加载失败：
        {board.error instanceof ApiError ? board.error.message : "网络错误"}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex min-h-full items-start gap-3.5 overflow-x-auto pb-4">
        {BOARD_STATUSES.map((s) => (
          <Column
            key={s}
            status={s}
            issues={columns[s]}
            onCardClick={openIssue}
            onCreate={onCreateIssue}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? <IssueCard issue={activeIssue} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
