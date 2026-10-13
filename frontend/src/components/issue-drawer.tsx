"use client";

import { format } from "date-fns";
import { Check, Plus, Trash2, X } from "lucide-react";
import * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useAddComment,
  useCreateIssue,
  useDeleteIssue,
  useIssue,
  useUpdateIssue,
} from "@/hooks/use-issues";
import { useProjectMembers } from "@/hooks/use-projects";
import { ApiError } from "@/lib/api";
import {
  ALLOWED_TRANSITIONS,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
} from "@/lib/status";
import { cn } from "@/lib/utils";
import type { IssuePriority, IssueStatus } from "@/lib/types";
import { toast } from "@/stores/toast";

/** 状态迁移按钮文案（动词形式） */
const TRANSITION_ACTION: Partial<Record<IssueStatus, { label: string; variant?: "primary" | "success" | "destructive" | "outline" }>> = {
  in_progress: { label: "开始处理", variant: "primary" },
  in_review: { label: "提交评审", variant: "primary" },
  done: { label: "验收完成 ✓", variant: "success" },
  blocked: { label: "标记阻塞", variant: "destructive" },
  cancelled: { label: "取消任务", variant: "outline" },
};

/** in_review → in_progress 是「打回」 */
function transitionLabel(from: IssueStatus, to: IssueStatus): string {
  if (from === "in_review" && to === "in_progress") return "打回重做";
  if (from === "blocked" && to === "in_progress") return "解除阻塞";
  return TRANSITION_ACTION[to]?.label ?? `流转到「${STATUS_LABEL[to]}」`;
}

export function IssueDrawer({
  issueId,
  projectId,
  onClose,
}: {
  issueId: string | null;
  projectId: string;
  onClose: () => void;
}) {
  const open = !!issueId;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-zinc-950/40 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 flex h-screen w-[620px] max-w-[96vw] flex-col bg-white shadow-[-8px_0_30px_rgba(0,0,0,0.12)]",
          "transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        role="dialog"
        aria-modal="true"
      >
        {issueId ? (
          <DrawerBody key={issueId} issueId={issueId} projectId={projectId} onClose={onClose} />
        ) : null}
      </aside>
    </>
  );
}

