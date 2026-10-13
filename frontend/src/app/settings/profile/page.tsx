"use client";

import * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, useUpdateMe } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { toast } from "@/stores/toast";

const WORKSPACE_ROLE_LABEL: Record<string, string> = {
  owner: "所有者",
  admin: "管理员",
  member: "成员",
};

export default function ProfileSettingsPage() {
  const me = useMe();
  const updateMe = useUpdateMe();
  const [name, setName] = React.useState("");

  React.useEffect(() => {
    if (me.data) setName(me.data.user.name);
  }, [me.data]);

  if (me.isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 p-5 md:p-8">
        <Skeleton className="mb-4 h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (me.isError || !me.data) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 p-5 md:p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
          用户信息加载失败：{me.error instanceof ApiError ? me.error.message : "网络错误"}
        </div>
      </div>
    );
  }

  const { user, member, workspace } = me.data;
  const dirty = name.trim() !== user.name && name.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-5 md:p-8">
      <h1 className="mb-6 text-lg font-bold text-zinc-900">资料设置</h1>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>个人信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex items-center gap-3">
            <Avatar name={name || user.name} />
            <div>
              <div className="text-sm font-medium text-zinc-900">{user.name}</div>
              <div className="text-xs text-zinc-400">{user.email}</div>
            </div>
          </div>
          <Label htmlFor="profile-name">显示名</Label>
          <div className="flex gap-2">
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的显示名"
            />
            <Button
              variant="primary"
              className="shrink-0"
              disabled={!dirty || updateMe.isPending}
              onClick={async () => {
                try {
                  await updateMe.mutateAsync({ name: name.trim() });
                  toast("显示名已更新", "success");
                } catch {
                  // 全局提示
                }
              }}
            >
              {updateMe.isPending ? "保存中…" : "保存"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>工作区</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">工作区名称</dt>
              <dd className="font-medium text-zinc-900">{workspace.name}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">工作区标识</dt>
              <dd className="font-mono text-xs text-zinc-600">{workspace.slug}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">我的角色</dt>
              <dd>
                <Badge className="bg-indigo-50 text-indigo-600">
                  {WORKSPACE_ROLE_LABEL[member.role] ?? member.role}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">邮箱</dt>
              <dd className="text-zinc-900">{user.email}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
