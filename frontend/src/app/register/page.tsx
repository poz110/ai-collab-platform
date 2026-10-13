"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiPost } from "@/lib/api";
import type { Session } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";

export default function RegisterPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    if (!name.trim()) {
      setError("请输入姓名");
      return;
    }
    if (!email.trim()) {
      setError("请输入邮箱");
      return;
    }
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    setPending(true);
    try {
      // 注册成功即自动登录并创建默认工作区（api-spec §认证与会话）
      await apiPost<Session>("/auth/sign-up/email", {
        name: name.trim(),
        email: email.trim(),
        password,
      });
      qc.clear();
      router.replace("/projects");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("网络错误，请稍后重试");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-lg font-bold text-white">
            ✦
          </div>
          <h1 className="text-xl font-bold text-zinc-900">注册 AI Collab</h1>
          <p className="mt-1 text-sm text-zinc-500">注册后自动创建你的专属工作区</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4">
            <Label htmlFor="name">姓名</Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="你的显示名"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="mb-5">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="至少 8 位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? (
            <div role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">
              {error}
            </div>
          ) : null}
          <Button type="submit" variant="primary" className="w-full" disabled={pending}>
            {pending ? "注册中…" : "注册"}
          </Button>
          <p className="mt-4 text-center text-[13px] text-zinc-500">
            已有账号？{" "}
            <Link href="/login" className="font-medium text-indigo-600 hover:underline">
              登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
