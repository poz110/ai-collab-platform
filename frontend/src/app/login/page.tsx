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

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    if (!email.trim()) {
      setError("请输入邮箱");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }
    setPending(true);
    try {
      await apiPost<Session>("/auth/sign-in/email", { email: email.trim(), password });
      qc.clear();
      router.replace("/projects");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.code === "INVALID_EMAIL_OR_PASSWORD" || err.status === 401
            ? "邮箱或密码不正确"
            : err.message,
        );
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
          <h1 className="text-xl font-bold text-zinc-900">登录 AI Collab</h1>
          <p className="mt-1 text-sm text-zinc-500">AI 驱动的项目看板与任务编排平台</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
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
              autoComplete="current-password"
              placeholder="请输入密码"
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
            {pending ? "登录中…" : "登录"}
          </Button>
          <p className="mt-4 text-center text-[13px] text-zinc-500">
            还没有账号？{" "}
            <Link href="/register" className="font-medium text-indigo-600 hover:underline">
              注册
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
