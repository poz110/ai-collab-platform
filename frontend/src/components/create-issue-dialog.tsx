"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateIssue } from "@/hooks/use-issues";
import { useProjectMembers } from "@/hooks/use-projects";
import { PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL } from "@/lib/status";
import type { IssuePriority, IssueStatus } from "@/lib/types";
import { toast } from "@/stores/toast";

export function CreateIssueDialog({
  projectId,
  open,
  initialStatus,
  onClose,
}: {
  projectId: string;
  open: boolean;
  /** 从看板列「+」进入时的目标状态提示（创建后任务落在 todo，由用户流转或拖拽） */
  initialStatus?: IssueStatus;
  onClose: () => void;
}) {
  const createIssue = useCreateIssue(projectId);
  const members = useProjectMembers(projectId);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<IssuePriority>("medium");
  const [labels, setLabels] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setLabels("");
      setDueDate("");
      setAssigneeId(null);
      setError(null);
    }
  }, [open]);

  async function submit() {
    setError(null);
    if (!title.trim()) {
      setError("请输入任务标题");
      return;
    }
    try {
      const parsedLabels = labels
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      await createIssue.mutateAsync({
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        labels: parsedLabels.length ? parsedLabels : undefined,
        dueDate: dueDate || undefined,
        assigneeId: assigneeId ?? undefined,
      });
      toast("任务已创建", "success");
      onClose();
    } catch {
      // 全局提示
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader
        title="新建任务"
        onClose={onClose}
        description={
          initialStatus && initialStatus !== "todo"
            ? `新任务默认进入「待办」列，创建后可拖拽到「${STATUS_LABEL[initialStatus]}」`
            : undefined
        }
      />
      <DialogBody className="space-y-4">
        <div>
          <Label htmlFor="ci-title">标题</Label>
          <Input
            id="ci-title"
            placeholder="一句话说明要做什么"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="ci-desc">描述（可选）</Label>
          <Textarea
            id="ci-desc"
            placeholder="背景、验收标准…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>优先级</Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority((v ?? "medium") as IssuePriority)}
              options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
          </div>
          <div>
            <Label>负责人</Label>
            <Select
              value={assigneeId}
              onValueChange={setAssigneeId}
              options={(members.data ?? []).map((m) => ({ value: m.memberId, label: m.name }))}
              placeholder="未分配"
              clearable
              clearLabel="不分配"
            />
          </div>
          <div>
            <Label htmlFor="ci-due">截止日期（可选）</Label>
            <Input id="ci-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ci-labels">标签（逗号分隔）</Label>
            <Input
              id="ci-labels"
              placeholder="bug, frontend"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
            />
          </div>
        </div>
        {error ? (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">
            {error}
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" disabled={createIssue.isPending} onClick={submit}>
          {createIssue.isPending ? "创建中…" : "创建任务"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
