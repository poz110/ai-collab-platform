"use client";

import { Trash2, UserPlus } from "lucide-react";
import * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-auth";
import {
  useAddProjectMember,
  useProjectMembers,
  useRemoveProjectMember,
  useUpdateProjectMember,
} from "@/hooks/use-projects";
import { ApiError } from "@/lib/api";
import type { ProjectRole } from "@/lib/types";
import { toast } from "@/stores/toast";

const ROLE_LABEL: Record<ProjectRole, string> = {
  lead: "负责人",
  member: "成员",
  viewer: "观察者",
};

const ROLE_OPTIONS = (Object.keys(ROLE_LABEL) as ProjectRole[]).map((r) => ({
  value: r,
  label: ROLE_LABEL[r],
}));

export function MembersDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const me = useMe();
  const members = useProjectMembers(projectId);
  const addMember = useAddProjectMember(projectId);
  const updateMember = useUpdateProjectMember(projectId);
  const removeMember = useRemoveProjectMember(projectId);

  const canManage = me.data?.member.role === "owner" || me.data?.member.role === "admin";

  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<ProjectRole>("member");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setEmail("");
      setRole("member");
      setError(null);
    }
  }, [open]);

  async function invite() {
    setError(null);
    if (!email.trim()) {
      setError("请输入邮箱");
      return;
    }
    try {
      await addMember.mutateAsync({ email: email.trim(), role });
      toast("成员已加入项目", "success");
      setEmail("");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader
        title="成员管理"
        onClose={onClose}
        description="按邮箱邀请工作区成员加入项目，并设置项目角色"
      />
      <DialogBody>
        {canManage ? (
          <div className="mb-5 flex items-start gap-2">
            <Input
              placeholder="成员邮箱"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  invite();
                }
              }}
            />
            <Select
              className="w-28 shrink-0"
              value={role}
              onValueChange={(v) => setRole((v ?? "member") as ProjectRole)}
              options={ROLE_OPTIONS}
            />
            <Button
              variant="primary"
              className="shrink-0"
              disabled={addMember.isPending}
              onClick={invite}
            >
              <UserPlus className="h-4 w-4" /> 邀请
            </Button>
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">
            {error}
          </div>
        ) : null}

        {members.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (members.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">暂无成员</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {(members.data ?? []).map((m) => (
              <li key={m.memberId} className="flex items-center gap-3 py-2.5">
                <Avatar name={m.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-900">{m.name}</span>
                    {m.userId === me.data?.user.id ? (
                      <Badge className="bg-indigo-50 text-indigo-600">我</Badge>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-zinc-400">{m.email}</div>
                </div>
                {canManage ? (
                  <>
                    <Select
                      className="w-28"
                      value={m.role}
                      onValueChange={async (v) => {
                        if (!v || v === m.role) return;
                        try {
                          await updateMember.mutateAsync({
                            memberId: m.memberId,
                            role: v as ProjectRole,
                          });
                          toast(`已将 ${m.name} 的角色改为「${ROLE_LABEL[v as ProjectRole]}」`, "success");
                        } catch {
                          // 全局提示
                        }
                      }}
                      options={ROLE_OPTIONS}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-zinc-400 hover:text-red-600"
                      aria-label={`移除 ${m.name}`}
                      disabled={removeMember.isPending}
                      onClick={async () => {
                        try {
                          await removeMember.mutateAsync(m.memberId);
                          toast(`已移除 ${m.name}`, "success");
                        } catch {
                          // 全局提示
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Badge className="bg-zinc-100 text-zinc-600">{ROLE_LABEL[m.role]}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        {!canManage ? (
          <p className="mt-3 text-xs text-zinc-400">仅工作区 owner/admin 可管理项目成员</p>
        ) : null}
      </DialogBody>
    </Dialog>
  );
}
