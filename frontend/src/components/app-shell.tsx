"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { DropdownItem, DropdownMenu } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, useSession, useSignOut } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";

const PUBLIC_PATHS = ["/login", "/register"];

/**
 * 应用外壳：路由守卫 + 顶栏（Logo / 导航 / 用户菜单）。
 * 受保护页面未认证 → 跳 /login；已登录访问 /login|/register → 跳 /projects。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  const session = useSession();
  const me = useMe(!isPublic && !!session.data);
  const signOut = useSignOut();

  const authed = !!session.data?.user;

  React.useEffect(() => {
    if (session.isLoading) return;
    if (!isPublic && session.data === null) {
      router.replace("/login");
    } else if (isPublic && authed) {
      router.replace("/projects");
    }
  }, [isPublic, authed, session.data, session.isLoading, router]);

  // 登录/注册页：无外壳
  if (isPublic) {
    if (session.isLoading || authed) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Skeleton className="h-8 w-40" />
        </div>
      );
    }
    return <>{children}</>;
  }

  // 受保护页：等待会话确认
  if (session.isLoading || !authed) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex h-13 items-center border-b border-zinc-200 bg-white px-5">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex-1 p-5">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const meError = me.error instanceof ApiError ? me.error : null;
  // /me 之外的 401 已由 api.ts 统一跳登录；这里仅处理加载态
  const displayName = me.data?.user.name ?? session.data?.user.name ?? "";
  const email = me.data?.user.email ?? session.data?.user.email ?? "";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-13 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white px-5">
        <Link href="/projects" className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-500 text-xs text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="text-[15px] font-bold text-zinc-900">AI Collab</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/projects"
            className={
              pathname.startsWith("/projects")
                ? "rounded-md px-2.5 py-1.5 font-medium text-zinc-900"
                : "rounded-md px-2.5 py-1.5 text-zinc-500 hover:text-zinc-900"
            }
          >
            项目
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {me.data?.workspace ? (
            <span className="hidden text-xs text-zinc-400 sm:inline">
              {me.data.workspace.name}
            </span>
          ) : null}
          <DropdownMenu
            trigger={
              <span className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-zinc-100">
                <Avatar name={displayName || email} size="sm" />
                <span className="hidden max-w-32 truncate text-sm text-zinc-700 sm:inline">
                  {displayName || email}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              </span>
            }
          >
            <div className="border-b border-zinc-100 px-3 py-2">
              <div className="truncate text-sm font-medium text-zinc-900">{displayName}</div>
              <div className="truncate text-xs text-zinc-400">{email}</div>
              {meError ? <div className="text-xs text-red-500">用户信息加载失败</div> : null}
            </div>
            <DropdownItem onClick={() => router.push("/settings/profile")}>
              <UserRound className="h-3.5 w-3.5" /> 资料设置
            </DropdownItem>
            <DropdownItem
              destructive
              disabled={signOut.isPending}
              onClick={() => {
                qc.clear();
                signOut.mutate();
              }}
            >
              <LogOut className="h-3.5 w-3.5" /> 退出登录
            </DropdownItem>
          </DropdownMenu>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