function DrawerBody({
  issueId,
  projectId,
  onClose,
}: {
  issueId: string;
  projectId: string;
  onClose: () => void;
}) {
  const issue = useIssue(issueId);
  const members = useProjectMembers(projectId);
  const updateIssue = useUpdateIssue(projectId);
  const deleteIssue = useDeleteIssue(projectId);
  const createIssue = useCreateIssue(projectId);
  const addComment = useAddComment(issueId, projectId);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [labelsInput, setLabelsInput] = React.useState("");
  const [commentInput, setCommentInput] = React.useState("");
  const [subtaskInput, setSubtaskInput] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitionError, setTransitionError] = React.useState<string | null>(null);

  const data = issue.data;

  React.useEffect(() => {
    if (data) {
      setTitle(current.title);
      setDescription(data.description ?? "");
      setLabelsInput(data.labels.join(", "));
      setTransitionError(null);
      setConfirmDelete(false);
    }
  }, [data]);

  if (issue.isLoading) {
    return (
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (issue.isError || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-red-600">
          任务加载失败：{issue.error instanceof ApiError ? issue.error.message : "网络错误"}
        </p>
        <Button onClick={onClose}>关闭</Button>
      </div>
    );
  }

  // 守卫之后的窄化结果，供嵌套函数闭包使用（TS 不对函数声明做跨闭包窄化）
  const current = data;
  const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];

  async function patch(body: Parameters<typeof updateIssue.mutateAsync>[0]["body"], okMsg?: string) {
    try {
      await updateIssue.mutateAsync({ id: issueId, body });
      if (okMsg) toast(okMsg, "success");
    } catch {
      // 全局提示
      throw undefined;
    }
  }

  async function onBlurTitle() {
    const t = title.trim();
    if (t && t !== current.title) {
      await patch({ title: t });
    } else {
      setTitle(current.title);
    }
  }

  async function onBlurDescription() {
    if (description !== (current.description ?? "")) {
      await patch({ description });
    }
  }

  async function onBlurLabels() {
    const labels = labelsInput
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (JSON.stringify(labels) !== JSON.stringify(current.labels)) {
      await patch({ labels });
    }
  }

  async function changeStatus(to: IssueStatus) {
    setTransitionError(null);
    try {
      await updateIssue.mutateAsync({ id: issueId, body: { status: to } });
      toast(`已流转到「${STATUS_LABEL[to]}」`, "success");
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_TRANSITION") {
        const allowedList = (err.allowed ?? []).map((s) => STATUS_LABEL[s as IssueStatus] ?? s);
        setTransitionError(
          `非法状态迁移：当前「${STATUS_LABEL[current.status]}」不能流转到「${STATUS_LABEL[to]}」` +
            (allowedList.length ? `。允许的目标：${allowedList.join("、")}` : ""),
        );
      }
      // 其他错误由全局提示
    }
  }

  async function submitComment() {
    const content = commentInput.trim();
    if (!content || addComment.isPending) return;
    try {
      await addComment.mutateAsync(content);
      setCommentInput("");
    } catch {
      // 全局提示
    }
  }

  async function submitSubtask() {
    const t = subtaskInput.trim();
    if (!t || createIssue.isPending) return;
    try {
      await createIssue.mutateAsync({ projectId, title: t, parentId: issueId });
      setSubtaskInput("");
      toast("子任务已创建", "success");
    } catch {
      // 全局提示
    }
  }

  async function toggleSubtask(sub: NonNullable<typeof current.subtasks>[number]) {
    // 子任务勾选：done ↔ todo。注意状态机：todo → done 非法，需经 in_progress → in_review → done。
    // 简化处理：done → todo 非法（done 是终态），仅允许 未完成 → done 的勾选（通过 PATCH status）。
    // 但状态机不允许 todo → done 直达。因此勾选语义映射为：未完成 → 尝试 done（后端若 409 则提示）。
    if (sub.status === "done") {
      toast("已完成任务不可直接改回（状态机约束）", "error");
      return;
    }
    try {
      await updateIssue.mutateAsync({ id: sub.id, body: { status: "done" } });
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_TRANSITION") {
        toast(`「${sub.title}」当前状态不允许直接标记完成（需按状态机流转）`, "error");
      }
    }
  }

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-zinc-100 px-5 py-4">
        <span className="text-[13px] font-bold tracking-wide text-zinc-400">{data.identifier}</span>
        <Badge className={STATUS_BADGE_CLASS[data.status]}>{STATUS_LABEL[data.status]}</Badge>
        <Badge className="bg-zinc-100 text-zinc-500">{PRIORITY_LABEL[data.priority]}优先级</Badge>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* 标题 */}
        <input
          className="mb-4 w-full rounded-lg border border-transparent px-2 py-1 text-lg font-semibold text-zinc-900 hover:border-zinc-200 focus:border-transparent focus:outline-2 focus:outline-indigo-500"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={onBlurTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />

        {/* 状态流转 */}
        {allowed.length > 0 ? (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {allowed.map((to) => {
              const action = TRANSITION_ACTION[to];
              return (
                <Button
                  key={to}
                  size="sm"
                  variant={action?.variant ?? "outline"}
                  disabled={updateIssue.isPending}
                  onClick={() => changeStatus(to)}
                >
                  {transitionLabel(data.status, to)}
                </Button>
              );
            })}
          </div>
        ) : (
          <p className="mb-2 text-xs text-zinc-400">当前状态为终态，不可再流转</p>
        )}
        {transitionError ? (
          <div role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">
            {transitionError}
          </div>
        ) : null}

        {/* 字段区 */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <Label>优先级</Label>
            <Select
              value={data.priority}
              onValueChange={(v) => {
                if (v) patch({ priority: v as IssuePriority });
              }}
              options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
          </div>
          <div>
            <Label>负责人</Label>
            <Select
              value={data.assigneeId}
              onValueChange={(v) => patch({ assigneeId: v })}
              options={(members.data ?? []).map((m) => ({ value: m.memberId, label: m.name }))}
              placeholder="未分配"
              clearable
              clearLabel="取消分配"
            />
          </div>
          <div>
            <Label htmlFor="drawer-due">截止日期</Label>
            <Input
              id="drawer-due"
              type="date"
              value={data.dueDate ?? ""}
              onChange={(e) => patch({ dueDate: e.target.value || null })}
            />
          </div>
          <div>
            <Label htmlFor="drawer-labels">标签（逗号分隔）</Label>
            <Input
              id="drawer-labels"
              placeholder="bug, frontend"
              value={labelsInput}
              onChange={(e) => setLabelsInput(e.target.value)}
              onBlur={onBlurLabels}
            />
          </div>
        </div>

        {/* 描述 */}
        <section className="mt-6">
          <h3 className="mb-2 text-[13px] font-semibold tracking-wide text-zinc-500 uppercase">
            描述
          </h3>
          <Textarea
            className="min-h-28"
            placeholder="补充任务背景、验收标准…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={onBlurDescription}
          />
        </section>

        {/* 子任务 */}
        {!data.parentId ? (
          <section className="mt-6">
            <h3 className="mb-2 text-[13px] font-semibold tracking-wide text-zinc-500 uppercase">
              子任务
              {data.subtasks.length > 0 ? (
                <span className="ml-2 font-normal text-zinc-400 normal-case">
                  {data.subtasks.filter((s) => s.status === "done").length}/{data.subtasks.length} 已完成
                </span>
              ) : null}
            </h3>
            <div className="space-y-1.5">
              {data.subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => toggleSubtask(sub)}
                    className={cn(
                      "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border",
                      sub.status === "done"
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-zinc-300 hover:border-indigo-500",
                    )}
                    aria-label={sub.status === "done" ? "已完成" : "标记完成"}
                  >
                    {sub.status === "done" ? <Check className="h-3 w-3" /> : null}
                  </button>
                  <span
                    className={cn(
                      "flex-1 text-[13px] font-medium",
                      sub.status === "done" ? "text-zinc-400 line-through" : "text-zinc-800",
                    )}
                  >
                    {sub.title}
                  </span>
                  <Badge className={STATUS_BADGE_CLASS[sub.status]}>
                    {STATUS_LABEL[sub.status]}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="新增子任务，回车确认"
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitSubtask();
                  }
                }}
              />
              <Button
                variant="outline"
                className="shrink-0"
                disabled={createIssue.isPending || !subtaskInput.trim()}
                onClick={submitSubtask}
              >
                <Plus className="h-4 w-4" /> 添加
              </Button>
            </div>
          </section>
        ) : null}

        {/* 评论区 */}
        <section className="mt-6">
          <h3 className="mb-3 text-[13px] font-semibold tracking-wide text-zinc-500 uppercase">
            评论（{data.comments.length}）
          </h3>
          <div className="space-y-3.5">
            {data.comments.length === 0 ? (
              <p className="text-[13px] text-zinc-400">还没有评论，来说点什么</p>
            ) : (
              data.comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar name={c.authorName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2 text-[12.5px] font-semibold text-zinc-800">
                      {c.authorName}
                      {c.authorType !== "member" ? (
                        <Badge className="bg-purple-50 text-purple-600">{c.authorType}</Badge>
                      ) : null}
                      <time className="text-[11px] font-normal text-zinc-400">
                        {format(new Date(c.createdAt), "MM-dd HH:mm")}
                      </time>
                    </div>
                    <div className="rounded-lg bg-zinc-50 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-zinc-600">
                      {c.content}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Textarea
              className="min-h-9 flex-1"
              rows={2}
              placeholder="发表评论…"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submitComment();
                }
              }}
            />
            <Button
              variant="primary"
              className="shrink-0 self-end"
              disabled={addComment.isPending || !commentInput.trim()}
              onClick={submitComment}
            >
              发表
            </Button>
          </div>
        </section>

        {/* 删除 */}
        <section className="mt-8 border-t border-zinc-100 pt-4 pb-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <span className="flex-1 text-[13px] text-red-600">
                确认删除？子任务与评论将一并删除，不可恢复。
              </span>
              <Button size="sm" onClick={() => setConfirmDelete(false)}>
                取消
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={deleteIssue.isPending}
                onClick={async () => {
                  try {
                    await deleteIssue.mutateAsync(issueId);
                    toast(`任务 ${data.identifier} 已删除`, "success");
                    onClose();
                  } catch {
                    // 全局提示
                  }
                }}
              >
                {deleteIssue.isPending ? "删除中…" : "确认删除"}
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" /> 删除任务
            </Button>
          )}
        </section>
      </div>
    </>
  );
}
