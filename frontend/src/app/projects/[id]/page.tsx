"use client";

import { CalendarDays, KanbanSquare, List, Plus, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { BoardView } from "@/components/board-view";
import { CalendarView } from "@/components/calendar-view";
import { CreateIssueDialog } from "@/components/create-issue-dialog";
import { FilterBar } from "@/components/filter-bar";
import { IssueDrawer } from "@/components/issue-drawer";
import { ListView } from "@/components/list-view";
import { MembersDialog } from "@/components/members-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useProject } from "@/hooks/use-projects";
import { ApiError } from "@/lib/api";
import type { IssueStatus } from "@/lib/types";
import { useProjectUiStore, type ViewMode } from "@/stores/project-ui";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const project = useProject(projectId);

  const { view, setView, activeIssueId, closeIssue } = useProjectUiStore();

  const [membersOpen, setMembersOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState<IssueStatus>("todo");

  // 切换项目时重置视图状态
  React.useEffect(() => {
    closeIssue();
  }, [projectId, closeIssue]);

  if (project.isLoading) {
    return (
      <div className="flex-1 p-5">
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (project.isError || !project.data) {
    const err = project.error;
    const notFound =
      err instanceof ApiError && (err.status === 404 || err.code === "PROJECT_NOT_FOUND");
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-zinc-600">
          {notFound
            ? "项目不存在或已被删除"
            : `项目加载失败：${err instanceof ApiError ? err.message : "网络错误"}`}
        </p>
        <Button onClick={() => router.push("/projects")}>返回项目列表</Button>
      </div>
    );
  }

  const openCreate = (status: IssueStatus = "todo") => {
    setCreateStatus(status);
    setCreateOpen(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 页头 */}
      <div className="border-b border-zinc-200 bg-white px-5 pt-4 pb-3">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600">
            {project.data.key.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold text-zinc-900">
              {project.data.name}
            </h1>
            <span className="text-xs text-zinc-400">{project.data.key}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" onClick={() => setMembersOpen(true)}>
              <Users className="h-3.5 w-3.5" /> 成员
            </Button>
            <Button size="sm" variant="primary" onClick={() => openCreate("todo")}>
              <Plus className="h-3.5 w-3.5" /> 新建任务
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs<ViewMode>
            value={view}
            onValueChange={setView}
            items={[
              { value: "board", label: <TabLabel icon={<KanbanSquare className="h-3.5 w-3.5" />} text="看板" /> },
              { value: "list", label: <TabLabel icon={<List className="h-3.5 w-3.5" />} text="列表" /> },
              { value: "calendar", label: <TabLabel icon={<CalendarDays className="h-3.5 w-3.5" />} text="日历" /> },
            ]}
          />
          <FilterBar projectId={projectId} />
        </div>
      </div>

      {/* 视图内容 */}
      <div className="min-h-0 flex-1 overflow-auto p-5">
        {view === "board" ? (
          <BoardView projectId={projectId} onCreateIssue={openCreate} />
        ) : view === "list" ? (
          <ListView projectId={projectId} />
        ) : (
          <CalendarView projectId={projectId} />
        )}
      </div>

      <MembersDialog
        projectId={projectId}
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
      />
      <CreateIssueDialog
        projectId={projectId}
        open={createOpen}
        initialStatus={createStatus}
        onClose={() => setCreateOpen(false)}
      />
      <IssueDrawer issueId={activeIssueId} projectId={projectId} onClose={closeIssue} />
    </div>
  );
}

function TabLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {text}
    </span>
  );
}
