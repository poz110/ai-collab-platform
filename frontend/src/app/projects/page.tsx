"use client";

import { format } from "date-fns";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { DropdownItem, DropdownMenu } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-auth";
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from "@/hooks/use-projects";
import { ApiError } from "@/lib/api";
import type { Project } from "@/lib/types";
import { toast } from "@/stores/toast";

const KEY_PATTERN = /^[A-Z]{2,6}$/;

export default function ProjectsPage() {
  const router = useRouter();
  const projects = useProjects();
  const me = useMe();
  const deleteProject = useDeleteProject();

  const canManage = me.data?.member.role === "owner" || me.data?.member.role === "admin";

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Project | null>(null);
  const [deleting, setDeleting] = React.useState<Project | null>(null);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 p-5 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">项目</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {me.data?.workspace.name ?? "当前工作区"} · 共 {projects.data?.length ?? "…"} 个项目
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> 新建项目
        </Button>
      </div>

      {projects.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : projects.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
          项目列表加载失败：
          {projects.error instanceof ApiError ? projects.error.message : "网络错误"}
        </div>
      ) : projects.data && projects.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-20">
          <p className="mb-1 text-sm font-medium text-zinc-700">还没有项目</p>
          <p className="mb-4 text-[13px] text-zinc-400">创建第一个项目，开始用看板管理任务</p>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> 新建项目
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.data?.map((p) => (
            <Card
              key={p.id}
              className="group cursor-pointer p-4 transition-shadow hover:shadow-md"
              onClick={() => router.push(`/projects/${p.id}`)}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600">
                    {p.key.slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-900">{p.name}</div>
                    <div className="text-[11px] font-medium tracking-wide text-zinc-400">
                      {p.key}
                    </div>
                  </div>
                </div>
                {canManage ? (
                  <span onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      trigger={
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </span>
                      }
                    >
                      <DropdownItem onClick={() => setEditing(p)}>
                        <Pencil className="h-3.5 w-3.5" /> 编辑
                      </DropdownItem>
                      <DropdownItem destructive onClick={() => setDeleting(p)}>
                        <Trash2 className="h-3.5 w-3.5" /> 删除
                      </DropdownItem>
                    </DropdownMenu>
                  </span>
                ) : null}
              </div>
              <p className="mb-3 line-clamp-2 min-h-5 text-[13px] text-zinc-500">
                {p.description || "暂无描述"}
              </p>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{p.issueCount} 个任务</span>
                <span>创建于 {format(new Date(p.createdAt), "yyyy-MM-dd")}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditProjectDialog project={editing} onClose={() => setEditing(null)} />

      <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
        <DialogHeader title="删除项目" onClose={() => setDeleting(null)} />
        <DialogBody>
          <p className="text-sm text-zinc-600">
            确定删除项目「{deleting?.name}」吗？项目下的所有任务、子任务与评论都会被删除，此操作不可恢复。
          </p>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => setDeleting(null)}>取消</Button>
          <Button
            variant="destructive"
            disabled={deleteProject.isPending}
            onClick={async () => {
              if (!deleting) return;
              try {
                await deleteProject.mutateAsync(deleting.id);
                toast(`项目「${deleting.name}」已删除`, "success");
                setDeleting(null);
              } catch {
                // 全局 mutation onError 已提示
              }
            }}
          >
            {deleteProject.isPending ? "删除中…" : "确认删除"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function CreateProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const createProject = useCreateProject();
  const [name, setName] = React.useState("");
  const [key, setKey] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName("");
      setKey("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("请输入项目名称");
      return;
    }
    if (!KEY_PATTERN.test(key)) {
      setError("项目 Key 需为 2-6 位大写字母（任务编号前缀）");
      return;
    }
    try {
      const p = await createProject.mutateAsync({
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim() || undefined,
      });
      toast(`项目「${p.name}」已创建`, "success");
      onClose();
      router.push(`/projects/${p.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "KEY_CONFLICT") {
        setError("项目 Key 已被占用，请更换");
      }
      // 其他错误由全局 mutation onError toast 提示
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader
        title="新建项目"
        onClose={onClose}
        description="项目 Key 是任务编号前缀（如 ACP-42 中的 ACP）"
      />
      <DialogBody className="space-y-4">
        <div>
          <Label htmlFor="pf-name">项目名称</Label>
          <Input
            id="pf-name"
            placeholder="例如：AI 协作平台"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pf-key">项目 Key</Label>
          <Input
            id="pf-key"
            placeholder="2-6 位大写字母，如 ACP"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            maxLength={6}
          />
        </div>
        <div>
          <Label htmlFor="pf-desc">描述（可选）</Label>
          <Textarea
            id="pf-desc"
            placeholder="这个项目是做什么的？"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {error ? (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">
            {error}
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" disabled={createProject.isPending} onClick={submit}>
          {createProject.isPending ? "创建中…" : "创建项目"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function EditProjectDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const updateProject = useUpdateProject(project?.id ?? "");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setError(null);
    }
  }, [project]);

  async function submit() {
    if (!project) return;
    setError(null);
    if (!name.trim()) {
      setError("请输入项目名称");
      return;
    }
    try {
      await updateProject.mutateAsync({ name: name.trim(), description: description.trim() });
      toast("项目已更新", "success");
      onClose();
    } catch {
      // 全局提示
    }
  }

  return (
    <Dialog open={!!project} onClose={onClose}>
      <DialogHeader
        title="编辑项目"
        onClose={onClose}
        description={`项目 Key（${project?.key ?? ""}）创建后不可修改`}
      />
      <DialogBody className="space-y-4">
        <div>
          <Label htmlFor="ep-name">项目名称</Label>
          <Input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ep-desc">描述</Label>
          <Textarea
            id="ep-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {error ? (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">
            {error}
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>取消</Button>
        <Button variant="primary" disabled={updateProject.isPending} onClick={submit}>
          {updateProject.isPending ? "保存中…" : "保存"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
